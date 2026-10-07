from fastapi import FastAPI, APIRouter, HTTPException, Request, Depends
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from pathlib import Path
import os
import json
import uuid
import random
import logging
import bcrypt
import jwt
import httpx

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone  # noqa: E402

client = AsyncIOMotorClient(os.environ['MONGO_URL'])
db = client[os.environ['DB_NAME']]
JWT_SECRET = os.environ['JWT_SECRET']
EMERGENT_LLM_KEY = os.environ['EMERGENT_LLM_KEY']
JWT_DAYS = 7

app = FastAPI()
api = APIRouter(prefix="/api")
logger = logging.getLogger("finai")
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')


def now():
    return datetime.now(timezone.utc)


def new_id(prefix):
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


# ---------------------------------------------------------------- models
class RegisterIn(BaseModel):
    name: str = Field(min_length=1)
    email: EmailStr
    password: str = Field(min_length=6)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class SessionIn(BaseModel):
    session_id: str


class ConnectIn(BaseModel):
    institution_id: str


class TransactionIn(BaseModel):
    description: str = Field(min_length=1)
    amount: float = Field(gt=0)
    type: str = Field(pattern="^(income|expense)$")
    category: str
    account_id: Optional[str] = None
    date: Optional[str] = None


class BudgetIn(BaseModel):
    category: str
    limit: float = Field(gt=0)


class GoalIn(BaseModel):
    name: str = Field(min_length=1)
    target: float = Field(gt=0)
    deadline: Optional[str] = None
    icon: str = "flag"


class ContributeIn(BaseModel):
    amount: float = Field(gt=0)


class InsightIn(BaseModel):
    model: str = "claude"
    question: Optional[str] = None


class HouseholdIn(BaseModel):
    name: str = Field(min_length=1, max_length=40)


class JoinIn(BaseModel):
    invite_code: str = Field(min_length=6, max_length=6)


# ---------------------------------------------------------------- auth
def public_user(u):
    return {k: u.get(k) for k in ("user_id", "email", "name", "picture", "auth_provider")}


def issue_jwt(user_id):
    exp = now() + timedelta(days=JWT_DAYS)
    return jwt.encode({"sub": user_id, "exp": exp, "iat": now()}, JWT_SECRET, algorithm="HS256")


async def current_user(request: Request):
    header = request.headers.get("Authorization", "")
    if not header.lower().startswith("bearer "):
        raise HTTPException(401, "Não autenticado")
    token = header[7:].strip()
    user_id = None
    try:
        user_id = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])["sub"]
    except jwt.PyJWTError:
        sess = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
        if sess:
            exp = sess["expires_at"]
            if exp.tzinfo is None:
                exp = exp.replace(tzinfo=timezone.utc)
            if exp > now():
                user_id = sess["user_id"]
    if not user_id:
        raise HTTPException(401, "Sessão inválida ou expirada")
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(401, "Usuário não encontrado")
    return user


@api.post("/auth/register")
async def register(body: RegisterIn):
    email = body.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(409, "Email já cadastrado")
    user = {
        "user_id": new_id("user"), "email": email, "name": body.name.strip(), "picture": None,
        "auth_provider": "password",
        "password_hash": bcrypt.hashpw(body.password.encode(), bcrypt.gensalt()).decode(),
        "created_at": now().isoformat(),
    }
    await db.users.insert_one(user)
    return {"token": issue_jwt(user["user_id"]), "user": public_user(user)}


@api.post("/auth/login")
async def login(body: LoginIn):
    user = await db.users.find_one({"email": body.email.lower().strip()}, {"_id": 0})
    if not user or not user.get("password_hash") or not bcrypt.checkpw(body.password.encode(), user["password_hash"].encode()):
        raise HTTPException(401, "Email ou senha incorretos")
    return {"token": issue_jwt(user["user_id"]), "user": public_user(user)}


@api.post("/auth/session")
async def google_session(body: SessionIn):
    async with httpx.AsyncClient(timeout=15) as hc:
        r = await hc.get("https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                         headers={"X-Session-ID": body.session_id})
    if r.status_code != 200:
        raise HTTPException(401, "Sessão Google inválida")
    data = r.json()
    email = data["email"].lower()
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user:
        user = {"user_id": new_id("user"), "email": email, "name": data.get("name") or email.split("@")[0],
                "picture": data.get("picture"), "auth_provider": "google", "created_at": now().isoformat()}
        await db.users.insert_one(dict(user))
    else:
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"picture": data.get("picture") or user.get("picture")}})
    await db.user_sessions.insert_one({
        "session_token": data["session_token"], "user_id": user["user_id"],
        "expires_at": now() + timedelta(days=7), "created_at": now(),
    })
    return {"token": data["session_token"], "user": public_user(user)}


@api.get("/auth/me")
async def me(user=Depends(current_user)):
    return public_user(user)


@api.post("/auth/logout")
async def logout(request: Request, user=Depends(current_user)):
    token = request.headers.get("Authorization", "")[7:].strip()
    await db.user_sessions.delete_one({"session_token": token})
    return {"ok": True}


# ---------------------------------------------------------------- household (shared data)
CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


async def household_view(h):
    members = await db.users.find({"user_id": {"$in": h["member_ids"]}},
                                  {"_id": 0, "user_id": 1, "name": 1, "email": 1, "picture": 1}).to_list(50)
    members.sort(key=lambda m: h["member_ids"].index(m["user_id"]))
    return {
        "household_id": h["household_id"], "name": h["name"], "owner_id": h["owner_id"], "invite_code": h["invite_code"],
        "members": [{**m, "role": "owner" if m["user_id"] == h["owner_id"] else "member"} for m in members],
    }


async def user_household(user):
    if not user.get("household_id"):
        return None
    return await db.households.find_one({"household_id": user["household_id"]}, {"_id": 0})


async def scope(user):
    """user_ids whose data is visible to this user (self + household members) and a name map."""
    h = await user_household(user)
    if not h:
        return [user["user_id"]], {}, None
    members = await db.users.find({"user_id": {"$in": h["member_ids"]}}, {"_id": 0, "user_id": 1, "name": 1}).to_list(50)
    return h["member_ids"], {m["user_id"]: m["name"] for m in members}, h


def tag_owner(items, names):
    if names:
        for t in items:
            t["owner_name"] = names.get(t["user_id"])
    return items


@api.get("/household")
async def get_household(user=Depends(current_user)):
    h = await user_household(user)
    return await household_view(h) if h else None


@api.post("/household")
async def create_household(body: HouseholdIn, user=Depends(current_user)):
    if user.get("household_id"):
        raise HTTPException(409, "Você já faz parte de uma casa")
    code = "".join(random.choices(CODE_ALPHABET, k=6))
    while await db.households.find_one({"invite_code": code}):
        code = "".join(random.choices(CODE_ALPHABET, k=6))
    h = {"household_id": new_id("house"), "name": body.name.strip(), "owner_id": user["user_id"],
         "member_ids": [user["user_id"]], "invite_code": code, "created_at": now().isoformat()}
    await db.households.insert_one(dict(h))
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"household_id": h["household_id"]}})
    return await household_view(h)


@api.post("/household/join")
async def join_household(body: JoinIn, user=Depends(current_user)):
    if user.get("household_id"):
        raise HTTPException(409, "Você já faz parte de uma casa. Saia dela antes de entrar em outra.")
    h = await db.households.find_one({"invite_code": body.invite_code.strip().upper()}, {"_id": 0})
    if not h:
        raise HTTPException(404, "Código de convite inválido")
    await db.households.update_one({"household_id": h["household_id"]}, {"$addToSet": {"member_ids": user["user_id"]}})
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"household_id": h["household_id"]}})
    h["member_ids"].append(user["user_id"])
    return await household_view(h)


@api.post("/household/leave")
async def leave_household(user=Depends(current_user)):
    h = await user_household(user)
    if not h:
        raise HTTPException(404, "Você não faz parte de uma casa")
    remaining = [m for m in h["member_ids"] if m != user["user_id"]]
    if not remaining:
        await db.households.delete_one({"household_id": h["household_id"]})
    else:
        update = {"$set": {"member_ids": remaining}}
        if h["owner_id"] == user["user_id"]:
            update["$set"]["owner_id"] = remaining[0]
        await db.households.update_one({"household_id": h["household_id"]}, update)
    await db.users.update_one({"user_id": user["user_id"]}, {"$unset": {"household_id": ""}})
    return {"ok": True}


@api.delete("/household/members/{member_id}")
async def remove_member(member_id: str, user=Depends(current_user)):
    h = await user_household(user)
    if not h or h["owner_id"] != user["user_id"]:
        raise HTTPException(403, "Apenas o dono da casa pode remover membros")
    if member_id == user["user_id"]:
        raise HTTPException(400, "Use 'Sair da casa' para se remover")
    if member_id not in h["member_ids"]:
        raise HTTPException(404, "Membro não encontrado")
    await db.households.update_one({"household_id": h["household_id"]}, {"$pull": {"member_ids": member_id}})
    await db.users.update_one({"user_id": member_id}, {"$unset": {"household_id": ""}})
    h["member_ids"].remove(member_id)
    return await household_view(h)


# ---------------------------------------------------------------- open finance (mock)
INSTITUTIONS = [
    {"id": "nubank", "name": "Nubank", "initials": "NU", "color": "#820AD1"},
    {"id": "itau", "name": "Itaú Unibanco", "initials": "ITA", "color": "#EC7000"},
    {"id": "bradesco", "name": "Bradesco", "initials": "BRA", "color": "#CC092F"},
    {"id": "inter", "name": "Banco Inter", "initials": "INT", "color": "#FF7A00"},
    {"id": "santander", "name": "Santander", "initials": "SAN", "color": "#EC0000"},
    {"id": "bb", "name": "Banco do Brasil", "initials": "BB", "color": "#FCCF00"},
    {"id": "caixa", "name": "Caixa", "initials": "CX", "color": "#005CA9"},
    {"id": "c6", "name": "C6 Bank", "initials": "C6", "color": "#242424"},
]
INST_MAP = {i["id"]: i for i in INSTITUTIONS}

MERCHANTS = {
    "alimentacao": [("iFood", 35, 120), ("Pão de Açúcar", 80, 350), ("Restaurante Madero", 60, 180), ("Padaria Real", 12, 40)],
    "transporte": [("Uber", 15, 60), ("99 Táxi", 12, 45), ("Posto Shell", 120, 280)],
    "moradia": [("Aluguel", 1800, 2400), ("Enel Energia", 150, 320), ("Sabesp", 70, 140), ("Vivo Fibra", 99, 130)],
    "lazer": [("Cinemark", 40, 90), ("Bar do Zé", 50, 200), ("Ingresso.com", 80, 300)],
    "saude": [("Drogasil", 25, 180), ("Smart Fit", 120, 140), ("Unimed", 450, 650)],
    "compras": [("Amazon", 60, 400), ("Mercado Livre", 40, 350), ("Renner", 90, 300)],
    "educacao": [("Udemy", 30, 90), ("Livraria Cultura", 40, 150)],
    "assinaturas": [("Netflix", 39.9, 55.9), ("Spotify", 21.9, 34.9), ("Amazon Prime", 19.9, 19.9)],
}


def gen_transactions(user_id, account_id, inst_name):
    txs = []
    today = now()
    for m in range(3):
        base = (today.replace(day=1) - timedelta(days=30 * m)).replace(day=5)
        if base <= today:
            txs.append(("Salário - Empresa XPTO", round(random.uniform(6500, 9000), 2), "income", "salario", base))
        if random.random() < 0.5:
            d = base + timedelta(days=random.randint(5, 20))
            if d <= today:
                txs.append(("Pix recebido - Freelance", round(random.uniform(400, 1800), 2), "income", "outros", d))
    days_in_month = max(0, (today - month_start(today)).days)
    for i in range(44):
        cat = random.choice(list(MERCHANTS.keys()))
        name, lo, hi = random.choice(MERCHANTS[cat])
        # first 8 expenses fall in the current month so the dashboard is never empty
        back = random.randint(0, days_in_month) if i < 8 else random.randint(0, 85)
        d = today - timedelta(days=back, hours=random.randint(0, min(12, today.hour)))
        txs.append((name, round(random.uniform(lo, hi), 2), "expense", cat, d))
    return [{
        "transaction_id": new_id("tx"), "user_id": user_id, "account_id": account_id, "institution": inst_name,
        "description": desc, "amount": amt, "type": typ, "category": cat, "date": d.isoformat(), "source": "openfinance",
    } for desc, amt, typ, cat, d in txs]


@api.get("/openfinance/institutions")
async def institutions(user=Depends(current_user)):
    connected = await db.accounts.distinct("institution_id", {"user_id": user["user_id"]})
    return [{**i, "connected": i["id"] in connected} for i in INSTITUTIONS]


@api.post("/openfinance/connect")
async def connect(body: ConnectIn, user=Depends(current_user)):
    inst = INST_MAP.get(body.institution_id)
    if not inst:
        raise HTTPException(404, "Instituição não encontrada")
    if await db.accounts.find_one({"user_id": user["user_id"], "institution_id": inst["id"]}):
        raise HTTPException(409, "Banco já conectado")
    acc = {
        "account_id": new_id("acc"), "user_id": user["user_id"], "institution_id": inst["id"],
        "institution_name": inst["name"], "initials": inst["initials"], "color": inst["color"],
        "type": "Conta corrente", "number": f"****{random.randint(1000, 9999)}",
        "balance": round(random.uniform(1200, 15000), 2), "connected_at": now().isoformat(),
    }
    await db.accounts.insert_one(dict(acc))
    await db.transactions.insert_many(gen_transactions(user["user_id"], acc["account_id"], inst["name"]))
    ids, _, _ = await scope(user)
    if not await db.budgets.find_one({"user_id": {"$in": ids}}):
        await db.budgets.insert_many([
            {"budget_id": new_id("bud"), "user_id": user["user_id"], "category": c, "limit": lim}
            for c, lim in [("alimentacao", 1200), ("transporte", 500), ("lazer", 400), ("compras", 600)]
        ])
    acc.pop("_id", None)
    return acc


@api.get("/accounts")
async def accounts(user=Depends(current_user)):
    ids, names, _ = await scope(user)
    items = await db.accounts.find({"user_id": {"$in": ids}}, {"_id": 0}).sort("connected_at", 1).to_list(100)
    return tag_owner(items, names)


@api.delete("/accounts/{account_id}")
async def disconnect(account_id: str, user=Depends(current_user)):
    res = await db.accounts.delete_one({"user_id": user["user_id"], "account_id": account_id})
    if not res.deleted_count:
        raise HTTPException(404, "Conta não encontrada")
    await db.transactions.delete_many({"user_id": user["user_id"], "account_id": account_id})
    return {"ok": True}


# ---------------------------------------------------------------- transactions
def month_start(dt=None):
    dt = dt or now()
    return dt.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


@api.get("/transactions")
async def list_transactions(category: Optional[str] = None, type: Optional[str] = None, member: Optional[str] = None,
                            user=Depends(current_user)):
    ids, names, _ = await scope(user)
    q = {"user_id": {"$in": [member] if member and member in ids else ids}}
    if category:
        q["category"] = category
    if type:
        q["type"] = type
    items = await db.transactions.find(q, {"_id": 0}).sort("date", -1).to_list(500)
    return tag_owner(items, names)


@api.post("/transactions")
async def add_transaction(body: TransactionIn, user=Depends(current_user)):
    ids, _, _ = await scope(user)
    tx = {
        "transaction_id": new_id("tx"), "user_id": user["user_id"], "account_id": body.account_id,
        "institution": "Manual", "description": body.description.strip(), "amount": round(body.amount, 2),
        "type": body.type, "category": body.category, "date": body.date or now().isoformat(), "source": "manual",
    }
    await db.transactions.insert_one(dict(tx))
    if body.account_id:
        delta = tx["amount"] if body.type == "income" else -tx["amount"]
        await db.accounts.update_one({"user_id": {"$in": ids}, "account_id": body.account_id}, {"$inc": {"balance": delta}})
    return tx


@api.delete("/transactions/{tx_id}")
async def delete_transaction(tx_id: str, user=Depends(current_user)):
    ids, _, _ = await scope(user)
    res = await db.transactions.delete_one({"user_id": {"$in": ids}, "transaction_id": tx_id})
    if not res.deleted_count:
        raise HTTPException(404, "Transação não encontrada")
    return {"ok": True}


async def month_summary(ids, start):
    end = (start + timedelta(days=32)).replace(day=1)
    txs = await db.transactions.find(
        {"user_id": {"$in": ids}, "date": {"$gte": start.isoformat(), "$lt": end.isoformat()}}, {"_id": 0}).to_list(1000)
    income = sum(t["amount"] for t in txs if t["type"] == "income")
    expense = sum(t["amount"] for t in txs if t["type"] == "expense")
    by_cat = {}
    for t in txs:
        if t["type"] == "expense":
            by_cat[t["category"]] = by_cat.get(t["category"], 0) + t["amount"]
    return round(income, 2), round(expense, 2), {k: round(v, 2) for k, v in by_cat.items()}


@api.get("/dashboard")
async def dashboard(user=Depends(current_user)):
    ids, names, h = await scope(user)
    accs = tag_owner(await db.accounts.find({"user_id": {"$in": ids}}, {"_id": 0}).to_list(100), names)
    income, expense, by_cat = await month_summary(ids, month_start())
    recent = tag_owner(await db.transactions.find({"user_id": {"$in": ids}}, {"_id": 0}).sort("date", -1).to_list(5), names)
    members = None
    if h:
        start, end = month_start().isoformat(), (month_start() + timedelta(days=32)).replace(day=1).isoformat()
        members = []
        for uid in ids:
            txs = await db.transactions.find({"user_id": uid, "date": {"$gte": start, "$lt": end}}, {"_id": 0, "amount": 1, "type": 1}).to_list(1000)
            members.append({"user_id": uid, "name": names.get(uid),
                            "income": round(sum(t["amount"] for t in txs if t["type"] == "income"), 2),
                            "expense": round(sum(t["amount"] for t in txs if t["type"] == "expense"), 2)})
    return {
        "total_balance": round(sum(a["balance"] for a in accs), 2),
        "accounts": accs, "month_income": income, "month_expense": expense,
        "by_category": sorted([{"category": k, "amount": v} for k, v in by_cat.items()], key=lambda x: -x["amount"]),
        "recent": recent,
        "household": {"household_id": h["household_id"], "name": h["name"], "members": members} if h else None,
    }


# ---------------------------------------------------------------- budgets & goals
@api.get("/budgets")
async def budgets(user=Depends(current_user)):
    ids, _, _ = await scope(user)
    items = await db.budgets.find({"user_id": {"$in": ids}}, {"_id": 0}).to_list(100)
    _, _, by_cat = await month_summary(ids, month_start())
    return [{**b, "spent": by_cat.get(b["category"], 0)} for b in items]


@api.post("/budgets")
async def upsert_budget(body: BudgetIn, user=Depends(current_user)):
    ids, _, _ = await scope(user)
    existing = await db.budgets.find_one({"user_id": {"$in": ids}, "category": body.category}, {"_id": 0})
    if existing:
        await db.budgets.update_one({"budget_id": existing["budget_id"]}, {"$set": {"limit": body.limit}})
        return {**existing, "limit": body.limit}
    b = {"budget_id": new_id("bud"), "user_id": user["user_id"], "category": body.category, "limit": body.limit}
    await db.budgets.insert_one(dict(b))
    return b


@api.delete("/budgets/{budget_id}")
async def delete_budget(budget_id: str, user=Depends(current_user)):
    ids, _, _ = await scope(user)
    await db.budgets.delete_one({"user_id": {"$in": ids}, "budget_id": budget_id})
    return {"ok": True}


@api.get("/goals")
async def goals(user=Depends(current_user)):
    ids, names, _ = await scope(user)
    items = await db.goals.find({"user_id": {"$in": ids}}, {"_id": 0}).sort("created_at", 1).to_list(100)
    return tag_owner(items, names)


@api.post("/goals")
async def create_goal(body: GoalIn, user=Depends(current_user)):
    g = {"goal_id": new_id("goal"), "user_id": user["user_id"], "name": body.name.strip(), "target": body.target,
         "current": 0.0, "deadline": body.deadline, "icon": body.icon, "created_at": now().isoformat()}
    await db.goals.insert_one(dict(g))
    return g


@api.post("/goals/{goal_id}/contribute")
async def contribute(goal_id: str, body: ContributeIn, user=Depends(current_user)):
    ids, _, _ = await scope(user)
    res = await db.goals.find_one_and_update(
        {"user_id": {"$in": ids}, "goal_id": goal_id}, {"$inc": {"current": round(body.amount, 2)}},
        projection={"_id": 0}, return_document=True)
    if not res:
        raise HTTPException(404, "Meta não encontrada")
    return res


@api.delete("/goals/{goal_id}")
async def delete_goal(goal_id: str, user=Depends(current_user)):
    ids, _, _ = await scope(user)
    await db.goals.delete_one({"user_id": {"$in": ids}, "goal_id": goal_id})
    return {"ok": True}


# ---------------------------------------------------------------- AI insights
MODELS = {
    "claude": ("anthropic", "claude-sonnet-4-5-20250929", "Claude Sonnet 4.5"),
    "gpt": ("openai", "gpt-5.2", "GPT-5.2"),
    "gemini": ("gemini", "gemini-3-flash-preview", "Gemini 3 Flash"),
}

SYSTEM_PROMPT = (
    "Você é Lumina, uma consultora financeira pessoal brasileira, clara e prática. "
    "Analise os dados financeiros do usuário (em BRL) e responda em português do Brasil. "
    "Seja objetiva: use títulos curtos, listas com marcadores e números concretos. "
    "Destaque padrões de gasto, alertas de orçamento, oportunidades de economia e progresso das metas. "
    "Não use tabelas. Máximo de ~250 palavras."
)


async def financial_context(user):
    ids, names, h = await scope(user)
    accs = await db.accounts.find({"user_id": {"$in": ids}}, {"_id": 0}).to_list(100)
    lines = []
    if h:
        lines.append(f"Finanças compartilhadas da casa '{h['name']}' com {len(ids)} membros: {', '.join(names.values())}. "
                     f"O usuário atual é {user['name']}.")
    lines.append(f"Saldo total: R$ {sum(a['balance'] for a in accs):.2f} em {len(accs)} conta(s): "
                 + ", ".join(f"{a['institution_name']} R$ {a['balance']:.2f}" + (f" ({names[a['user_id']]})" if names else "") for a in accs))
    start = month_start()
    s = start
    for i in range(3):
        inc, exp, cats = await month_summary(ids, s)
        cat_txt = ", ".join(f"{k}: R$ {v:.2f}" for k, v in sorted(cats.items(), key=lambda x: -x[1]))
        lines.append(f"Mês {s.strftime('%m/%Y')}{' (atual, parcial)' if i == 0 else ''}: receitas R$ {inc:.2f}, despesas R$ {exp:.2f}. Por categoria: {cat_txt or 'nenhuma'}")
        s = month_start(s - timedelta(days=1))
    if h:
        for uid in ids:
            inc, exp, _ = await month_summary([uid], start)
            lines.append(f"Mês atual de {names.get(uid)}: receitas R$ {inc:.2f}, despesas R$ {exp:.2f}")
    bud = await db.budgets.find({"user_id": {"$in": ids}}, {"_id": 0}).to_list(100)
    _, _, cur = await month_summary(ids, start)
    if bud:
        lines.append("Orçamentos do mês: " + ", ".join(f"{b['category']} gasto R$ {cur.get(b['category'], 0):.2f} de R$ {b['limit']:.2f}" for b in bud))
    gl = await db.goals.find({"user_id": {"$in": ids}}, {"_id": 0}).to_list(100)
    if gl:
        lines.append("Metas: " + ", ".join(f"{g['name']} R$ {g['current']:.2f}/R$ {g['target']:.2f}" + (f" até {g['deadline']}" if g.get('deadline') else "") for g in gl))
    return "\n".join(lines)


@api.post("/insights/stream")
async def insight_stream(body: InsightIn, user=Depends(current_user)):
    if body.model not in MODELS:
        raise HTTPException(400, "Modelo inválido")
    provider, model_name, label = MODELS[body.model]
    ctx = await financial_context(user)
    question = (body.question or "").strip() or "Gere uma análise completa da minha saúde financeira com recomendações personalizadas."
    insight_id = new_id("ins")
    chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=insight_id, system_message=SYSTEM_PROMPT).with_model(provider, model_name)
    msg = UserMessage(text=f"Dados financeiros:\n{ctx}\n\nPergunta: {question}")

    async def gen():
        full = []
        try:
            async for ev in chat.stream_message(msg):
                if isinstance(ev, TextDelta):
                    full.append(ev.content)
                    yield f"data: {json.dumps({'delta': ev.content})}\n\n"
                elif isinstance(ev, StreamDone):
                    break
            doc = {"insight_id": insight_id, "user_id": user["user_id"], "question": body.question or None,
                   "content": "".join(full), "model": body.model, "model_label": label, "created_at": now().isoformat()}
            await db.insights.insert_one(dict(doc))
            doc.pop("_id", None)
            yield f"data: {json.dumps({'done': True, 'insight': doc})}\n\n"
        except Exception as e:  # surface LLM failures to the client stream
            logger.exception("LLM error")
            yield f"data: {json.dumps({'error': str(e)[:200]})}\n\n"

    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@api.get("/insights")
async def list_insights(user=Depends(current_user)):
    ids, names, _ = await scope(user)
    items = await db.insights.find({"user_id": {"$in": ids}}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return tag_owner(items, names)


@api.delete("/insights/{insight_id}")
async def delete_insight(insight_id: str, user=Depends(current_user)):
    ids, _, _ = await scope(user)
    await db.insights.delete_one({"user_id": {"$in": ids}, "insight_id": insight_id})
    return {"ok": True}


@api.get("/")
async def root():
    return {"message": "FinAI API"}


app.include_router(api)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.user_sessions.create_index("session_token", unique=True)
    await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
    await db.transactions.create_index([("user_id", 1), ("date", -1)])
    await db.households.create_index("household_id", unique=True)
    await db.households.create_index("invite_code", unique=True)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

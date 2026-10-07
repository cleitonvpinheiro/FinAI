"""FinAI backend test suite - covers auth, open finance (mocked), transactions,
budgets, goals, dashboard and AI insights streaming."""
import os
import json
import time
import uuid
import requests
import pytest

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://fintech-intelligence-9.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

SEED_EMAIL = "teste@finai.com"
SEED_PASSWORD = "teste123"


@pytest.fixture(scope="session")
def seed_token():
    """Login the pre-existing seed user."""
    r = requests.post(f"{API}/auth/login", json={"email": SEED_EMAIL, "password": SEED_PASSWORD}, timeout=15)
    if r.status_code != 200:
        # register if missing
        requests.post(f"{API}/auth/register", json={"email": SEED_EMAIL, "password": SEED_PASSWORD, "name": "Teste"}, timeout=15)
        r = requests.post(f"{API}/auth/login", json={"email": SEED_EMAIL, "password": SEED_PASSWORD}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def seed_headers(seed_token):
    return {"Authorization": f"Bearer {seed_token}"}


# ---------------------------------------------------------------- AUTH
class TestAuth:
    def test_register_and_duplicate(self):
        email = f"test_user_{uuid.uuid4().hex[:8]}@example.com"
        r = requests.post(f"{API}/auth/register", json={"email": email, "password": "pass1234", "name": "TEST user"}, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "token" in data and data["user"]["email"] == email.lower()
        # duplicate
        r2 = requests.post(f"{API}/auth/register", json={"email": email, "password": "pass1234", "name": "TEST user"}, timeout=15)
        assert r2.status_code == 409

    def test_login_wrong(self):
        r = requests.post(f"{API}/auth/login", json={"email": "nouser@x.com", "password": "wrong"}, timeout=15)
        assert r.status_code == 401

    def test_me_requires_auth(self):
        r = requests.get(f"{API}/auth/me", timeout=15)
        assert r.status_code == 401

    def test_me_with_token(self, seed_headers):
        r = requests.get(f"{API}/auth/me", headers=seed_headers, timeout=15)
        assert r.status_code == 200
        assert r.json()["email"] == SEED_EMAIL


# ---------------------------------------------------------------- OPEN FINANCE
class TestOpenFinance:
    def test_institutions_list(self, seed_headers):
        r = requests.get(f"{API}/openfinance/institutions", headers=seed_headers, timeout=15)
        assert r.status_code == 200
        items = r.json()
        assert any(i["id"] == "nubank" for i in items)
        assert all("connected" in i for i in items)

    def test_connect_duplicate_409(self, seed_headers):
        # Nubank already connected per seed; expect 409
        r = requests.post(f"{API}/openfinance/connect", json={"institution_id": "nubank"}, headers=seed_headers, timeout=15)
        assert r.status_code == 409

    def test_connect_invalid_institution(self, seed_headers):
        r = requests.post(f"{API}/openfinance/connect", json={"institution_id": "bogus"}, headers=seed_headers, timeout=15)
        assert r.status_code == 404

    def test_connect_and_disconnect(self, seed_headers):
        # Try to connect itau; if already connected clean up first
        accs = requests.get(f"{API}/accounts", headers=seed_headers, timeout=15).json()
        existing = next((a for a in accs if a["institution_id"] == "itau"), None)
        if existing:
            requests.delete(f"{API}/accounts/{existing['account_id']}", headers=seed_headers, timeout=15)

        r = requests.post(f"{API}/openfinance/connect", json={"institution_id": "itau"}, headers=seed_headers, timeout=15)
        assert r.status_code == 200, r.text
        acc = r.json()
        assert acc["institution_id"] == "itau"
        assert "_id" not in acc

        # verify it appears
        accs2 = requests.get(f"{API}/accounts", headers=seed_headers, timeout=15).json()
        assert any(a["account_id"] == acc["account_id"] for a in accs2)

        # cleanup
        d = requests.delete(f"{API}/accounts/{acc['account_id']}", headers=seed_headers, timeout=15)
        assert d.status_code == 200


# ---------------------------------------------------------------- TRANSACTIONS
class TestTransactions:
    def test_list_and_filters(self, seed_headers):
        r = requests.get(f"{API}/transactions", headers=seed_headers, timeout=15)
        assert r.status_code == 200
        txs = r.json()
        assert isinstance(txs, list) and len(txs) > 0

        r2 = requests.get(f"{API}/transactions?type=expense", headers=seed_headers, timeout=15)
        assert r2.status_code == 200
        assert all(t["type"] == "expense" for t in r2.json())

        r3 = requests.get(f"{API}/transactions?category=alimentacao", headers=seed_headers, timeout=15)
        assert r3.status_code == 200
        assert all(t["category"] == "alimentacao" for t in r3.json())

    def test_create_and_balance_update_and_delete(self, seed_headers):
        accs = requests.get(f"{API}/accounts", headers=seed_headers, timeout=15).json()
        assert accs, "need at least one account"
        acc_id = accs[0]["account_id"]
        before = accs[0]["balance"]

        payload = {"description": "TEST_tx_desc", "amount": 50.0, "type": "expense",
                   "category": "lazer", "account_id": acc_id}
        r = requests.post(f"{API}/transactions", json=payload, headers=seed_headers, timeout=15)
        assert r.status_code == 200
        tx = r.json()
        assert tx["description"] == "TEST_tx_desc"
        tx_id = tx["transaction_id"]

        accs2 = requests.get(f"{API}/accounts", headers=seed_headers, timeout=15).json()
        after = next(a for a in accs2 if a["account_id"] == acc_id)["balance"]
        assert round(after, 2) == round(before - 50.0, 2), f"expected {before - 50.0}, got {after}"

        d = requests.delete(f"{API}/transactions/{tx_id}", headers=seed_headers, timeout=15)
        assert d.status_code == 200

    def test_delete_404(self, seed_headers):
        r = requests.delete(f"{API}/transactions/tx_nonexistent", headers=seed_headers, timeout=15)
        assert r.status_code == 404


# ---------------------------------------------------------------- DASHBOARD
class TestDashboard:
    def test_dashboard_shape(self, seed_headers):
        r = requests.get(f"{API}/dashboard", headers=seed_headers, timeout=15)
        assert r.status_code == 200
        d = r.json()
        for k in ("total_balance", "accounts", "month_income", "month_expense", "by_category", "recent"):
            assert k in d
        assert isinstance(d["recent"], list)


# ---------------------------------------------------------------- BUDGETS
class TestBudgets:
    def test_upsert_and_delete(self, seed_headers):
        r = requests.post(f"{API}/budgets", json={"category": "educacao", "limit": 300.0}, headers=seed_headers, timeout=15)
        assert r.status_code == 200
        b = r.json()
        bid = b["budget_id"]

        # upsert again - same budget_id
        r2 = requests.post(f"{API}/budgets", json={"category": "educacao", "limit": 400.0}, headers=seed_headers, timeout=15)
        assert r2.status_code == 200
        assert r2.json()["budget_id"] == bid
        assert r2.json()["limit"] == 400.0

        # list contains spent
        lst = requests.get(f"{API}/budgets", headers=seed_headers, timeout=15).json()
        edu = next(x for x in lst if x["category"] == "educacao")
        assert "spent" in edu

        # cleanup
        requests.delete(f"{API}/budgets/{bid}", headers=seed_headers, timeout=15)


# ---------------------------------------------------------------- GOALS
class TestGoals:
    def test_create_contribute_delete(self, seed_headers):
        r = requests.post(f"{API}/goals",
                          json={"name": "TEST_goal", "target": 1000.0, "icon": "flag"},
                          headers=seed_headers, timeout=15)
        assert r.status_code == 200
        g = r.json()
        gid = g["goal_id"]
        assert g["current"] == 0.0

        r2 = requests.post(f"{API}/goals/{gid}/contribute", json={"amount": 150.0},
                           headers=seed_headers, timeout=15)
        assert r2.status_code == 200
        assert r2.json()["current"] == 150.0

        # list persist
        lst = requests.get(f"{API}/goals", headers=seed_headers, timeout=15).json()
        assert any(x["goal_id"] == gid and x["current"] == 150.0 for x in lst)

        d = requests.delete(f"{API}/goals/{gid}", headers=seed_headers, timeout=15)
        assert d.status_code == 200

    def test_contribute_not_found(self, seed_headers):
        r = requests.post(f"{API}/goals/goal_missing/contribute", json={"amount": 10},
                          headers=seed_headers, timeout=15)
        assert r.status_code == 404


# ---------------------------------------------------------------- INSIGHTS SSE
class TestInsights:
    def _stream(self, model, seed_headers):
        url = f"{API}/insights/stream"
        headers = {**seed_headers, "Accept": "text/event-stream"}
        with requests.post(url, json={"model": model}, headers=headers, stream=True, timeout=120) as r:
            assert r.status_code == 200, r.text
            deltas = 0
            done = None
            err = None
            start = time.time()
            for line in r.iter_lines(decode_unicode=True):
                if not line or not line.startswith("data: "):
                    continue
                payload = json.loads(line[6:])
                if "delta" in payload:
                    deltas += 1
                elif "done" in payload:
                    done = payload["insight"]
                    break
                elif "error" in payload:
                    err = payload["error"]
                    break
                if time.time() - start > 110:
                    break
            return deltas, done, err

    def test_invalid_model(self, seed_headers):
        r = requests.post(f"{API}/insights/stream", json={"model": "nope"}, headers=seed_headers, timeout=15)
        assert r.status_code == 400

    @pytest.mark.parametrize("model", ["claude", "gpt", "gemini"])
    def test_stream_models(self, model, seed_headers):
        deltas, done, err = self._stream(model, seed_headers)
        if err:
            pytest.fail(f"{model} stream error: {err}")
        assert deltas > 0, f"no delta events for {model}"
        assert done and done.get("content"), f"no final insight for {model}"
        # cleanup
        requests.delete(f"{API}/insights/{done['insight_id']}", headers=seed_headers, timeout=15)

    def test_list_insights(self, seed_headers):
        r = requests.get(f"{API}/insights", headers=seed_headers, timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

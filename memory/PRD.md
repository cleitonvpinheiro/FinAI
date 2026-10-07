# FinAI — Gestão Financeira Inteligente (PRD)

## Problema original
App mobile Expo (JS) de gestão financeira pessoal em português: dashboard de saldo/transações, orçamentos por categoria, metas de economia, insights com IA (Claude Sonnet 4.5 via Emergent LLM Key; GPT-5.2 e Gemini 3 Flash como opções), Open Finance mock (integração real futura), login e-mail/senha (JWT) + Google (Emergent), tema escuro.

## Personas
- Pessoa que quer visão consolidada das finanças com ajuda de IA.
- Casais/famílias que dividem despesas e querem ver tudo junto (feature "Casa").

## Arquitetura
- Backend: FastAPI + MongoDB (`/app/backend/server.py`), rotas prefixadas `/api`.
- Frontend: Expo Router (`/app/frontend/app`), componentes em `/app/frontend/src/ui.jsx`, tema `/app/frontend/src/theme.ts`, auth context `/app/frontend/src/auth.jsx`, cliente API `/app/frontend/src/api.js`.
- IA: `emergentintegrations` LlmChat com streaming SSE (`POST /api/insights/stream`).

## Modelo de dados (Mongo)
users, user_sessions, accounts, transactions, budgets, goals, insights, households
`households`: {household_id, name, owner_id, member_ids[], invite_code(6), created_at}; `users.household_id`.

## Escopo de dados compartilhado (Casa)
Toda leitura/escrita de accounts, transactions, dashboard, budgets, goals e insights usa `scope(user)` = ids dos membros da casa (ou só o próprio usuário). Itens recebem `owner_name` quando há casa.

## Implementado
- [x] Auth e-mail/senha JWT + Google (Emergent) + sessão persistida
- [x] Open Finance mock (8 bancos, contas e transações geradas)
- [x] Dashboard, transações (filtros, detalhe, exclusão), transação manual
- [x] Orçamentos (CRUD) e metas (criar, aportar, excluir)
- [x] Insights IA com streaming (Claude/GPT/Gemini) e histórico
- [x] Casa compartilhada: criar casa, código de convite (copiar/compartilhar), entrar via código, lista de membros, remover membro (dono), sair; dashboard com resumo por membro; nome do membro nas transações; IA considera finanças da casa

## Backlog
- Open Finance real (Pluggy/Belvo) quando solicitado
- Editar nome da casa / regenerar código de convite
- Filtro por membro na tela de transações (API já aceita `?member=`)
- Categorias personalizadas, recorrências, exportação

# My Dashboard

Personal health & finances dashboard: workouts, calories, and weight tracking, plus a full finances suite — cash flow, budgets, credit cards, net worth projections, Roth/401k contributions, and Plaid-linked accounts.

## Structure
- `backend/` — Vapor (Swift) REST API (port 8080)
- `web/` — Next.js web app (port 3000)
- `ios/` — SwiftUI iOS app

## Setup

1. **Configure the backend** — copy `backend/.env.example` to `backend/.env` and fill in your values:
   - `HEALTH_JWT_SECRET`: any long random string (`openssl rand -hex 32`)
   - `PLAID_CLIENT_ID` / `PLAID_SECRET`: your own keys from the [Plaid dashboard](https://dashboard.plaid.com/developers/keys) (free sandbox tier works)
   - `ALLOW_REGISTER=true` while creating your account, then remove it
2. **(Optional) Configure the web app** — copy `web/.env.local.example` to `web/.env.local` if you want the apartment agent.
3. **Install web dependencies**: `cd web && npm install`
4. **Run everything**:

```bash
./start.sh
```

This starts the Vapor backend on port 8080 and the Next.js app on port 3000. Stop with `./stop.sh` (or Ctrl-C).

The SQLite databases (`backend/db.sqlite`, `web/data/`) are created automatically on first run and stay local — they are never committed.

5. **Create your account**: visit http://localhost:3000, register, then set your personal details (birth year, pay schedule, rates, etc.) in the admin settings page.

## API quick test

```bash
# Register
curl -X POST http://localhost:8080/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@example.com","password":"password123"}'

# Login (returns token)
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Log weight (use token from login response)
curl -X POST http://localhost:8080/api/v1/weight \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"weightLbs":185.5}'
```

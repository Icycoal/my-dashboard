---
name: setup
description: Set up My Dashboard from a fresh clone — env files, Plaid keys, first account, and every personal setting in the admin DB. Use when the user asks to install, configure, personalize, or troubleshoot first-run of this app.
---

# My Dashboard setup

Walk the user through a complete first-run setup. Do the mechanical steps yourself (files, commands, curl checks); ask the user only for personal values and anything requiring their browser (Plaid signup, registering).

## 1. Prerequisites

Check and report before starting:

```bash
swift --version   # Swift 5.9+ (macOS: comes with Xcode command line tools)
node --version    # Node 18+
```

## 2. Backend env — `backend/.env`

```bash
cp backend/.env.example backend/.env
```

Fill in:
- `HEALTH_JWT_SECRET` — generate it: `openssl rand -hex 32`
- `ALLOW_REGISTER=true` — required for step 5; **removed again in step 5**
- Plaid keys — next step (the app runs fine without them; only bank-linking is disabled)

## 3. Plaid keys (optional but recommended)

The user must do this in a browser:
1. Create a free account at https://dashboard.plaid.com/signup
2. Go to https://dashboard.plaid.com/developers/keys
3. Copy the **client_id** and the **Sandbox** secret

Put them in `backend/.env` as `PLAID_CLIENT_ID`, `PLAID_SECRET`, and `PLAID_ENV=sandbox`.

Sandbox links fake banks (user/pass `user_good` / `pass_good` in the Plaid Link dialog) — good for trying the app. Linking real banks requires requesting Production access in the Plaid dashboard (free tier exists but Plaid reviews the request), then swapping in the production secret and `PLAID_ENV=production`.

## 4. Web app

```bash
cd web && npm install
```

Optional: `cp web/.env.local.example web/.env.local` and add a `CLAUDE_CODE_OAUTH_TOKEN` (from `claude setup-token`) — only needed for the apartment-hunting agent on `/apartments`.

## 5. First run and account creation

```bash
./start.sh   # from the repo root
```

First run compiles the Swift backend (several minutes) and builds Next.js. Ready when:
- backend: `curl -s -o /dev/null -w '%{http_code}' -X POST localhost:8080/api/v1/auth/login -H 'Content-Type: application/json' -d '{}'` returns `401`
- web: http://localhost:3000 loads

There is no register UI — create the account via the API (ask the user for name/email and have them type a password; don't invent one):

```bash
curl -X POST localhost:8080/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"<name>","email":"<email>","password":"<password>"}'
```

Then have the user log in at http://localhost:3000. **Once their login works, remove the `ALLOW_REGISTER` line from `backend/.env`** — otherwise anyone on their network can create accounts. Restart with `./stop.sh && ./start.sh` for it to take effect.

Data lives in `backend/db.sqlite` (finance/health state) and `web/data/dashboard.db` (settings). Both are gitignored; deleting them resets the app.

## 6. Personalize the settings DB

All settings are edited in the UI at **http://localhost:3000/admin/settings** (grouped by category), or in bulk via `PUT /api/admin/settings/rows`. Defaults are seeded on first run with neutral values — the ones below **must** be personalized for projections to be correct:

| Key | Set it to |
|---|---|
| `finances.birth_year` / `finances.birth_month` | User's real birth year and month (drives age labels and the HSA family→individual switch at 26) |
| `finances.contrib_401k_start_year` | First year the user is 401k-eligible |
| `finances.last_monthly_pay_year` / `_month` / `finances.monthly_pay_day` | Only relevant if the user is paid monthly for a while before switching to biweekly; otherwise set year/month in the past |
| `finances.default_employee_401k_pct` / `_employer_match_pct` | Their plan's percentages |
| `finances.hysa_savings_rate` | Their savings account APY as a decimal (0.04 = 4%) |
| `finances.surplus_brokerage_ratio` / `_savings_ratio` | How monthly surplus is auto-split in projections (must sum to 1) |

Usually fine as defaults, review with the user if they care:
- `finances.default_mortgage_rate_pct`, `default_loan_term_years`, `default_appreciation_rate_pct`, `budget_warning_threshold_pct`
- `tax.*` — FICA rates, SS wage base by year, standard deduction by year, federal brackets (single + married). Update when the IRS publishes new numbers.
- `contributions.*` — Roth IRA / 401k / HSA limits by year.
- `algorithm.*` — the 13F stock-research tool on `/finances/research`: curated fund managers (JSON list of CIK + tier), scoring weights, portfolio size. Purely optional.
- `apartments.*` — utility-cost baselines for the apartment comparer. Purely optional.

## 7. In-app finance data (stored per-account in the backend, not in settings)

In **Finances → Cash Flow**, the pay section configures the paycheck engine: hourly rate, hours/day, pay day, biweekly start date, filing status, and per-paycheck 401k/Roth/HSA/Roth-IRA contributions. Then set the current checking balance, and add credit cards, monthly bills, recurring payments, and budgets in their tabs. Net worth, contributions, and analytics pages derive from these.

## 8. Link banks (if Plaid configured)

**Finances → Accounts** → connect via Plaid Link, then sync. Sandbox: any fake institution with `user_good` / `pass_good`.

## Troubleshooting

- **Port in use**: `./stop.sh` kills both services (3000 = Next, 8080 = Vapor).
- **Swift build errors**: needs full Xcode or CLT on macOS; on Linux, Swift 5.9+ toolchain.
- **`next start` standalone warning** in logs: harmless for local use.
- **401 on everything after login**: JWT secret changed after registering — tokens are invalidated, log in again.
- **Settings changes not showing**: the web app fetches settings on page load — hard-refresh the browser.

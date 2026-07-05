# Agent instructions — My Dashboard

Personal health & finances dashboard. Swift/Vapor backend (`backend/`, port 8080), Next.js web app (`web/`, port 3000), SwiftUI iOS app (`ios/`).

## Setting up for a new user

Follow the step-by-step guide in **`.claude/skills/setup/SKILL.md`** — it covers env files, Plaid keys, first account creation (API-only, there is no register UI), and every setting that must be personalized in the admin DB at `/admin/settings`. Do the mechanical steps yourself; ask the user for personal values (birthday, pay details, Plaid keys) and never invent passwords.

## Rules

- Always run the app with `./start.sh` from the repo root (stop with `./stop.sh`). Don't start the backend or frontend individually.
- Never commit `backend/.env`, `web/.env.local`, or any `*.sqlite`/`*.db` file — user data and secrets live there. The `.env.example` files are the committed templates.
- User-specific values (birthday, rates, pay schedule) belong in the settings DB (seeded in `web/src/lib/db.ts`, edited at `/admin/settings`), never hardcoded in source. Code defaults must stay neutral.
- Financial state is one JSON blob per account in `backend/db.sqlite` (`finance_states.data`); web-side settings live in `web/data/dashboard.db`. Both are created on first run and gitignored.

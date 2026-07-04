# Health Tracker Web

Next.js 15 (App Router) + TypeScript + Tailwind + Recharts.

## Setup

```bash
npm install
npm run dev
```

App runs at http://localhost:3000. Backend is expected at `http://127.0.0.1:8080/api/v1` — override with:

```bash
NEXT_PUBLIC_API_URL=https://your-api/api/v1 npm run dev
```

## Pages

- `/login` — register / sign in
- `/` — dashboard (today's calories, protein, latest weight, recent workouts)
- `/weight` — log weight, 30-day trend chart
- `/workouts` — log workouts with exercises and sets
- `/food` — USDA food search, per-serving logging

## Auth

JWT is stored in `localStorage` under `ht.token` and sent as `Authorization: Bearer` on every request.

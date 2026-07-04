#!/usr/bin/env bash
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"

PIDS=()
cleanup() {
  echo ""
  echo "Shutting down all services..."
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
}
trap cleanup EXIT INT TERM

# --- Vapor backend (port 8080) ---
if [ ! -f "$ROOT/backend/.env" ]; then
  echo "Missing backend/.env — copy backend/.env.example and fill in your values." >&2
  exit 1
fi
echo "[health] Starting Vapor backend (port 8080)..."
set -a; source "$ROOT/backend/.env"; set +a
cd "$ROOT/backend"
swift run App &
PIDS+=($!)

# --- Next.js frontend (port 3000) ---
# Dev mode compiles each page on first visit (slow) — serve the optimized
# build instead, rebuilding only when sources changed since the last build.
cd "$ROOT/web"
if [ ! -f .next/BUILD_ID ] || [ -n "$(find src package.json next.config.js tailwind.config.ts -newer .next/BUILD_ID -print -quit 2>/dev/null)" ]; then
  echo "[ui] Sources changed — building Next.js frontend..."
  npm run build
fi
echo "[ui] Starting Next.js frontend (port 3000)..."
npm run start

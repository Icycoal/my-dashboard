#!/usr/bin/env bash
echo "Stopping all dashboard services..."

# Next.js frontend (port 3000)
pkill -f "next start" 2>/dev/null && echo "  [ui] Next.js stopped" || echo "  [ui] Next.js was not running"

# Vapor backend (port 8080)
pkill -f "swift run App" 2>/dev/null
pkill -f "\.build.*App" 2>/dev/null && echo "  [health] Vapor backend stopped" || echo "  [health] Vapor was not running"

echo "Done."

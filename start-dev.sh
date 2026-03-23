#!/usr/bin/env bash
# Aegis-Link — local dev: Redis check, dedup binary, engine + API.
# Run the frontend in another terminal: cd frontend && npm run dev

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$ROOT/backend"
cd "$BACKEND"

if ! command -v redis-cli &>/dev/null; then
  echo "redis-cli not found. Install Redis (e.g. brew install redis) and ensure redis-cli is on PATH."
  exit 1
fi
if ! redis-cli ping 2>/dev/null | grep -q PONG; then
  echo "Redis is not responding. Start it first, e.g.: brew services start redis"
  exit 1
fi

if [[ -f .venv/bin/activate ]]; then
  # shellcheck source=/dev/null
  source .venv/bin/activate
elif [[ -f venv/bin/activate ]]; then
  # shellcheck source=/dev/null
  source venv/bin/activate
fi

if [[ ! -f .env ]]; then
  echo "No backend/.env file. Copy backend/.env.example to backend/.env and set at least JWT_SECRET."
  exit 1
fi

if [[ -f dedup_filter.cpp && -f compile-dedup.sh ]]; then
  if bash ./compile-dedup.sh; then
    :
  else
    echo "Note: dedup_filter build failed. Install Xcode CLT + brew install openssl@3, then: cd backend && bash ./compile-dedup.sh"
  fi
fi

mkdir -p logs

PRED_PID=""
TG_CHAT_PID=""
cleanup() {
  if [[ -n "${PRED_PID}" ]] && kill -0 "${PRED_PID}" 2>/dev/null; then
    kill "${PRED_PID}" 2>/dev/null || true
  fi
  if [[ -n "${TG_CHAT_PID}" ]] && kill -0 "${TG_CHAT_PID}" 2>/dev/null; then
    kill "${TG_CHAT_PID}" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

echo "Starting prediction engine (collectors + predictor) in background..."
python3 predictor.py &
PRED_PID=$!

# Telegram: reply to /start with chat ID (needs TELEGRAM_BOT_TOKEN in .env)
if python3 -c "from config import TELEGRAM_BOT_TOKEN; import sys; sys.exit(0 if (TELEGRAM_BOT_TOKEN or '').strip() else 1)" 2>/dev/null; then
  echo "Starting Telegram chat-id bot (/start → your chat ID)…"
  python3 telegram_chat_bot.py &
  TG_CHAT_PID=$!
fi

sleep 2

echo "API: http://127.0.0.1:8000  (docs: /docs)"
echo "In another terminal: cd frontend && npm run dev"
uvicorn api:app --host 0.0.0.0 --port 8000 --reload

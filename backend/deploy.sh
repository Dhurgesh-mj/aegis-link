#!/bin/bash
# backend/deploy.sh
# Aegis-Link — Full deployment script
set -e

echo "=== AEGIS-LINK DEPLOY ==="

# Dependencies
apt-get update -qq
apt-get install -y redis-server libssl-dev build-essential python3-pip

# Compile C++ (Linux: g++; macOS: use compile-dedup.sh locally)
echo "Compiling dedup_filter..."
if [[ -f compile-dedup.sh ]]; then
  bash ./compile-dedup.sh
else
  g++ -O2 -std=c++17 -o dedup_filter dedup_filter.cpp -lssl -lcrypto
fi
echo "Compiled OK"

# Python deps
pip install -r requirements.txt

# Redis
systemctl start redis
systemctl enable redis

# Create logs dir
mkdir -p logs

# ── Systemd services ──────────────────────────────────
SERVICES=(collector predictor discord telegram dashboard api logs)
COMMANDS=(
  "python3 collector.py"
  "python3 predictor.py"
  "python3 subscribers/discord_sub.py"
  "python3 subscribers/telegram_sub.py"
  "python3 subscribers/dashboard_sub.py"
  "uvicorn api:app --host 0.0.0.0 --port 8000 --workers 1"
  "python3 subscribers/log_sub.py"
)

WORK_DIR="$(pwd)"

for i in "${!SERVICES[@]}"; do
  SVC="${SERVICES[$i]}"
  CMD="${COMMANDS[$i]}"

  cat > "/etc/systemd/system/aegis-${SVC}.service" <<EOF
[Unit]
Description=Aegis-Link ${SVC}
After=network.target redis.service

[Service]
Type=simple
WorkingDirectory=${WORK_DIR}
ExecStart=/usr/bin/env ${CMD}
Restart=always
RestartSec=5
Environment=PYTHONUNBUFFERED=1

[Install]
WantedBy=multi-user.target
EOF

  echo "Created aegis-${SVC}.service"
done

# Reload and enable all services
systemctl daemon-reload

for SVC in "${SERVICES[@]}"; do
  systemctl enable "aegis-${SVC}"
  systemctl start "aegis-${SVC}"
  echo "Started aegis-${SVC}"
done

echo ""
echo "=== ALL SERVICES STARTED ==="
systemctl status aegis-collector aegis-api --no-pager

#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if [[ ! -f .env ]]; then
  echo "[ShopShot] Missing .env — run: cp .env.example .env"
  echo "Then set VOLC_API_KEY, DOUBAO_SEED_EP, DOUBAO_SEEDANCE_EP"
  exit 1
fi

echo "[ShopShot] Building and starting Docker..."
docker compose up -d --build

echo ""
echo "[ShopShot] Ready: http://localhost:8000"
echo "  Health: http://localhost:8000/health"
echo "  Logs:   docker compose logs -f shopshot"
echo "  Stop:   docker compose down"

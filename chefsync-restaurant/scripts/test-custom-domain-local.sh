#!/usr/bin/env bash
# Full local test for custom domain routing (Sprint 3A)
#
# Section 6 (browser/Vite) requires ./start.sh running in ANOTHER terminal first.
#
# Usage:
#   ./start.sh                                    # terminal 1
#   ./scripts/test-custom-domain-local.sh --seed  # terminal 2

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"

SEED=false
CLEANUP=false
BASE_URL=""
TENANT="pizza-palace"
DOMAIN="pizza-abc.co.il"
FRONTEND_PORT=5173

while [[ $# -gt 0 ]]; do
  case "$1" in
    --seed) SEED=true; shift ;;
    --cleanup) CLEANUP=true; shift ;;
    --base-url) BASE_URL="$2"; shift 2 ;;
    --tenant) TENANT="$2"; shift 2 ;;
    --domain) DOMAIN="$2"; shift 2 ;;
    --frontend-port) FRONTEND_PORT="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: $0 [--seed] [--cleanup] [--base-url URL] [--tenant ID] [--domain HOST]"
      exit 0
      ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

port_in_use() {
  lsof -Pi ":$1" -sTCP:LISTEN -t >/dev/null 2>&1
}

if [[ -z "$BASE_URL" ]]; then
  for port in 8000 8001 8002 8003; do
    if port_in_use "$port"; then
      code="$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:${port}/api/restaurants" 2>/dev/null || echo 000)"
      if [[ "$code" == "200" || "$code" == "400" ]]; then
        BASE_URL="http://localhost:${port}/api"
        break
      fi
    fi
  done
fi

if [[ -z "$BASE_URL" ]]; then
  echo "❌ No TakeEat API detected on ports 8000–8003. Start ./start.sh first."
  exit 1
fi

echo "Using API: $BASE_URL"
echo ""

cd "$BACKEND_DIR"

ARGS=(domains:test-local "--base-url=$BASE_URL" "--tenant=$TENANT" "--domain=$DOMAIN" "--frontend-port=$FRONTEND_PORT")

if [[ "$SEED" == true ]]; then
  ARGS+=(--seed)
fi

if [[ "$CLEANUP" == true ]]; then
  ARGS+=(--cleanup)
fi

php artisan "${ARGS[@]}"

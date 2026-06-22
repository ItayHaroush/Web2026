#!/bin/bash
# Quick Start Script for TakeEat

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

port_in_use() {
    lsof -Pi ":$1" -sTCP:LISTEN -t >/dev/null 2>&1
}

pick_backend_port() {
    local port
    for port in 8000 8001 8002 8003; do
        if ! port_in_use "$port"; then
            echo "$port"
            return 0
        fi
    done
    return 1
}

echo "🚀 TakeEat - Quick Start"
echo "========================"

# Frontend Setup
echo ""
echo "📦 Setting up Frontend..."
cd "$SCRIPT_DIR/frontend"
npm install
echo "✅ Frontend ready"

# Backend Setup
echo ""
echo "🔧 Setting up Backend..."
cd "$SCRIPT_DIR/backend"
composer install --no-interaction
if [ ! -f .env ]; then
    cp .env.example .env
    php artisan key:generate
fi
echo "✅ Backend ready"

# Pick a free port (8000 may be used by another local project, e.g. Buildix)
BACKEND_PORT="$(pick_backend_port)" || {
    echo "❌ No free port found (tried 8000–8003). Stop another PHP server and retry."
    exit 1
}

if port_in_use 8000 && [ "$BACKEND_PORT" != "8000" ]; then
    echo ""
    echo "⚠️  Port 8000 is already in use by another app."
    echo "   TakeEat backend will use port $BACKEND_PORT instead."
fi

API_URL="http://localhost:${BACKEND_PORT}/api"

# Start Backend in background
echo ""
echo "🖥️  Starting TakeEat Backend on $API_URL ..."
php artisan serve --host=127.0.0.1 --port="$BACKEND_PORT" &
BACKEND_PID=$!
sleep 1

if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    echo "❌ Backend failed to start on port $BACKEND_PORT"
    exit 1
fi

# Sanity check — ensure this is the TakeEat API, not another project on the same port
HTTP_CODE="$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/restaurants" 2>/dev/null || echo "000")"
if [ "$HTTP_CODE" = "404" ]; then
    BODY="$(curl -s "$API_URL/restaurants" 2>/dev/null || true)"
    if echo "$BODY" | grep -q "could not be found"; then
        echo "❌ Port $BACKEND_PORT responds but is NOT the TakeEat API (wrong Laravel project?)."
        kill "$BACKEND_PID" 2>/dev/null
        exit 1
    fi
fi

echo "   Backend PID: $BACKEND_PID"

# Start Frontend
echo ""
echo "🌐 Starting Frontend on http://localhost:5173 ..."
echo "   API → $API_URL"
echo ""
echo "🧪 Custom domain local test (after server is up):"
echo "   ./scripts/test-custom-domain-local.sh --seed"
echo "   Add to /etc/hosts: 127.0.0.1 pizza-abc.co.il"
echo "   Then open: http://pizza-abc.co.il:5173"
echo ""
cd "$SCRIPT_DIR/frontend"

# Kill backend when frontend exits
trap "echo ''; echo '🛑 Stopping backend...'; kill $BACKEND_PID 2>/dev/null" EXIT

VITE_API_URL="$API_URL" VITE_API_URL_LOCAL="$API_URL" npm run dev

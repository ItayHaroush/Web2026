#!/bin/bash
# Quick Start Script for TakeEat

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

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

# Start Backend in background
echo ""
echo "🖥️  Starting Backend on http://localhost:8000 ..."
php artisan serve --host=127.0.0.1 --port=8000 &
BACKEND_PID=$!
echo "   Backend PID: $BACKEND_PID"

# Start Frontend
echo ""
echo "🌐 Starting Frontend on http://localhost:5173 ..."
echo ""
cd "$SCRIPT_DIR/frontend"

# Kill backend when frontend exits
trap "echo ''; echo '🛑 Stopping backend...'; kill $BACKEND_PID 2>/dev/null" EXIT

npm run dev

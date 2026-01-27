#!/bin/bash
# Quick Start Script for TakeEat

set -e

echo "🚀 TakeEat - Quick Start"
echo "========================"

# Frontend Setup
echo ""
echo "📦 Setting up Frontend..."
cd frontend
npm install
echo "✅ Frontend ready"

# Backend reminder
echo ""
echo "🔧 Backend Setup (Manual)"
echo "========================"
echo ""
echo "Run the following in another terminal:"
echo ""
echo "  cd backend"
echo "  composer install"
echo "  cp .env.example .env"
echo "  php artisan key:generate"
echo "  php artisan migrate"
echo "  php artisan db:seed --class=RestaurantSeeder"
echo "  php artisan serve"
echo ""

# Start Frontend
echo ""
echo "🌐 Starting Frontend..."
echo "🎯 Open: http://localhost:5173"
echo ""
npm run dev

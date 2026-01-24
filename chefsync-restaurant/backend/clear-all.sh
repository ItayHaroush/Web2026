#!/bin/bash

echo "🧹 Clearing all Laravel caches..."

php artisan config:clear
php artisan cache:clear
php artisan route:clear
php artisan view:clear

echo "✅ All caches cleared successfully!"

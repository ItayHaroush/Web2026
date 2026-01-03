<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\MenuController;
use App\Http\Controllers\OrderController;
use App\Http\Controllers\RestaurantController;

/**
 * API Routes
 * 
 * כל בקשה חייבת להכיל Header X-Tenant-ID
 * דוגמה: curl -H "X-Tenant-ID: restaurant-1" http://localhost:8000/api/menu
 */

// הרשם את Middleware Tenant לכל הנתיבים
Route::middleware(['api', 'tenant'])->group(function () {

    // ============================================
    // תפריט - ללקוחות
    // ============================================
    Route::get('/menu', [MenuController::class, 'getMenu'])->name('menu.get');

    // ============================================
    // הזמנות - ללקוחות
    // ============================================
    Route::post('/orders', [OrderController::class, 'store'])->name('orders.store');
    Route::get('/orders/{id}', [OrderController::class, 'show'])->name('orders.show');

    // ============================================
    // הזמנות - למנהלי מסעדה
    // ============================================
    Route::get('/restaurant/orders', [OrderController::class, 'restaurantIndex'])->name('orders.restaurant');
    Route::patch('/orders/{id}/status', [OrderController::class, 'updateStatus'])->name('orders.status');

    // ============================================
    // ממשק מסעדה - דרוש אימות
    // ============================================
    Route::middleware('auth:sanctum')->group(function () {
        Route::get('/restaurant', [RestaurantController::class, 'show'])->name('restaurant.show');
        Route::patch('/restaurant', [RestaurantController::class, 'update'])->name('restaurant.update');
        Route::patch('/menu-items/{id}', [MenuController::class, 'updateItemAvailability'])->name('menu.item.update');
    });
});

// Health Check
Route::get('/health', function () {
    return response()->json(['status' => 'ok']);
});

// רשימת מסעדות - ללא צורך ב-tenant
Route::get('/restaurants', [RestaurantController::class, 'index'])->name('restaurants.index');

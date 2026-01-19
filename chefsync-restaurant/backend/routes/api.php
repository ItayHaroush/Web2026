<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\MenuController;
use App\Http\Controllers\OrderController;
use App\Http\Controllers\RestaurantController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\AdminController;
use App\Http\Controllers\SuperAdminController;
use App\Http\Controllers\SuperAdminBillingController;
use App\Http\Controllers\SuperAdminNotificationController;
use App\Http\Controllers\RegisterRestaurantController;
use App\Http\Controllers\FcmTokenController;

/**
 * API Routes
 * 
 * כל בקשה חייבת להכיל Header X-Tenant-ID
 * דוגמה: curl -H "X-Tenant-ID: restaurant-1" http://localhost:8000/api/menu
 */

// ============================================
// אימות - Auth Routes
// ============================================
Route::prefix('auth')->group(function () {
    Route::post('/login', [AuthController::class, 'login'])->name('auth.login');
    // אימות טלפון - בקשת קוד ואימות קוד (ציבורי להזמנות)
    Route::post('/phone/request', [\App\Http\Controllers\PhoneAuthController::class, 'requestCode']);
    Route::post('/phone/verify', [\App\Http\Controllers\PhoneAuthController::class, 'verifyCode']);
    // Preflight CORS
    Route::options('/phone/request', fn() => response()->json(['success' => true]));
    Route::options('/phone/verify', fn() => response()->json(['success' => true]));

    Route::middleware('auth:sanctum')->group(function () {
        Route::post('/logout', [AuthController::class, 'logout'])->name('auth.logout');
        Route::get('/me', [AuthController::class, 'me'])->name('auth.me');
        Route::put('/update', [AuthController::class, 'update'])->name('auth.update');
        Route::post('/register', [AuthController::class, 'register'])->name('auth.register');
    });
});

// הרשמת מסעדה חדשה (ציבורי)
Route::post('/register-restaurant', [RegisterRestaurantController::class, 'store'])->name('register.restaurant');

// ערים - ציבורי (לשימוש בטופס הרשמה)
Route::get('/cities', [SuperAdminController::class, 'getCities'])->name('cities.list');

// ============================================
// פאנל Super Admin - ניהול כללי
// ============================================
Route::prefix('super-admin')->middleware(['auth:sanctum', 'super_admin'])->group(function () {
    // דשבורד Super Admin
    Route::get('/dashboard', [SuperAdminController::class, 'dashboard'])->name('super-admin.dashboard');

    // ניהול מסעדות
    Route::get('/restaurants', [SuperAdminController::class, 'listRestaurants'])->name('super-admin.restaurants.list');
    Route::get('/restaurants/{id}', [SuperAdminController::class, 'getRestaurant'])->name('super-admin.restaurants.get');
    Route::post('/restaurants', [SuperAdminController::class, 'createRestaurant'])->name('super-admin.restaurants.create');
    Route::put('/restaurants/{id}', [SuperAdminController::class, 'updateRestaurant'])->name('super-admin.restaurants.update');
    Route::delete('/restaurants/{id}', [SuperAdminController::class, 'deleteRestaurant'])->name('super-admin.restaurants.delete');
    Route::patch('/restaurants/{id}/toggle-status', [SuperAdminController::class, 'toggleRestaurantStatus'])->name('super-admin.restaurants.toggle');
    Route::post('/restaurants/{id}/approve', [SuperAdminController::class, 'approveRestaurant'])->name('super-admin.restaurants.approve');

    // סטטיסטיקות מסעדה
    Route::get('/restaurants/{id}/stats', [SuperAdminController::class, 'getRestaurantStats'])->name('super-admin.restaurants.stats');

    // חיוב ותשלומים
    Route::get('/billing/summary', [SuperAdminBillingController::class, 'summary'])->name('super-admin.billing.summary');
    Route::get('/billing/restaurants', [SuperAdminBillingController::class, 'restaurants'])->name('super-admin.billing.restaurants');
    Route::post('/billing/restaurants/{id}/charge', [SuperAdminBillingController::class, 'chargeRestaurant'])->name('super-admin.billing.charge');
    Route::get('/billing/payments', [SuperAdminBillingController::class, 'payments'])->name('super-admin.billing.payments');

    // סטטוס סכימת בסיס נתונים ומיגרציות (אבחון)
    Route::get('/schema-status', [SuperAdminController::class, 'schemaStatus'])->name('super-admin.schema.status');

    // SMS Debug (OTP)
    Route::post('/sms/test', [SuperAdminController::class, 'testSms'])->name('super-admin.sms.test');

    // התראות (Broadcast) לפי פילטרים
    Route::get('/notifications/filters', [SuperAdminNotificationController::class, 'filters'])->name('super-admin.notifications.filters');
    Route::post('/notifications/send', [SuperAdminNotificationController::class, 'send'])->name('super-admin.notifications.send');
});

// ============================================
// פאנל ניהול - Admin Routes
// ============================================
Route::prefix('admin')->middleware(['auth:sanctum'])->group(function () {
    // סטטוס מנוי + תשלום - זמין גם אם פג הניסיון
    Route::get('/subscription/status', [AdminController::class, 'subscriptionStatus'])->name('admin.subscription.status');
    Route::post('/subscription/activate', [AdminController::class, 'activateSubscription'])->name('admin.subscription.activate');

    Route::middleware(\App\Http\Middleware\CheckRestaurantAccess::class)->group(function () {
        // דשבורד
        Route::get('/dashboard', [AdminController::class, 'dashboard'])->name('admin.dashboard');

        // ניהול מסעדה
        Route::get('/restaurant', [AdminController::class, 'getRestaurant'])->name('admin.restaurant.get');
        Route::put('/restaurant', [AdminController::class, 'updateRestaurant'])->name('admin.restaurant.update');
        Route::post('/restaurant/override/clear', [AdminController::class, 'clearRestaurantOverride'])->name('admin.restaurant.override.clear');

        // ניהול קטגוריות
        Route::get('/categories', [AdminController::class, 'getCategories'])->name('admin.categories.index');
        Route::post('/categories', [AdminController::class, 'storeCategory'])->name('admin.categories.store');
        Route::put('/categories/{id}', [AdminController::class, 'updateCategory'])->name('admin.categories.update');
        Route::delete('/categories/{id}', [AdminController::class, 'deleteCategory'])->name('admin.categories.delete');

        // ניהול פריטי תפריט
        Route::get('/menu-items', [AdminController::class, 'getMenuItems'])->name('admin.menu.index');
        Route::post('/menu-items', [AdminController::class, 'storeMenuItem'])->name('admin.menu.store');
        Route::put('/menu-items/{id}', [AdminController::class, 'updateMenuItem'])->name('admin.menu.update');
        Route::delete('/menu-items/{id}', [AdminController::class, 'deleteMenuItem'])->name('admin.menu.delete');

        // ניהול סלטים קבועים
        Route::get('/salads', [AdminController::class, 'getSalads'])->name('admin.salads.index');
        Route::post('/salads', [AdminController::class, 'storeSalad'])->name('admin.salads.store');
        Route::put('/salads/{id}', [AdminController::class, 'updateSalad'])->name('admin.salads.update');

        // ניהול קבוצות תוספות
        Route::put('/addon-groups/{id}', [AdminController::class, 'updateAddonGroup'])->name('admin.addon-groups.update');

        // ניהול בסיסים גלובליים
        Route::get('/bases', [AdminController::class, 'getBases'])->name('admin.bases.index');
        Route::post('/bases', [AdminController::class, 'storeBase'])->name('admin.bases.store');
        Route::put('/bases/{id}', [AdminController::class, 'updateBase'])->name('admin.bases.update');

        // ניהול הזמנות
        Route::get('/orders', [AdminController::class, 'getOrders'])->name('admin.orders.index');
        Route::patch('/orders/{id}/status', [AdminController::class, 'updateOrderStatus'])->name('admin.orders.status');
        Route::patch('/orders/{id}/eta', [AdminController::class, 'updateOrderEta'])->name('admin.orders.eta');

        // ניהול עובדים
        Route::get('/employees', [AdminController::class, 'getEmployees'])->name('admin.employees.index');
        Route::put('/employees/{id}', [AdminController::class, 'updateEmployee'])->name('admin.employees.update');
        Route::delete('/employees/{id}', [AdminController::class, 'deleteEmployee'])->name('admin.employees.delete');
    });
});

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
    // רישום FCM לטאבלטים/דפדפנים
    // ============================================
    Route::post('/fcm/register', [FcmTokenController::class, 'store'])->name('fcm.register');
    Route::post('/fcm/unregister', [FcmTokenController::class, 'unregister'])->name('fcm.unregister');

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

// מסעדה לפי tenant/slug - ציבורי (לטעינת דף תפריט מלא גם אם המסעדה סגורה)
Route::get('/restaurants/by-tenant/{tenantId}', [RestaurantController::class, 'publicShowByTenant'])
    ->name('restaurants.byTenant');

// ============================================
// CORS Preflight (OPTIONS)
// ============================================
// בחלק מהדפדפנים בקשות עם Authorization מבצעות preflight.
// אם אין נתיב OPTIONS תואם, מתקבל 404 וה-GET/POST בכלל לא נשלח.
Route::options('/{any}', function () {
    return response()->json(['success' => true]);
})->where('any', '.*');

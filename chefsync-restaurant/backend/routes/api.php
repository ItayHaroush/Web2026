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
use App\Http\Controllers\ChatController;
use App\Http\Controllers\DisplayScreenController;
use App\Http\Controllers\KioskController;
use App\Http\Controllers\PrinterController;

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

// ערים - ציבורי (לשימוש בטופס הרשמה ואזורי משלוח)
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
    Route::post('/restaurants/{id}/revoke-approval', [SuperAdminController::class, 'revokeApproval'])->name('super-admin.restaurants.revoke');

    // סטטיסטיקות מסעדה
    Route::get('/restaurants/{id}/stats', [SuperAdminController::class, 'getRestaurantStats'])->name('super-admin.restaurants.stats');

    // ניהול הגדרות AI למסעדות ⭐ חדש
    Route::get('/ai/settings/{restaurantId}', [\App\Http\Controllers\AiSettingsController::class, 'getSettings'])
        ->name('super-admin.ai.settings');
    Route::post('/ai/toggle-feature', [\App\Http\Controllers\AiSettingsController::class, 'toggleFeature'])
        ->name('super-admin.ai.toggle-feature');
    Route::get('/ai/stats/{restaurantId}', [\App\Http\Controllers\AiSettingsController::class, 'getStats'])
        ->name('super-admin.ai.stats');

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

    // עוזר AI לסופר אדמין
    Route::post('/ai/chat', [ChatController::class, 'chat'])->name('super-admin.ai.chat');
});

// ============================================
// פאנל ניהול - Admin Routes
// ============================================
Route::prefix('admin')->middleware(['auth:sanctum', 'tenant'])->group(function () {
    // סטטוס מנוי + תשלום - זמין גם אם פג הניסיון
    Route::get('/subscription/status', [AdminController::class, 'subscriptionStatus'])->name('admin.subscription.status');
    Route::post('/subscription/activate', [AdminController::class, 'activateSubscription'])->name('admin.subscription.activate');

    Route::middleware(\App\Http\Middleware\CheckRestaurantAccess::class)->group(function () {
        // דשבורד
        Route::get('/dashboard', [AdminController::class, 'dashboard'])->name('admin.dashboard');

        // ============================================
        // AI Features - Description Generator & More
        // ============================================
        Route::prefix('ai')->group(function () {
            Route::post('/generate-description', [\App\Http\Controllers\AiController::class, 'generateDescription'])
                ->name('admin.ai.generate-description');
            Route::get('/credits', [\App\Http\Controllers\AiController::class, 'getCreditsStatus'])
                ->name('admin.ai.credits');
            Route::get('/usage-stats', [\App\Http\Controllers\AiController::class, 'getUsageStats'])
                ->name('admin.ai.usage-stats');
            Route::get('/dashboard-insights', [\App\Http\Controllers\AiController::class, 'getDashboardInsights'])
                ->name('admin.ai.dashboard-insights');
            Route::post('/recommend-price', [\App\Http\Controllers\AiController::class, 'recommendPrice'])
                ->name('admin.ai.recommend-price');

            // צ'אט אינטראקטיבי עם סוכן AI (מותאם למנהל מסעדה)
            Route::post('/chat', [ChatController::class, 'restaurantChat'])
                ->name('admin.ai.chat');

            // שיפור תמונות AI ⭐ חדש
            Route::post('/enhance-image', [\App\Http\Controllers\AiImageController::class, 'enhance'])
                ->name('admin.ai.enhance-image');
            Route::post('/select-variation', [\App\Http\Controllers\AiImageController::class, 'selectVariation'])
                ->name('admin.ai.select-variation');
            Route::get('/enhancements', [\App\Http\Controllers\AiImageController::class, 'getEnhancements'])
                ->name('admin.ai.enhancements');
            Route::delete('/enhancements/{id}', [\App\Http\Controllers\AiImageController::class, 'delete'])
                ->name('admin.ai.enhancements.delete');
        });

        // ניהול מסעדה
        Route::get('/restaurant', [AdminController::class, 'getRestaurant'])->name('admin.restaurant.get');
        Route::put('/restaurant', [AdminController::class, 'updateRestaurant'])->name('admin.restaurant.update');
        Route::post('/restaurant/override/clear', [AdminController::class, 'clearRestaurantOverride'])->name('admin.restaurant.override.clear');

        // ניהול קטגוריות
        Route::get('/categories', [AdminController::class, 'getCategories'])->name('admin.categories.index');
        Route::post('/categories', [AdminController::class, 'storeCategory'])->name('admin.categories.store');
        Route::put('/categories/{id}', [AdminController::class, 'updateCategory'])->name('admin.categories.update');
        Route::delete('/categories/{id}', [AdminController::class, 'deleteCategory'])->name('admin.categories.delete');
        Route::post('/categories/reorder', [AdminController::class, 'reorderCategories'])->name('admin.categories.reorder');
        Route::patch('/categories/{id}/toggle-active', [AdminController::class, 'toggleCategoryActive'])->name('admin.categories.toggle');

        // ניהול פריטי תפריט
        Route::get('/menu-items', [AdminController::class, 'getMenuItems'])->name('admin.menu.index');
        Route::post('/menu-items', [AdminController::class, 'storeMenuItem'])->name('admin.menu.store');
        Route::put('/menu-items/{id}', [AdminController::class, 'updateMenuItem'])->name('admin.menu.update');
        Route::delete('/menu-items/{id}', [AdminController::class, 'deleteMenuItem'])->name('admin.menu.delete');

        // ניהול סלטים קבועים
        Route::get('/salads', [AdminController::class, 'getSalads'])->name('admin.salads.index');
        Route::post('/salads', [AdminController::class, 'storeSalad'])->name('admin.salads.store');
        Route::put('/salads/{id}', [AdminController::class, 'updateSalad'])->name('admin.salads.update');
        Route::delete('/salads/{id}', [AdminController::class, 'deleteSalad'])->name('admin.salads.delete');

        // ניהול קבוצות תוספות
        Route::post('/addon-groups', [AdminController::class, 'storeAddonGroup'])->name('admin.addon-groups.store');
        Route::put('/addon-groups/{id}', [AdminController::class, 'updateAddonGroup'])->name('admin.addon-groups.update');
        Route::delete('/addon-groups/{id}', [AdminController::class, 'deleteAddonGroup'])->name('admin.addon-groups.delete');
        Route::post('/addon-groups/{id}/duplicate', [AdminController::class, 'duplicateAddonGroup'])->name('admin.addon-groups.duplicate');

        // ניהול אזורי משלוח
        Route::get('/delivery-zones', [AdminController::class, 'getDeliveryZones'])->name('admin.delivery-zones.index');
        Route::post('/delivery-zones', [AdminController::class, 'storeDeliveryZone'])->name('admin.delivery-zones.store');
        Route::put('/delivery-zones/{id}', [AdminController::class, 'updateDeliveryZone'])->name('admin.delivery-zones.update');
        Route::delete('/delivery-zones/{id}', [AdminController::class, 'deleteDeliveryZone'])->name('admin.delivery-zones.delete');

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

        // ניהול מסכי תצוגה
        Route::get('/display-screens', [DisplayScreenController::class, 'index'])->name('admin.display-screens.index');
        Route::post('/display-screens', [DisplayScreenController::class, 'store'])->name('admin.display-screens.store');
        Route::put('/display-screens/{id}', [DisplayScreenController::class, 'update'])->name('admin.display-screens.update');
        Route::delete('/display-screens/{id}', [DisplayScreenController::class, 'destroy'])->name('admin.display-screens.delete');
        Route::post('/display-screens/{id}/toggle', [DisplayScreenController::class, 'toggle'])->name('admin.display-screens.toggle');
        Route::post('/display-screens/{id}/regenerate-token', [DisplayScreenController::class, 'regenerateToken'])->name('admin.display-screens.regenerate');
        Route::get('/display-screens/{id}/items', [DisplayScreenController::class, 'getItems'])->name('admin.display-screens.items.get');
        Route::post('/display-screens/{id}/items', [DisplayScreenController::class, 'updateItems'])->name('admin.display-screens.items.update');

        // ניהול קיוסקים
        Route::get('/kiosks', [KioskController::class, 'index'])->name('admin.kiosks.index');
        Route::post('/kiosks', [KioskController::class, 'store'])->name('admin.kiosks.store');
        Route::put('/kiosks/{id}', [KioskController::class, 'update'])->name('admin.kiosks.update');
        Route::delete('/kiosks/{id}', [KioskController::class, 'destroy'])->name('admin.kiosks.delete');
        Route::post('/kiosks/{id}/toggle', [KioskController::class, 'toggle'])->name('admin.kiosks.toggle');
        Route::post('/kiosks/{id}/regenerate-token', [KioskController::class, 'regenerateToken'])->name('admin.kiosks.regenerate');

        // ניהול מדפסות מטבח
        Route::get('/printers', [PrinterController::class, 'index'])->name('admin.printers.index');
        Route::post('/printers', [PrinterController::class, 'store'])->name('admin.printers.store');
        Route::put('/printers/{id}', [PrinterController::class, 'update'])->name('admin.printers.update');
        Route::delete('/printers/{id}', [PrinterController::class, 'destroy'])->name('admin.printers.delete');
        Route::patch('/printers/{id}/toggle', [PrinterController::class, 'toggle'])->name('admin.printers.toggle');
        Route::post('/printers/{id}/test', [PrinterController::class, 'testPrint'])->name('admin.printers.test');
        Route::post('/orders/{id}/reprint', [PrinterController::class, 'reprint'])->name('admin.orders.reprint');
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
    Route::post('/check-delivery-zone', [OrderController::class, 'checkDeliveryZone'])->name('orders.check-delivery');

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
    Route::post('/orders/{id}/review', [OrderController::class, 'submitReview'])->name('orders.review');

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

// מסך תצוגה ציבורי - ללא אימות
Route::get('/screen/{token}', [DisplayScreenController::class, 'viewerContent'])->name('screen.view');

// קיוסק ציבורי - ללא אימות
Route::get('/kiosk/{token}/menu', [KioskController::class, 'menu'])->name('kiosk.menu');
Route::post('/kiosk/{token}/order', [KioskController::class, 'placeOrder'])->name('kiosk.order');

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

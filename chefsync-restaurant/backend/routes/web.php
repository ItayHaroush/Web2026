<?php

use App\Http\Controllers\CustomInvoiceController;
use App\Http\Controllers\EmailMarketingUnsubscribeController;
use App\Http\Controllers\HypOrderRedirectController;
use App\Http\Controllers\HypSubscriptionRedirectController;
use App\Http\Controllers\SeoController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return ['message' => 'TakeEat API'];
});

// -----------------------------------------------------------------------------
//  SEO — sitemap, robots, ושלדים דינמיים לדפי המסעדה
// -----------------------------------------------------------------------------
//  חשוב: הנתיבים האלה צריכים להגיע ל-Laravel לפני שהם נתפסים על ידי שרת
//  הסטטי של ה-SPA (Vite). ה-vhost/reverse-proxy של ה-webserver חייב להעביר
//  את /sitemap.xml, /robots.txt, /r/{slug} ואת /{tenantId}/menu ל-Laravel.
Route::get('/sitemap.xml', [SeoController::class, 'sitemap'])->name('seo.sitemap');
Route::get('/robots.txt', [SeoController::class, 'robots'])->name('seo.robots');

// Hub pages
Route::get('/restaurants', [SeoController::class, 'showRestaurantsList'])->name('seo.restaurants');
Route::get('/restaurants/new', [SeoController::class, 'showNewRestaurants'])->name('seo.restaurants.new');
Route::get('/about', [SeoController::class, 'showAbout'])->name('seo.about');
Route::get('/landing', [SeoController::class, 'showLanding'])->name('seo.landing');

Route::get('/r/{slug}', [SeoController::class, 'showShare'])
    ->where('slug', '[A-Za-z0-9\-_]+')
    ->name('seo.share');

Route::get('/{tenantId}/menu', [SeoController::class, 'showMenu'])
    ->where('tenantId', '[A-Za-z0-9\-_]+')
    ->name('seo.menu');

// ביטול הרשמה למיילים שיווקיים (RFC 8058 — GET וגם POST one-click)
Route::match(['get', 'post'], '/email/marketing/unsubscribe', [EmailMarketingUnsubscribeController::class, 'unsubscribe'])
    ->middleware('signed')
    ->name('email.marketing.unsubscribe');

// טופס חשבונית ידנית ל-Itay Solutions
Route::get('/custom-invoice', [CustomInvoiceController::class, 'showForm'])->name('custom-invoice.form');
Route::get('/custom-invoice/new', [CustomInvoiceController::class, 'clearAndShowForm'])->name('custom-invoice.new');
Route::post('/custom-invoice', [CustomInvoiceController::class, 'generate'])->name('custom-invoice.generate');
Route::get('/custom-invoice/show', [CustomInvoiceController::class, 'showInvoice'])->name('custom-invoice.show');
Route::get('/custom-invoice/preview', [CustomInvoiceController::class, 'previewFromSession'])->name('custom-invoice.preview');
Route::post('/custom-invoice/download', [CustomInvoiceController::class, 'download'])->name('custom-invoice.download');
Route::post('/custom-invoice/send-email', [CustomInvoiceController::class, 'sendEmail'])->name('custom-invoice.send-email');

// Redirect לתשלום HYP (B2C) – קורא APISign לחתימה ומפנה לעמוד תשלום HYP
Route::get('/pay/hyp/order/{sessionToken}', [HypOrderRedirectController::class, 'redirect'])
    ->name('payments.hyp.order.redirect');

// Redirect לתשלום HYP (B2B) – קורא APISign לחתימה ומפנה לעמוד תשלום מנוי
Route::get('/pay/hyp/subscription/{restaurantId}', [HypSubscriptionRedirectController::class, 'redirect'])
    ->name('payments.hyp.subscription.redirect');

// ── Appointed.cloud payment proxy (same HYP masof) ──
use App\Http\Controllers\AppointedPaymentProxyController;

Route::post('/appointed-pay/sign', [AppointedPaymentProxyController::class, 'sign']);
Route::get('/appointed-pay/redirect', [AppointedPaymentProxyController::class, 'redirect']);
Route::post('/appointed-pay/proxy', [AppointedPaymentProxyController::class, 'proxy']);

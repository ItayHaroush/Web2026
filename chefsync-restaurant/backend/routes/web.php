<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\CustomInvoiceController;
use App\Http\Controllers\HypOrderRedirectController;
use App\Http\Controllers\HypSubscriptionRedirectController;

Route::get('/', function () {
    return ['message' => 'TakeEat API'];
});

// טופס חשבונית ידנית ל-Itay Solutions
Route::get('/custom-invoice', [CustomInvoiceController::class, 'showForm'])->name('custom-invoice.form');
Route::post('/custom-invoice', [CustomInvoiceController::class, 'generate'])->name('custom-invoice.generate');
Route::get('/custom-invoice/show', [CustomInvoiceController::class, 'showInvoice'])->name('custom-invoice.show');
Route::post('/custom-invoice/download', [CustomInvoiceController::class, 'download'])->name('custom-invoice.download');

// Redirect לתשלום HYP (B2C) – קורא APISign לחתימה ומפנה לעמוד תשלום HYP
Route::get('/pay/hyp/order/{sessionToken}', [HypOrderRedirectController::class, 'redirect'])
    ->name('payments.hyp.order.redirect');

// Redirect לתשלום HYP (B2B) – קורא APISign לחתימה ומפנה לעמוד תשלום מנוי
Route::get('/pay/hyp/subscription/{restaurantId}', [HypSubscriptionRedirectController::class, 'redirect'])
    ->name('payments.hyp.subscription.redirect');

<?php

use Illuminate\Support\Facades\Route;


use App\Http\Controllers\CustomInvoiceController;

Route::get('/', function () {
    return ['message' => 'TakeEat API'];
});

// טופס חשבונית ידנית ל-Itay Solutions
Route::get('/custom-invoice', [CustomInvoiceController::class, 'showForm'])->name('custom-invoice.form');
Route::post('/custom-invoice', [CustomInvoiceController::class, 'generate'])->name('custom-invoice.generate');
Route::get('/custom-invoice/show', [CustomInvoiceController::class, 'showInvoice'])->name('custom-invoice.show');
Route::post('/custom-invoice/download', [CustomInvoiceController::class, 'download'])->name('custom-invoice.download');

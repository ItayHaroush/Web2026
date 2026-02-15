<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\View;
use Illuminate\Support\Str;
use Barryvdh\DomPDF\Facade\Pdf;

class CustomInvoiceController extends Controller
{
    // תצוגה מקדימה לחשבונית מותאמת
    public function showInvoice(Request $request)
    {
        $validated = $request->validate([
            'customer_name' => 'nullable|string|max:255',
            'customer_id' => 'nullable|string|max:255',
            'customer_email' => 'nullable|email|max:255',
            'items' => 'required|array|min:1',
            'items.*.description' => 'required|string|max:255',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.unit_price' => 'required|numeric|min:0',
            'logo' => 'nullable|image|max:2048',
            'payment_method' => 'required|in:cash,credit',
            'contact' => 'nullable|string|max:255',
            'to_pay' => 'required|in:0,1',
        ]);
        $items = $validated['items'];
        $total = 0;
        foreach ($items as $item) {
            $total += $item['quantity'] * $item['unit_price'];
        }
        $invoiceData = [
            'customer_name' => $validated['customer_name'] ?? '',
            'customer_id' => $validated['customer_id'] ?? '',
            'customer_email' => $validated['customer_email'] ?? '',
            'items' => $items,
            'total' => $total,
            'invoiceNumber' => 'ITAY-' . now()->format('Ymd-His') . '-' . Str::random(4),
            'date' => now()->format('d/m/Y'),
            'toPay' => $validated['to_pay'] == '1',
        ];
        return view('invoices.custom_invoice_show', $invoiceData);
    }
    // הורדת PDF
    public function download(Request $request)
    {
        $validated = $request->validate([
            'customer_name' => 'nullable|string|max:255',
            'customer_id' => 'nullable|string|max:255',
            'customer_email' => 'nullable|email|max:255',
            'items' => 'required|array|min:1',
            'items.*.description' => 'required|string|max:255',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.unit_price' => 'required|numeric|min:0',
            'logo' => 'nullable|image|max:2048',
            'payment_method' => 'required|in:cash,credit',
            'contact' => 'nullable|string|max:255',
            'to_pay' => 'required|in:0,1',
        ]);
        $items = $validated['items'];
        $total = 0;
        foreach ($items as $item) {
            $total += $item['quantity'] * $item['unit_price'];
        }
        $invoiceData = [
            'customer_name' => $validated['customer_name'] ?? '',
            'customer_id' => $validated['customer_id'] ?? '',
            'customer_email' => $validated['customer_email'] ?? '',
            'items' => $items,
            'total' => $total,
            'invoiceNumber' => 'ITAY-' . now()->format('Ymd-His') . '-' . Str::random(4),
            'date' => now()->format('d/m/Y'),
            'toPay' => $validated['to_pay'] == '1',
        ];
        $service = new \App\Services\CustomInvoicePdfService();
        return $service->downloadPdf($invoiceData);
    }
    // הצגת טופס הפקת חשבונית ידנית
    public function showForm()
    {
        return view('invoices.custom_invoice_form');
    }

    // טיפול בשליחת טופס והצגת חשבונית מותאמת
    public function generate(Request $request)
    {
        $validated = $request->validate([
            'customer_name' => 'nullable|string|max:255',
            'customer_id' => 'nullable|string|max:255',
            'customer_email' => 'nullable|email|max:255',
            'items' => 'required|array|min:1',
            'items.*.description' => 'required|string|max:255',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.unit_price' => 'required|numeric|min:0',
            'logo' => 'nullable|image|max:2048',
            'payment_method' => 'required|in:cash,credit',
            'contact' => 'nullable|string|max:255',
            'to_pay' => 'required|in:0,1',
        ]);

        $items = $validated['items'];
        $total = 0;
        foreach ($items as $item) {
            $total += $item['quantity'] * $item['unit_price'];
        }
        $description = collect($items)->pluck('description')->implode(', ');
        $amount = $total;
        $logoBase64 = null;
        if ($request->hasFile('logo')) {
            $logoFile = $request->file('logo');
            $logoBase64 = base64_encode(file_get_contents($logoFile->getRealPath()));
        }
        $invoiceData = [
            'customer_name' => $validated['customer_name'] ?? '',
            'customer_id' => $validated['customer_id'] ?? '',
            'customer_email' => $validated['customer_email'] ?? '',
            'items' => $items,
            'total' => $total,
            'invoiceNumber' => 'ITAY-' . now()->format('Ymd-His') . '-' . Str::random(4),
            'date' => now()->format('d/m/Y'),
            'toPay' => $validated['to_pay'] == '1',
            'payment_method' => $validated['payment_method'] ?? '',
            'contact' => $validated['contact'] ?? '',
            'description' => $description,
            'amount' => $amount,
            'logoBase64' => $logoBase64,
        ];
        // החזרת תצוגה ישירה של המסמך
        return view('invoices.custom_invoice_show', $invoiceData);
    }
}

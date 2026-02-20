<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

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
        // #region agent log
        $logPath = base_path('../.cursor/debug.log');
        $logData = json_encode(['location' => 'CustomInvoiceController.php:download', 'message' => 'download called', 'data' => ['has_token' => $request->has('_token'), 'session_id' => session()->getId(), 'has_session_cookie' => $request->hasCookie(config('session.cookie')), 'origin' => $request->header('Origin'), 'referer' => $request->header('Referer')], 'timestamp' => round(microtime(true) * 1000), 'hypothesisId' => 'H1_csrf']);
        file_put_contents($logPath, $logData . "\n", FILE_APPEND);
        // #endregion

        $validated = $request->validate([
            'customer_name' => 'nullable|string|max:255',
            'customer_id' => 'nullable|string|max:255',
            'customer_email' => 'nullable|email|max:255',
            'items' => 'required|array|min:1',
            'items.*.description' => 'required|string|max:255',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.unit_price' => 'required|numeric|min:0',
            'payment_method' => 'required|in:cash,credit',
            'contact' => 'nullable|string|max:255',
            'to_pay' => 'required|in:0,1',
        ]);
        $items = $validated['items'];
        $total = 0;
        foreach ($items as $item) {
            $total += $item['quantity'] * $item['unit_price'];
        }
        $logoBase64 = session('custom_invoice_logo');
        $promotionImagesBase64 = session('custom_invoice_promotion_images', []);
        $invoiceData = [
            'customer_name' => $validated['customer_name'] ?? '',
            'customer_id' => $validated['customer_id'] ?? '',
            'customer_email' => $validated['customer_email'] ?? '',
            'items' => $items,
            'total' => $total,
            'invoiceNumber' => 'ITAY-' . now()->format('Ymd-His') . '-' . Str::random(4),
            'date' => now()->format('d/m/Y'),
            'toPay' => $validated['to_pay'] == '1',
            'logoBase64' => $logoBase64,
            'promotionImagesBase64' => $promotionImagesBase64,
        ];
        $service = new \App\Services\CustomInvoicePdfService();
        return $service->downloadPdf($invoiceData);
    }

    // שליחת חשבונית במייל
    public function sendEmail(Request $request)
    {
        $validated = $request->validate([
            'customer_name' => 'nullable|string|max:255',
            'customer_email' => 'nullable|email|max:255',
            'items' => 'required|array|min:1',
            'items.*.description' => 'required|string|max:255',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.unit_price' => 'required|numeric|min:0',
            'to_pay' => 'required|in:0,1',
            'email' => 'nullable|email|max:255',
        ]);
        $items = $validated['items'];
        $total = 0;
        foreach ($items as $item) {
            $total += $item['quantity'] * $item['unit_price'];
        }
        $logoBase64 = session('custom_invoice_logo');
        $promotionImagesBase64 = session('custom_invoice_promotion_images', []);
        $invoiceNumber = 'ITAY-' . now()->format('Ymd-His') . '-' . Str::random(4);
        $invoiceData = [
            'customer_name' => $validated['customer_name'] ?? '',
            'items' => $items,
            'total' => $total,
            'invoiceNumber' => $invoiceNumber,
            'date' => now()->format('d/m/Y'),
            'toPay' => $validated['to_pay'] == '1',
            'logoBase64' => $logoBase64,
            'promotionImagesBase64' => $promotionImagesBase64,
        ];
        $email = $validated['email'] ?? $validated['customer_email'] ?? null;
        if (!$email) {
            return back()->with('error', 'נא להזין כתובת אימייל');
        }
        $service = new \App\Services\CustomInvoicePdfService();
        $pdfContent = $service->getPdfContent($invoiceData);
        $filename = 'ItaySolutions-Invoice-' . $invoiceNumber . '.pdf';
        try {
            Mail::raw('מצורף חשבונית מ-Itay Solutions.', function ($message) use ($email, $pdfContent, $filename) {
                $message->to($email)
                    ->subject('חשבונית Itay Solutions')
                    ->attachData($pdfContent, $filename, ['mime' => 'application/pdf']);
            });
            return redirect()->route('custom-invoice.preview')->with('success', 'החשבונית נשלחה בהצלחה ל-' . $email);
        } catch (\Exception $e) {
            return redirect()->route('custom-invoice.preview')->with('error', 'שגיאה בשליחת החשבונית: ' . $e->getMessage());
        }
    }

    // הצגת טופס הפקת חשבונית ידנית
    public function showForm()
    {
        // #region agent log
        $logPath = base_path('../.cursor/debug.log');
        $logData = json_encode(['location' => 'CustomInvoiceController.php:showForm', 'message' => 'showForm loaded', 'data' => ['session_id' => session()->getId(), 'has_session_cookie' => request()->hasCookie(config('session.cookie')), 'origin' => request()->header('Origin'), 'referer' => request()->header('Referer'), 'user_agent' => request()->header('User-Agent')], 'timestamp' => round(microtime(true) * 1000), 'hypothesisId' => 'H1_session']);
        file_put_contents($logPath, $logData . "\n", FILE_APPEND);
        // #endregion

        return view('invoices.custom_invoice_form');
    }

    // ניקוי סשן והצגת טופס חדש
    public function clearAndShowForm()
    {
        session()->forget(['custom_invoice_preview', 'custom_invoice_logo', 'custom_invoice_promotion_images']);
        return redirect()->route('custom-invoice.form');
    }

    // תצוגת חשבונית מהסשן (לאחר generate או send-email)
    public function previewFromSession(Request $request)
    {
        $data = session('custom_invoice_preview');
        if (!$data) {
            return redirect()->route('custom-invoice.form')->with('error', 'פג תוקף התצוגה. אנא צור חשבונית מחדש.');
        }
        return view('invoices.custom_invoice_show', $data);
    }

    // טיפול בשליחת טופס והצגת חשבונית מותאמת
    public function generate(Request $request)
    {
        // #region agent log
        $logPath = base_path('../.cursor/debug.log');
        $logData = json_encode(['location' => 'CustomInvoiceController.php:generate', 'message' => 'generate called', 'data' => ['has_token' => $request->has('_token'), 'session_id' => session()->getId(), 'has_session_cookie' => $request->hasCookie(config('session.cookie')), 'origin' => $request->header('Origin'), 'referer' => $request->header('Referer')], 'timestamp' => round(microtime(true) * 1000), 'hypothesisId' => 'H1_csrf']);
        file_put_contents($logPath, $logData . "\n", FILE_APPEND);
        // #endregion

        $validated = $request->validate([
            'customer_name' => 'nullable|string|max:255',
            'customer_id' => 'nullable|string|max:255',
            'customer_email' => 'nullable|email|max:255',
            'items' => 'required|array|min:1',
            'items.*.description' => 'required|string|max:255',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.unit_price' => 'required|numeric|min:0',
            'logo' => 'nullable|image|max:2048',
            'promotion_images' => 'nullable|array',
            'promotion_images.*' => 'image|max:2048',
            'promotion_links' => 'nullable|array',
            'promotion_links.*' => 'nullable|string|max:500',
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
            session(['custom_invoice_logo' => $logoBase64]);
        } else {
            $defaultPath = public_path('images/itay-logo.png');
            if (file_exists($defaultPath)) {
                $logoBase64 = base64_encode(file_get_contents($defaultPath));
                session(['custom_invoice_logo' => $logoBase64]);
            } else {
                session()->forget('custom_invoice_logo');
            }
        }
        $promotionImagesBase64 = [];
        $promotionLinks = $request->input('promotion_links', []);
        if ($request->hasFile('promotion_images')) {
            $idx = 0;
            foreach ($request->file('promotion_images') as $img) {
                if ($img->isValid()) {
                    $url = isset($promotionLinks[$idx]) ? trim((string) $promotionLinks[$idx]) : null;
                    if ($url && !str_starts_with($url, 'http://') && !str_starts_with($url, 'https://')) {
                        $url = 'https://' . ltrim($url, '/');
                    }
                    if ($url === '') $url = null;
                    $promotionImagesBase64[] = [
                        'mime' => $img->getMimeType(),
                        'data' => base64_encode(file_get_contents($img->getRealPath())),
                        'url' => $url ?: null,
                    ];
                    $idx++;
                }
            }
        }
        session(['custom_invoice_promotion_images' => $promotionImagesBase64]);
        $invoiceNumber = 'ITAY-' . now()->format('Ymd-His') . '-' . Str::random(4);
        $invoiceData = [
            'customer_name' => $validated['customer_name'] ?? '',
            'customer_id' => $validated['customer_id'] ?? '',
            'customer_email' => $validated['customer_email'] ?? '',
            'items' => $items,
            'total' => $total,
            'invoiceNumber' => $invoiceNumber,
            'date' => now()->format('d/m/Y'),
            'toPay' => $validated['to_pay'] == '1',
            'payment_method' => $validated['payment_method'] ?? '',
            'contact' => $validated['contact'] ?? '',
            'description' => $description,
            'amount' => $amount,
            'logoBase64' => $logoBase64,
            'promotionImagesBase64' => $promotionImagesBase64,
        ];
        session(['custom_invoice_preview' => $invoiceData]);
        return redirect()->route('custom-invoice.preview');
    }
}

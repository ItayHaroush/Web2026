<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

class CustomInvoiceController extends Controller
{
    /**
     * Persist invoice data to a temp JSON file instead of session (iframe-safe).
     */
    private function storeInvoiceToken(array $data): string
    {
        $token = Str::random(40);
        $dir = storage_path('app/invoice-temp');
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }
        file_put_contents($dir . '/' . $token . '.json', json_encode($data));
        return $token;
    }

    private function loadInvoiceToken(?string $token): ?array
    {
        if (!$token || !preg_match('/^[a-zA-Z0-9]{40}$/', $token)) {
            return null;
        }
        $path = storage_path('app/invoice-temp/' . $token . '.json');
        if (!file_exists($path)) {
            return null;
        }
        return json_decode(file_get_contents($path), true);
    }

    // הצגת טופס הפקת חשבונית ידנית
    public function showForm()
    {
        return view('invoices.custom_invoice_form');
    }

    // ניקוי סשן והצגת טופס חדש
    public function clearAndShowForm()
    {
        return redirect()->route('custom-invoice.form');
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

        $logoBase64 = null;
        if ($request->hasFile('logo')) {
            $logoBase64 = base64_encode(file_get_contents($request->file('logo')->getRealPath()));
        } else {
            $defaultPath = public_path('images/itay-logo.png');
            if (file_exists($defaultPath)) {
                $logoBase64 = base64_encode(file_get_contents($defaultPath));
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
            'amount' => $total,
            'logoBase64' => $logoBase64,
            'promotionImagesBase64' => $promotionImagesBase64,
        ];

        $token = $this->storeInvoiceToken($invoiceData);
        $invoiceData['invoiceToken'] = $token;

        return view('invoices.custom_invoice_show', $invoiceData);
    }

    // תצוגת חשבונית מ-token (לאחר generate)
    public function previewFromSession(Request $request)
    {
        $token = $request->query('token');
        $data = $this->loadInvoiceToken($token);
        if (!$data) {
            $data = session('custom_invoice_preview');
        }
        if (!$data) {
            return redirect()->route('custom-invoice.form')->with('error', 'פג תוקף התצוגה. אנא צור חשבונית מחדש.');
        }
        $data['invoiceToken'] = $token;
        return view('invoices.custom_invoice_show', $data);
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
            'payment_method' => 'required|in:cash,credit',
            'contact' => 'nullable|string|max:255',
            'to_pay' => 'required|in:0,1',
            'invoice_token' => 'nullable|string|max:50',
        ]);

        $tokenData = $this->loadInvoiceToken($validated['invoice_token'] ?? null);

        $items = $validated['items'];
        $total = 0;
        foreach ($items as $item) {
            $total += $item['quantity'] * $item['unit_price'];
        }

        $logoBase64 = $tokenData['logoBase64'] ?? session('custom_invoice_logo');
        $promotionImagesBase64 = $tokenData['promotionImagesBase64'] ?? session('custom_invoice_promotion_images', []);

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
            'invoice_token' => 'nullable|string|max:50',
        ]);

        $tokenData = $this->loadInvoiceToken($validated['invoice_token'] ?? null);

        $items = $validated['items'];
        $total = 0;
        foreach ($items as $item) {
            $total += $item['quantity'] * $item['unit_price'];
        }

        $logoBase64 = $tokenData['logoBase64'] ?? null;
        if (!$logoBase64) {
            $defaultPath = public_path('images/itay-logo.png');
            if (file_exists($defaultPath)) {
                $logoBase64 = base64_encode(file_get_contents($defaultPath));
            }
        }
        $promotionImagesBase64 = $tokenData['promotionImagesBase64'] ?? [];
        $customerName = $validated['customer_name'] ?? '';
        $invoiceNumber = 'ITAY-' . now()->format('Ymd-His') . '-' . Str::random(4);
        $toPay = $validated['to_pay'] == '1';

        $invoiceData = [
            'customer_name' => $customerName,
            'items' => $items,
            'total' => $total,
            'invoiceNumber' => $invoiceNumber,
            'date' => now()->format('d/m/Y'),
            'toPay' => $toPay,
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

        $emailHtml = $this->buildInvoiceEmailHtml($customerName, $invoiceNumber, $total, $toPay, $items, $logoBase64);

        try {
            Mail::html($emailHtml, function ($message) use ($email, $pdfContent, $filename) {
                $message->to($email)
                    ->subject('חשבונית Itay Solutions')
                    ->attachData($pdfContent, $filename, ['mime' => 'application/pdf']);
            });
            return back()->with('success', 'החשבונית נשלחה בהצלחה ל-' . $email);
        } catch (\Exception $e) {
            return back()->with('error', 'שגיאה בשליחת החשבונית: ' . $e->getMessage());
        }
    }

    private function buildInvoiceEmailHtml(string $customerName, string $invoiceNumber, float $total, bool $toPay, array $items, ?string $logoBase64): string
    {
        $logoImg = $logoBase64
            ? '<img src="data:image/png;base64,' . $logoBase64 . '" alt="Itay Solutions" width="48" height="48" style="display:block; margin:0 auto 8px; border-radius:10px;" />'
            : '';

        $totalFormatted = number_format($total, 2);
        $statusLabel = $toPay ? 'לתשלום' : 'שולם';
        $statusColor = $toPay ? '#f97316' : '#059669';
        $greeting = $customerName ? "שלום {$customerName}," : 'שלום,';

        $itemRows = '';
        foreach ($items as $item) {
            $desc = e($item['description']);
            $qty = (int) $item['quantity'];
            $price = number_format($item['unit_price'], 2);
            $lineTotal = number_format($qty * $item['unit_price'], 2);
            $itemRows .= <<<HTML
            <tr>
                <td style="padding:8px 10px; border-bottom:1px solid #f3f4f6; font-size:13px; color:#374151; text-align:right;">{$desc}</td>
                <td style="padding:8px 10px; border-bottom:1px solid #f3f4f6; font-size:13px; color:#374151; text-align:center;">{$qty}</td>
                <td style="padding:8px 10px; border-bottom:1px solid #f3f4f6; font-size:13px; color:#374151; text-align:center;">₪{$price}</td>
                <td style="padding:8px 10px; border-bottom:1px solid #f3f4f6; font-size:13px; font-weight:bold; color:#1f2937; text-align:center;">₪{$lineTotal}</td>
            </tr>
            HTML;
        }

        return <<<HTML
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>חשבונית Itay Solutions</title>
</head>
<body style="margin:0; padding:0; background:#f3f4f6; font-family:Arial, Helvetica, sans-serif; direction:rtl;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f4f6;">
        <tr>
            <td style="padding:24px 12px;">
                <table role="presentation" width="600" align="center" cellspacing="0" cellpadding="0" style="max-width:600px; margin:0 auto; background:#fff; border-radius:16px; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.08);">
                    <!-- Header -->
                    <tr>
                        <td style="background:linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%); padding:28px 32px; text-align:center;">
                            {$logoImg}
                            <h1 style="margin:0; font-size:24px; font-weight:bold; color:#fff; letter-spacing:0.5px;">Itay Solutions</h1>
                            <p style="margin:6px 0 0; font-size:12px; color:rgba(255,255,255,0.8);">פיתוח ועיצוב אתרים</p>
                        </td>
                    </tr>
                    <!-- Body -->
                    <tr>
                        <td style="padding:28px 32px;">
                            <p style="margin:0 0 16px; font-size:15px; color:#374151; line-height:1.7;">{$greeting}</p>
                            <p style="margin:0 0 20px; font-size:14px; color:#6b7280; line-height:1.7;">מצורפת חשבונית מספר <strong style="color:#7c3aed;">{$invoiceNumber}</strong> מ-Itay Solutions.</p>

                            <!-- Amount Box -->
                            <div style="background:#f5f3ff; border:2px solid #7c3aed; border-radius:14px; padding:20px; margin:0 0 24px; text-align:center;">
                                <p style="margin:0 0 4px; font-size:12px; color:#7c3aed; font-weight:bold;">{$statusLabel}</p>
                                <p style="margin:0; font-size:30px; font-weight:bold; color:{$statusColor};">₪{$totalFormatted}</p>
                                <p style="margin:4px 0 0; font-size:11px; color:#9ca3af;">(עוסק פטור — לא כולל מע"מ)</p>
                            </div>

                            <!-- Items Table -->
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse; margin:0 0 20px;">
                                <tr style="background:#f9fafb;">
                                    <th style="padding:10px; font-size:11px; font-weight:bold; color:#7c3aed; text-align:right; border-bottom:2px solid #e5e7eb;">תיאור</th>
                                    <th style="padding:10px; font-size:11px; font-weight:bold; color:#7c3aed; text-align:center; border-bottom:2px solid #e5e7eb;">כמות</th>
                                    <th style="padding:10px; font-size:11px; font-weight:bold; color:#7c3aed; text-align:center; border-bottom:2px solid #e5e7eb;">מחיר</th>
                                    <th style="padding:10px; font-size:11px; font-weight:bold; color:#7c3aed; text-align:center; border-bottom:2px solid #e5e7eb;">סה"כ</th>
                                </tr>
                                {$itemRows}
                            </table>

                            <p style="margin:0; font-size:13px; color:#9ca3af; line-height:1.6;">החשבונית המלאה מצורפת כקובץ PDF.</p>
                        </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                        <td style="padding:0 32px 24px;">
                            <div style="border-top:1px solid #e5e7eb; padding-top:18px; text-align:center;">
                                <p style="margin:0 0 4px; font-size:12px; font-weight:bold; color:#7c3aed;">Itay Solutions</p>
                                <p style="margin:0 0 4px; font-size:11px; color:#9ca3af;">איתי חרוש | עוסק זעיר | 305300808</p>
                                <p style="margin:0 0 4px; font-size:11px; color:#9ca3af;">
                                    <a href="tel:0547466508" style="color:#7c3aed; text-decoration:none;">054-7466508</a> &nbsp;|&nbsp;
                                    <a href="mailto:itayyharoush@gmail.com" style="color:#7c3aed; text-decoration:none;">itayyharoush@gmail.com</a> &nbsp;|&nbsp;
                                    <a href="https://itaysolutions.com" style="color:#7c3aed; text-decoration:none;">itaysolutions.com</a>
                                </p>
                                <p style="margin:8px 0 0; font-size:10px; color:#d1d5db;">חשבונית זו הופקה אוטומטית ממערכת TakeEat</p>
                            </div>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
HTML;
    }

    // תצוגה מקדימה לחשבונית מותאמת (legacy)
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
}

<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Models\PaymentSession;
use App\Models\Restaurant;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * HypOrderRedirectController
 *
 * שלב ביניים בין האתר ל-HYP Pay Protocol עבור תשלום B2C:
 * 1. שולף PaymentSession + Order + Restaurant
 * 2. קורא ל-HYP APISign (server-to-server) לקבלת חתימה עם KEY + PassP
 * 3. מפנה (redirect) את הלקוח לעמוד תשלום HYP עם כל הפרמטרים + signature
 */
class HypOrderRedirectController extends Controller
{
    public function redirect(string $sessionToken)
    {
        $session = PaymentSession::where('session_token', $sessionToken)->first();

        if (!$session || $session->isExpired() || $session->status !== 'pending') {
            Log::warning('HYP redirect: invalid or expired session', [
                'session_token' => $sessionToken,
            ]);

            return response()->view('hyp.order_error', [
                'message' => 'פג תוקף קישור התשלום או שהעסקה כבר טופלה.',
            ], 400);
        }

        $restaurant = Restaurant::withoutGlobalScope('tenant')->find($session->restaurant_id);
        $order = Order::withoutGlobalScope('tenant')->find($session->order_id);

        if (!$restaurant || !$order) {
            Log::error('HYP redirect: restaurant or order not found', [
                'restaurant_id' => $session->restaurant_id,
                'order_id'      => $session->order_id,
            ]);

            return response()->view('hyp.order_error', [
                'message' => 'שגיאה בטעינת פרטי ההזמנה.',
            ], 404);
        }

        $masof  = $restaurant->hyp_terminal_id;
        $passp  = $restaurant->hyp_terminal_password;
        $apiKey = $restaurant->hyp_api_key;

        if (empty($masof) || empty($passp)) {
            Log::error('HYP redirect: missing terminal credentials', [
                'restaurant_id' => $restaurant->id,
            ]);

            return response()->view('hyp.order_error', [
                'message' => 'מסוף האשראי של המסעדה אינו מוגדר.',
            ], 500);
        }

        if (empty($apiKey)) {
            Log::error('HYP redirect: missing API Key — cannot generate signature', [
                'restaurant_id' => $restaurant->id,
            ]);

            return response()->view('hyp.order_error', [
                'message' => 'מפתח API של המסעדה אינו מוגדר. יש להזין אותו בהגדרות תשלום.',
            ], 500);
        }

        $baseUrl = rtrim(config('payment.hyp.base_url', 'https://pay.hyp.co.il/p/'), '/');
        $backendUrl = rtrim(config('app.url', 'http://localhost:8000'), '/');
        $amount = number_format($session->amount, 2, '.', '');
        $info = "הזמנה #{$order->id} - {$restaurant->name}";

        $payParams = [
            'Masof'      => $masof,
            'Amount'     => $amount,
            'Order'      => (string) $order->id,
            'Info'       => $info,
            'Coin'       => '1',
            'Tash'       => '1',
            'UserId'     => '000000000',
            'PageLang'   => 'HEB',
            'UTF8'       => 'True',
            'UTF8out'    => 'True',
            'MoreData'   => 'True',
            'Sign'       => 'True',
            'tmp'        => '5',
            'Fild1'      => $session->session_token,
            'Fild2'      => (string) $restaurant->id,
            'Fild3'      => (string) $order->id,
            'SuccessUrl' => "{$backendUrl}/api/payments/hyp/order/success",
            'ErrorUrl'   => "{$backendUrl}/api/payments/hyp/order/error",
        ];

        if ($order->customer_name) {
            $payParams['ClientName'] = $order->customer_name;
        }
        if ($order->customer_phone) {
            $payParams['cell'] = $order->customer_phone;
        }

        // --- חשבוניות EZcount (אם מופעל למסעדה) ---
        // עטוף ב-try/catch כדי שלעולם לא יחסום תשלום
        if ($restaurant->ezcount_invoices_enabled) {
            try {
                $invoiceItems = $this->buildInvoiceItems($order);
                $itemsTotal = $this->calcInvoiceItemsTotal($order);
                $orderTotal = (float) $amount;

                $payParams['SendHesh']   = 'True';
                $payParams['sendemail']  = 'True';
                $payParams['EZ.comment'] = "הזמנה #{$order->id}";

                // פירוט פריטים רק אם הסכום תואם — אחרת חשבונית בסיסית בלי פירוט
                if (abs($itemsTotal - $orderTotal) < 0.02) {
                    $payParams['Pritim']   = 'True';
                    $payParams['heshDesc'] = $invoiceItems;
                } else {
                    Log::warning('EZcount: item total mismatch, sending invoice without itemization', [
                        'order_id'    => $order->id,
                        'items_total' => $itemsTotal,
                        'order_total' => $orderTotal,
                    ]);
                }
            } catch (\Throwable $e) {
                // חשבונית נכשלה — ממשיכים תשלום בלי חשבונית
                Log::warning('EZcount: failed to build invoice params, proceeding without', [
                    'order_id' => $order->id,
                    'error'    => $e->getMessage(),
                ]);
                // הסר פרמטרי חשבונית אם כבר נוספו
                unset($payParams['SendHesh'], $payParams['sendemail'], $payParams['Pritim'], $payParams['heshDesc'], $payParams['EZ.comment']);
            }
        }

        // --- שלב 1: קבלת חתימה מ-HYP APISign (server-to-server) ---
        $signResult = $this->getSignature($baseUrl, $masof, $passp, $apiKey, $payParams);

        if (!$signResult['success']) {
            Log::error('HYP APISign failed — cannot proceed without signature', [
                'restaurant_id' => $restaurant->id,
                'order_id'      => $order->id,
                'error'         => $signResult['error'],
            ]);

            return response()->view('hyp.order_error', [
                'message' => 'שגיאה בקבלת חתימה מ-HYP. נא לנסות שוב או ליצור קשר עם התמיכה.',
            ], 500);
        }

        $payParams['signature'] = $signResult['signature'];

        // --- שלב 2: הפנייה לעמוד תשלום HYP ---
        $payParams['action'] = 'pay';
        $payParams['PassP'] = $passp;

        $payUrl = rtrim($baseUrl, '/') . '/?' . http_build_query($payParams);

        return response()->view('hyp.order_redirect', [
            'paymentUrl' => $payUrl,
        ]);
    }

    /**
     * קריאה ל-HYP APISign לקבלת חתימה server-to-server
     * אימות: KEY + PassP
     */
    private function getSignature(string $baseUrl, string $masof, string $passp, string $apiKey, array $params): array
    {
        $signParams = [
            'action'  => 'APISign',
            'What'    => 'SIGN',
            'KEY'     => $apiKey,
            'PassP'   => $passp,
            'Masof'   => $masof,
            'Amount'  => $params['Amount'],
            'Order'   => $params['Order'] ?? '',
            'Info'    => $params['Info'] ?? '',
            'Sign'    => 'True',
            'UTF8'    => 'True',
            'UTF8out' => 'True',
            'UserId'  => $params['UserId'] ?? '000000000',
            'tmp'     => $params['tmp'] ?? '5',
        ];

        if (!empty($params['Coin'])) {
            $signParams['Coin'] = $params['Coin'];
        }
        if (!empty($params['Tash'])) {
            $signParams['Tash'] = $params['Tash'];
        }
        if (!empty($params['ClientName'])) {
            $signParams['ClientName'] = $params['ClientName'];
        }

        try {
            $signUrl = rtrim($baseUrl, '/') . '/';
            $referer = config('payment.hyp.referer_url', 'https://api.chefsync.co.il');

            $response = Http::timeout(15)
                ->withHeaders(['Referer' => $referer])
                ->get($signUrl, $signParams);

            $body = $response->body();

            Log::info('HYP APISign response', [
                'http_status'  => $response->status(),
                'body_preview' => substr($body, 0, 300),
            ]);

            $result = [];
            parse_str($body, $result);

            if (!empty($result['signature'])) {
                return [
                    'success'   => true,
                    'signature' => $result['signature'],
                    'error'     => null,
                ];
            }

            $ccode = $result['CCode'] ?? null;
            $errMsg = $result['ErrMsg'] ?? 'No signature returned';

            return [
                'success'   => false,
                'signature' => null,
                'error'     => "CCode={$ccode}: {$errMsg}",
            ];
        } catch (\Exception $e) {
            return [
                'success'   => false,
                'signature' => null,
                'error'     => $e->getMessage(),
            ];
        }
    }

    /**
     * בניית מחרוזת פריטים לחשבונית EZcount בפורמט HYP:
     * [code~description~quantity~price]
     * price = מחיר ליחידה כולל מע"מ
     */
    private function buildInvoiceItems(\App\Models\Order $order): string
    {
        $order->loadMissing('items.menuItem');
        $items = '';

        foreach ($order->items as $item) {
            $name = $item->menuItem?->name ?? 'פריט';
            if ($item->variant_name) {
                $name .= " ({$item->variant_name})";
            }
            $unitPrice = (float) $item->price_at_order + (float) $item->addons_total;
            $items .= "[0~{$name}~{$item->quantity}~{$unitPrice}]";
        }

        // דמי משלוח כפריט נפרד
        if ((float) $order->delivery_fee > 0) {
            $items .= "[0~משלוח~1~{$order->delivery_fee}]";
        }

        // הנחת מבצע — כפריט שלילי
        if ((float) $order->promotion_discount > 0) {
            $discount = -1 * (float) $order->promotion_discount;
            $items .= "[0~הנחה~1~{$discount}]";
        }

        return $items;
    }

    /**
     * חישוב סכום פריטי חשבונית — לבדיקת התאמה מול Amount לפני שליחה
     */
    private function calcInvoiceItemsTotal(\App\Models\Order $order): float
    {
        $order->loadMissing('items');
        $total = 0;

        foreach ($order->items as $item) {
            $total += ((float) $item->price_at_order + (float) $item->addons_total) * $item->quantity;
        }

        if ((float) $order->delivery_fee > 0) {
            $total += (float) $order->delivery_fee;
        }

        if ((float) $order->promotion_discount > 0) {
            $total -= (float) $order->promotion_discount;
        }

        return round($total, 2);
    }
}

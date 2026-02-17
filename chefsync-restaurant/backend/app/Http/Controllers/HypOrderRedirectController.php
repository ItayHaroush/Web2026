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
 * 2. קורא ל-HYP APISign (server-to-server) לקבלת חתימה — עם Referer header
 * 3. מפנה (redirect) את הלקוח לעמוד תשלום HYP עם כל הפרמטרים + signature
 *
 * אימות: REFERER (לא PassP) — לפי הגדרת המסוף ב-HYP
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

        $masof = $restaurant->hyp_terminal_id;
        $apiKey = $restaurant->hyp_api_key;

        if (empty($masof)) {
            Log::error('HYP redirect: missing terminal ID', [
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

        // פרמטרים לתשלום (Required לפי HYP Pay Protocol)
        // אימות = REFERER, לכן אין PassP
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

        // --- שלב 1: קבלת חתימה מ-HYP APISign (server-to-server) ---
        $signResult = $this->getSignature($baseUrl, $masof, $apiKey, $payParams);

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

        $payUrl = rtrim($baseUrl, '/') . '/?' . http_build_query($payParams);

        return response()->view('hyp.order_redirect', [
            'paymentUrl' => $payUrl,
        ]);
    }

    /**
     * קריאה ל-HYP APISign לקבלת חתימה server-to-server
     * אימות: Referer header (לפי הגדרת המסוף ב-HYP)
     */
    private function getSignature(string $baseUrl, string $masof, string $apiKey, array $params): array
    {
        // פרמטרים ל-APISign — בלי PassP (אימות דרך Referer)
        $signParams = [
            'action'  => 'APISign',
            'What'    => 'SIGN',
            'KEY'     => $apiKey,
            'Masof'   => $masof,
            'Amount'  => $params['Amount'],
            'Order'   => $params['Order'] ?? '',
            'Info'    => $params['Info'] ?? '',
            'Sign'    => 'True',
            'UTF8'    => 'True',
            'UTF8out' => 'True',
            'UserId'  => $params['UserId'] ?? '000000000',
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

            // Referer header חייב להתאים למה שמוגדר במסוף HYP
            $referer = config('payment.hyp.referer_url', 'https://api.chefsync.co.il');

            $response = Http::timeout(15)
                ->withHeaders([
                    'Referer' => $referer,
                ])
                ->get($signUrl, $signParams);

            $body = $response->body();

            Log::info('HYP APISign response', [
                'http_status'  => $response->status(),
                'body_preview' => substr($body, 0, 300),
                'referer_sent' => $referer,
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
}

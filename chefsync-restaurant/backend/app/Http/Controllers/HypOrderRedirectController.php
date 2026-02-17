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
 * 2. קורא ל-HYP APISign (server-to-server) לקבלת חתימה
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

        $masof = $restaurant->hyp_terminal_id;
        $passp = $restaurant->hyp_terminal_password;
        $apiKey = $restaurant->hyp_api_key;

        if (empty($masof) || empty($passp)) {
            Log::error('HYP redirect: missing terminal credentials', [
                'restaurant_id' => $restaurant->id,
            ]);

            return response()->view('hyp.order_error', [
                'message' => 'מסוף האשראי של המסעדה אינו מוגדר.',
            ], 500);
        }

        $baseUrl = rtrim(config('payment.hyp.base_url', 'https://pay.hyp.co.il/p/'), '/');
        $backendUrl = rtrim(config('app.url', 'http://localhost:8000'), '/');
        $amount = number_format($session->amount, 2, '.', '');

        $info = "הזמנה #{$order->id} - {$restaurant->name}";

        // פרמטרים בסיסיים לתשלום (Required לפי HYP Pay Protocol)
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
        if (!empty($apiKey)) {
            $signResult = $this->getSignature($baseUrl, $masof, $passp, $apiKey, $payParams);

            if ($signResult['success']) {
                $payParams['signature'] = $signResult['signature'];
            } else {
                Log::error('HYP APISign failed, falling back to local Sign', [
                    'restaurant_id' => $restaurant->id,
                    'error'         => $signResult['error'],
                ]);
            }
        }

        // --- שלב 2: הפנייה לעמוד תשלום HYP ---
        $payParams['action'] = 'pay';
        $payParams['PassP'] = $passp;
        $payUrl = $baseUrl . '?' . http_build_query($payParams);

        return response()->view('hyp.order_redirect', [
            'paymentUrl' => $payUrl,
        ]);
    }

    /**
     * קריאה ל-HYP APISign לקבלת חתימה server-to-server
     */
    private function getSignature(string $baseUrl, string $masof, string $passp, string $apiKey, array $params): array
    {
        // כל הפרמטרים ה-Required לפי HYP Pay Protocol עבור APISign SIGN
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
            $response = Http::timeout(15)->get($baseUrl, $signParams);
            $body = $response->body();

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

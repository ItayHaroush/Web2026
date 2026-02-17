<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Models\PaymentSession;
use App\Models\Restaurant;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * HypOrderRedirectController
 *
 * מחולל טופס POST אוטומטי ל-HYP (YaadPay) עבור תשלום B2C.
 * דף זה הוא שלב ביניים בין האתר לבין HYP:
 * - שולף PaymentSession + Order + Restaurant
 * - מחשב חתימת Sign לפי Masof + PassP + Amount + Coin + Tash
 * - יוצר form אוטומטי ל-https://pay.hyp.co.il/cgi-bin/yaadpay/yaadpay3ds.pl
 */
class HypOrderRedirectController extends Controller
{
    public function redirect(string $sessionToken)
    {
        $session = PaymentSession::where('session_token', $sessionToken)->first();

        if (!$session || $session->isExpired() || $session->status !== 'pending') {
            Log::warning('HYP redirect: invalid or expired session', [
                'session_token' => $sessionToken,
                'session'       => $session?->toArray(),
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

        // פרטי מסוף יעד (Masof + PassP) — חשוב: לגשת דרך Eloquent כדי ש-Laravel יפענח את ה-encrypted cast
        $masof = $restaurant->hyp_terminal_id;
        $passp = $restaurant->hyp_terminal_password;

        if (empty($masof) || empty($passp)) {
            Log::error('HYP redirect: missing terminal credentials', [
                'restaurant_id' => $restaurant->id,
            ]);

            return response()->view('hyp.order_error', [
                'message' => 'מסוף האשראי של המסעדה אינו מוגדר.',
            ], 500);
        }

        $amount = number_format($session->amount, 2, '.', '');
        $coin   = '1';
        $tash   = '1';

        // חישוב Sign לפי הנחיות HYP (הסדר חשוב!)
        $signString = $masof . $passp . $amount . $coin . $tash;
        $sign       = md5($signString);

        $backendUrl = rtrim(config('app.url', 'http://localhost:8000'), '/');

        $params = [
            'action'     => 'pay',
            'Masof'      => $masof,
            'PassP'      => $passp,
            'Amount'     => $amount,
            'Info'       => "הזמנה #{$order->id} - {$restaurant->name}",
            'Coin'       => $coin,
            'Tash'       => $tash,
            'PageLang'   => 'HEB',
            'UTF8'       => 'True',
            'UTF8out'    => 'True',
            'MoreData'   => 'True',
            'Sign'       => $sign,
            'Fild1'      => $session->session_token,
            'Fild2'      => (string) $restaurant->id,
            'Fild3'      => (string) $order->id,
            'SuccessUrl' => "{$backendUrl}/api/payments/hyp/order/success",
            'ErrorUrl'   => "{$backendUrl}/api/payments/hyp/order/error",
        ];

        if ($order->customer_name) {
            $params['ClientName'] = $order->customer_name;
        }
        if ($order->customer_phone) {
            $params['cell'] = $order->customer_phone;
        }

        $hypActionUrl = config('payment.hyp.base_url', 'https://pay.hyp.co.il/cgi-bin/yaadpay/yaadpay3ds.pl');

        // דיבאג לפני שליחה ל-HYP
        Log::info('HYP redirect: params before POST', [
            'masof'         => $masof,
            'passp_empty'   => empty($passp),
            'passp_length'  => strlen($passp ?? ''),
            'passp_preview' => $passp ? substr($passp, 0, 3) . '***' : '(null)',
            'restaurant_id' => $restaurant->id,
        ]);

        return response()->view('hyp.order_redirect', [
            'actionUrl' => rtrim($hypActionUrl, '/'),
            'params'    => $params,
        ]);
    }
}


<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Models\PaymentSession;
use App\Models\Restaurant;
use App\Models\FcmToken;
use App\Services\RestaurantPaymentService;
use App\Services\FcmService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * HypOrderCallbackController (B2C)
 *
 * מטפל ב-redirect חזרה מ-HYP אחרי תשלום הזמנה.
 * תומך בשני flows:
 * 1. GET redirect ישיר מ-HYP → הבאקנד מעבד ומפנה לפרונט
 * 2. POST JSON מהפרונט (כש-HYP מפנה ישירות לפרונט) → הבאקנד מעבד ומחזיר JSON
 *
 * HYP עשוי לדרוס את Fild1/Fild2/Fild3 בנתוני לקוח,
 * לכן משתמשים גם ב-Order param (= order ID) כ-fallback.
 */
class HypOrderCallbackController extends Controller
{
    public function __construct(
        private RestaurantPaymentService $paymentService,
    ) {}

    /**
     * GET /api/payments/hyp/order/success
     * HYP מעביר לכאן אחרי תשלום מוצלח — redirect לפרונט
     */
    public function handleSuccess(Request $request)
    {
        $result = $this->processSuccess($request->all());
        return $this->redirectToOrderStatus($result['restaurant_id'], $result['order_id'], $result['status']);
    }

    /**
     * POST /api/payments/hyp/order/success-json
     * הפרונט קורא לכאן עם פרמטרי HYP — מחזיר JSON
     */
    public function handleSuccessJson(Request $request)
    {
        $result = $this->processSuccess($request->all());

        $redirectUrl = $this->buildOrderStatusUrl($result['restaurant_id'], $result['order_id'], $result['status']);

        return response()->json([
            'success'      => $result['status'] === 'success',
            'message'      => $result['message'],
            'redirect_url' => $redirectUrl,
        ]);
    }

    /**
     * GET /api/payments/hyp/order/error
     * HYP מעביר לכאן אחרי כשלון תשלום — redirect לפרונט
     */
    public function handleError(Request $request)
    {
        $result = $this->processError($request->all());
        return $this->redirectToOrderStatus($result['restaurant_id'], $result['order_id'], 'failed');
    }

    /**
     * POST /api/payments/hyp/order/error-json
     * הפרונט קורא לכאן עם פרמטרי HYP — מחזיר JSON
     */
    public function handleErrorJson(Request $request)
    {
        $result = $this->processError($request->all());

        $redirectUrl = $this->buildOrderStatusUrl($result['restaurant_id'], $result['order_id'], 'failed');

        return response()->json([
            'success'      => false,
            'message'      => $result['message'],
            'redirect_url' => $redirectUrl,
        ]);
    }

    /**
     * לוגיקת עיבוד תשלום מוצלח (משותפת ל-GET redirect ו-POST JSON)
     */
    private function processSuccess(array $inputParams): array
    {
        $params = $this->normalizeParams($inputParams);

        $transactionId = $params['transaction_id'];
        $ccode = $params['ccode'];
        $amount = $params['amount'];
        $hypOrderId = $params['order_field'];

        Log::info('HYP order payment success callback', [
            'transaction_id' => $transactionId,
            'ccode'          => $ccode,
            'amount'         => $amount,
            'hyp_order'      => $hypOrderId,
            'fild1'          => $params['fild1'],
            'fild2'          => $params['fild2'],
            'fild3'          => $params['fild3'],
        ]);

        if ($ccode !== 0) {
            Log::warning('HYP order callback: CCode not 0', ['ccode' => $ccode]);
            return $this->resolveOrderContext($params, 'failed', 'התשלום לא אושר');
        }

        // מציאת ההזמנה — קודם דרך Order field, אח"כ fallback ל-Fild3
        $order = $this->findOrder($params);

        if (!$order) {
            Log::error('HYP order callback: order not found', [
                'hyp_order' => $hypOrderId,
                'fild3'     => $params['fild3'],
            ]);
            return ['restaurant_id' => '', 'order_id' => '', 'status' => 'failed', 'message' => 'הזמנה לא נמצאה'];
        }

        $restaurant = Restaurant::withoutGlobalScope('tenant')->find($order->restaurant_id);

        if (!$restaurant) {
            Log::error('HYP order callback: restaurant not found', ['restaurant_id' => $order->restaurant_id]);
            return ['restaurant_id' => '', 'order_id' => $order->id, 'status' => 'failed', 'message' => 'מסעדה לא נמצאה'];
        }

        // Idempotency
        if ($order->payment_status === Order::PAYMENT_PAID) {
            Log::info('HYP order callback: already paid (idempotent)', ['order_id' => $order->id]);
            return ['restaurant_id' => $restaurant->id, 'order_id' => $order->id, 'status' => 'success', 'message' => 'התשלום כבר בוצע'];
        }

        // מציאת session דרך order
        $session = PaymentSession::where('order_id', $order->id)
            ->where('status', '!=', 'completed')
            ->latest()
            ->first();

        if ($session) {
            if ($session->isExpired()) {
                Log::warning('HYP order callback: session expired', ['session_id' => $session->id]);
                $session->update(['status' => 'expired']);
                return ['restaurant_id' => $restaurant->id, 'order_id' => $order->id, 'status' => 'failed', 'message' => 'פג תוקף התשלום'];
            }

            // בדיקת סכום
            $responseAmount = (float) $amount;
            $expectedAmount = (float) $session->amount;
            if ($responseAmount > 0 && abs($responseAmount - $expectedAmount) > 0.01) {
                Log::error('HYP order callback: amount mismatch', [
                    'response' => $responseAmount,
                    'expected' => $expectedAmount,
                ]);
                $session->update(['status' => 'failed', 'error_message' => 'Amount mismatch']);
                return ['restaurant_id' => $restaurant->id, 'order_id' => $order->id, 'status' => 'failed', 'message' => 'חוסר התאמה בסכום'];
            }

            $session->update([
                'status'             => 'completed',
                'hyp_transaction_id' => $transactionId,
                'completed_at'       => now(),
            ]);

            $expectedAmount = $session->amount;
        } else {
            $expectedAmount = (float) $amount;
        }

        // עדכון הזמנה
        $order->update([
            'payment_status'         => Order::PAYMENT_PAID,
            'payment_transaction_id' => $transactionId,
            'payment_amount'         => $expectedAmount,
            'paid_at'                => now(),
        ]);

        Log::info('HYP order payment completed', [
            'order_id'       => $order->id,
            'transaction_id' => $transactionId,
            'amount'         => $expectedAmount,
        ]);

        // FCM push
        try {
            $this->sendOrderNotification(
                tenantId: $restaurant->tenant_id,
                title: "הזמנה חדשה #{$order->id}",
                body: "{$order->customer_name} - ₪{$expectedAmount}",
                data: [
                    'orderId' => (string) $order->id,
                    'type'    => 'new_order',
                    'url'     => '/admin/orders',
                ]
            );
        } catch (\Throwable $e) {
            Log::warning('Failed to send FCM notification after HYP payment', [
                'order_id' => $order->id,
                'error'    => $e->getMessage(),
            ]);
        }

        return ['restaurant_id' => $restaurant->id, 'order_id' => $order->id, 'status' => 'success', 'message' => 'התשלום בוצע בהצלחה'];
    }

    /**
     * לוגיקת עיבוד כשלון תשלום
     */
    private function processError(array $inputParams): array
    {
        $params = $this->normalizeParams($inputParams);

        Log::warning('HYP order payment error callback', [
            'ccode'     => $params['ccode'],
            'error'     => $params['errMsg'],
            'hyp_order' => $params['order_field'],
        ]);

        $order = $this->findOrder($params);

        if ($order) {
            $order->update(['payment_status' => Order::PAYMENT_FAILED]);

            $session = PaymentSession::where('order_id', $order->id)
                ->where('status', '!=', 'completed')
                ->latest()
                ->first();

            if ($session) {
                $session->update([
                    'status'        => 'failed',
                    'error_message' => $params['errMsg'] ?: 'payment_declined',
                ]);
            }

            $restaurant = Restaurant::withoutGlobalScope('tenant')->find($order->restaurant_id);
            return [
                'restaurant_id' => $restaurant?->id ?? '',
                'order_id'      => $order->id,
                'status'        => 'failed',
                'message'       => $params['errMsg'] ?: 'התשלום נכשל',
            ];
        }

        return ['restaurant_id' => '', 'order_id' => '', 'status' => 'failed', 'message' => 'התשלום נכשל'];
    }

    /**
     * מנרמל פרמטרים מ-HYP — תומך ב-query string וגם ב-JSON body
     */
    private function normalizeParams(array $input): array
    {
        return [
            'transaction_id' => $input['Id'] ?? '',
            'ccode'          => (int) ($input['CCode'] ?? -1),
            'amount'         => $input['Amount'] ?? '',
            'order_field'    => $input['Order'] ?? '',
            'fild1'          => $input['Fild1'] ?? '',
            'fild2'          => $input['Fild2'] ?? '',
            'fild3'          => $input['Fild3'] ?? '',
            'errMsg'         => $input['errMsg'] ?? $input['ErrMsg'] ?? '',
            'sign'           => $input['Sign'] ?? '',
        ];
    }

    /**
     * מציאת הזמנה — Order field (order ID) ← Fild3 (fallback)
     */
    private function findOrder(array $params): ?Order
    {
        // נסיון ראשון: Order field (= order.id שלנו)
        $orderId = $params['order_field'];
        if ($orderId && is_numeric($orderId)) {
            $order = Order::withoutGlobalScope('tenant')->find((int) $orderId);
            if ($order) return $order;
        }

        // fallback: Fild3 (אם HYP לא דרס אותו)
        $fild3 = $params['fild3'];
        if ($fild3 && is_numeric($fild3)) {
            $order = Order::withoutGlobalScope('tenant')->find((int) $fild3);
            if ($order) return $order;
        }

        return null;
    }

    /**
     * שליחת התראת Push לטאבלטים של המסעדה
     */
    private function sendOrderNotification(string $tenantId, string $title, string $body, array $data = []): void
    {
        try {
            $tokens = FcmToken::where('tenant_id', $tenantId)->pluck('token');
            if ($tokens->isEmpty()) return;

            $fcm = app(FcmService::class);
            foreach ($tokens as $token) {
                $fcm->sendToToken($token, $title, $body, $data);
            }
        } catch (\Throwable $e) {
            Log::warning('Failed to send FCM notification (HypOrderCallbackController)', [
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * מחפש context של הזמנה גם כשלא נמצאה ישירות
     */
    private function resolveOrderContext(array $params, string $status, string $message): array
    {
        $order = $this->findOrder($params);
        $restaurant = $order ? Restaurant::withoutGlobalScope('tenant')->find($order->restaurant_id) : null;

        return [
            'restaurant_id' => $restaurant?->id ?? '',
            'order_id'      => $order?->id ?? '',
            'status'        => $status,
            'message'       => $message,
        ];
    }

    private function redirectToOrderStatus(string $restaurantId, string $orderId, string $paymentStatus): \Illuminate\Http\RedirectResponse
    {
        $url = $this->buildOrderStatusUrl($restaurantId, $orderId, $paymentStatus);
        return redirect()->away($url);
    }

    private function buildOrderStatusUrl(string $restaurantId, string $orderId, string $paymentStatus): string
    {
        $restaurant = $restaurantId ? Restaurant::withoutGlobalScope('tenant')->find($restaurantId) : null;
        $tenantSlug = $restaurant?->tenant_id ?? '';

        $frontendUrl = rtrim(config('app.frontend_url', 'https://www.takeeat.co.il'), '/');

        if ($tenantSlug && $orderId) {
            return "{$frontendUrl}/{$tenantSlug}/order-status/{$orderId}?payment={$paymentStatus}";
        }

        return "{$frontendUrl}/?payment={$paymentStatus}";
    }
}

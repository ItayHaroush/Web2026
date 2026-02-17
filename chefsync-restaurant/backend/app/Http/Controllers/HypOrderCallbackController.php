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
 * משתמש ב-Masof של המסעדה לאימות.
 */
class HypOrderCallbackController extends Controller
{
    public function __construct(
        private RestaurantPaymentService $paymentService,
    ) {}

    /**
     * GET /api/payments/hyp/order/success
     * HYP מעביר לכאן אחרי תשלום מוצלח של הזמנה
     */
    public function handleSuccess(Request $request)
    {
        $params = $this->paymentService->parseRedirectParams($request);
        $sessionToken = $params['fild1'];
        $restaurantId = $params['fild2'];
        $orderId = $params['fild3'];
        $transactionId = $params['transaction_id'];

        Log::info('HYP order payment success redirect', [
            'session_token'  => $sessionToken,
            'restaurant_id'  => $restaurantId,
            'order_id'       => $orderId,
            'transaction_id' => $transactionId,
            'ccode'          => $params['ccode'],
            'amount'         => $params['amount'],
        ]);

        if (!$params['success']) {
            Log::warning('HYP order callback: CCode not 0', $params);
            return $this->redirectToOrderStatus($restaurantId, $orderId, 'failed');
        }

        // שליפת session
        $session = PaymentSession::where('session_token', $sessionToken)->first();

        if (!$session) {
            Log::error('HYP order callback: session not found', ['token' => $sessionToken]);
            return $this->redirectToOrderStatus($restaurantId, $orderId, 'failed');
        }

        // Idempotency: אם session כבר completed — פשוט redirect בלי עדכון כפול
        if ($session->status === 'completed') {
            Log::info('HYP order callback: session already completed (idempotent)', ['token' => $sessionToken]);
            return $this->redirectToOrderStatus($restaurantId, $orderId, 'success');
        }

        // בדיקת תפוגת session
        if ($session->isExpired()) {
            Log::warning('HYP order callback: session expired', ['token' => $sessionToken, 'expires_at' => $session->expires_at]);
            $session->update(['status' => 'expired']);
            return $this->redirectToOrderStatus($restaurantId, $orderId, 'failed');
        }

        $restaurant = Restaurant::withoutGlobalScope('tenant')->find($restaurantId);
        $order = Order::withoutGlobalScope('tenant')->find($orderId);

        if (!$restaurant || !$order) {
            Log::error('HYP order callback: restaurant or order not found', [
                'restaurant_id' => $restaurantId,
                'order_id' => $orderId,
            ]);
            return $this->redirectToOrderStatus($restaurantId, $orderId, 'failed');
        }

        // Idempotency: אם order כבר paid — redirect בלי עדכון כפול
        if ($order->payment_status === Order::PAYMENT_PAID) {
            Log::info('HYP order callback: order already paid (idempotent)', ['order_id' => $orderId]);
            return $this->redirectToOrderStatus($restaurantId, $orderId, 'success');
        }

        // בדיקת התאמת סכום — מניעת זיוף
        $responseAmount = (float) $params['amount'];
        $expectedAmount = (float) $session->amount;
        if ($responseAmount > 0 && abs($responseAmount - $expectedAmount) > 0.01) {
            Log::error('HYP order callback: amount mismatch', [
                'response_amount' => $responseAmount,
                'expected_amount' => $expectedAmount,
                'order_id'        => $orderId,
            ]);
            $session->update(['status' => 'failed', 'error_message' => 'Amount mismatch']);
            return $this->redirectToOrderStatus($restaurantId, $orderId, 'failed');
        }

        // עדכון session
        $session->update([
            'status'              => 'completed',
            'hyp_transaction_id'  => $transactionId,
            'completed_at'        => now(),
        ]);

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

        // שליחת פוש לטאבלטים של המסעדה רק אחרי אישור תשלום באשראי
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

        return $this->redirectToOrderStatus($restaurantId, $orderId, 'success');
    }

    /**
     * GET /api/payments/hyp/order/error
     * HYP מעביר לכאן אחרי כשלון תשלום הזמנה
     */
    public function handleError(Request $request)
    {
        $params = $this->paymentService->parseRedirectParams($request);
        $sessionToken = $params['fild1'];
        $restaurantId = $params['fild2'];
        $orderId = $params['fild3'];

        Log::warning('HYP order payment error redirect', [
            'session_token'  => $sessionToken,
            'restaurant_id'  => $restaurantId,
            'order_id'       => $orderId,
            'ccode'          => $params['ccode'],
            'error'          => $params['errMsg'],
        ]);

        // עדכון session
        $session = PaymentSession::where('session_token', $sessionToken)->first();
        if ($session) {
            $session->update([
                'status'        => 'failed',
                'error_message' => $params['errMsg'] ?: 'payment_declined',
            ]);
        }

        // עדכון הזמנה
        $order = Order::withoutGlobalScope('tenant')->find($orderId);
        if ($order) {
            $order->update([
                'payment_status' => Order::PAYMENT_FAILED,
            ]);
        }

        return $this->redirectToOrderStatus($restaurantId, $orderId, 'failed');
    }

    /**
     * שליחת התראת Push לטאבלטים של המסעדה (העתק מהלוגיקה ב-OrderController)
     */
    private function sendOrderNotification(string $tenantId, string $title, string $body, array $data = []): void
    {
        try {
            $tokens = FcmToken::where('tenant_id', $tenantId)->pluck('token');
            if ($tokens->isEmpty()) {
                return;
            }

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

    private function redirectToOrderStatus(string $restaurantId, string $orderId, string $paymentStatus): \Illuminate\Http\RedirectResponse
    {
        $restaurant = Restaurant::withoutGlobalScope('tenant')->find($restaurantId);
        $tenantSlug = $restaurant?->tenant_id ?? '';

        $frontendUrl = rtrim(config('app.frontend_url', 'https://www.takeeat.co.il'), '/');
        $url = "{$frontendUrl}/{$tenantSlug}/order-status/{$orderId}?payment={$paymentStatus}";

        return redirect()->away($url);
    }
}

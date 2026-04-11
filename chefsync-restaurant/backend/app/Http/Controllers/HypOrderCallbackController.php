<?php

namespace App\Http\Controllers;

use App\Models\CartSession;
use App\Models\FcmToken;
use App\Models\MonitoringAlert;
use App\Models\NotificationLog;
use App\Models\Order;
use App\Models\PaymentSession;
use App\Models\Restaurant;
use App\Models\User;
use App\Services\FcmService;
use App\Services\RestaurantPaymentService;
use App\Services\SystemErrorReporter;
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
            'success' => $result['status'] === 'success',
            'message' => $result['message'],
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
            'success' => false,
            'message' => $result['message'],
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
            'ccode' => $ccode,
            'amount' => $amount,
            'hyp_order' => $hypOrderId,
            'fild1' => $params['fild1'],
            'fild2' => $params['fild2'],
            'fild3' => $params['fild3'],
        ]);

        // מציאת הזמנה לפני בדיקת CCode — כדי לעדכן payment_status=failed בדשבורד/קופה
        $order = $this->findOrder($params);

        if ($ccode !== 0) {
            Log::warning('HYP order callback: CCode not 0', ['ccode' => $ccode]);
            if ($order) {
                $this->markOrderCreditPaymentFailed(
                    $order,
                    trim(($params['errMsg'] ?: '') . ' CCode=' . $ccode) ?: 'התשלום לא אושר'
                );
            }

            return $this->resolveOrderContext($params, 'failed', 'התשלום לא אושר');
        }

        if (! $order) {
            Log::error('HYP order callback: order not found', [
                'hyp_order' => $hypOrderId,
                'fild3' => $params['fild3'],
            ]);

            return ['restaurant_id' => '', 'order_id' => '', 'status' => 'failed', 'message' => 'הזמנה לא נמצאה'];
        }

        $restaurant = Restaurant::withoutGlobalScope('tenant')->find($order->restaurant_id);

        if (! $restaurant) {
            Log::error('HYP order callback: restaurant not found', ['restaurant_id' => $order->restaurant_id]);
            $this->markOrderCreditPaymentFailed($order, 'מסעדה לא נמצאה');

            return ['restaurant_id' => '', 'order_id' => $order->id, 'status' => 'failed', 'message' => 'מסעדה לא נמצאה'];
        }

        // Idempotency
        if ($order->payment_status === Order::PAYMENT_PAID) {
            Log::info('HYP order callback: already paid (idempotent)', ['order_id' => $order->id]);
            if ($order->status === Order::STATUS_AWAITING_PAYMENT) {
                $order->update(['status' => Order::STATUS_PENDING]);
                try {
                    CartSession::markCompletedForB2COrder($order->fresh());
                } catch (\Throwable $e) {
                    Log::warning('CartSession markCompleted (idempotent)', ['order_id' => $order->id, 'error' => $e->getMessage()]);
                }
            }

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
                $this->markOrderCreditPaymentFailed($order, 'פג תוקף התשלום');

                return ['restaurant_id' => $restaurant->id, 'order_id' => $order->id, 'status' => 'failed', 'message' => 'פג תוקף התשלום'];
            }

            // בדיקת סכום — תשלום חלקי נשאר pending, תשלום מלא = paid
            $responseAmount = (float) $amount;
            $expectedAmount = (float) $session->amount;
            $isPartialPayment = $responseAmount > 0 && ($responseAmount < $expectedAmount - 0.01);

            if ($isPartialPayment) {
                Log::info('HYP order callback: partial payment received', [
                    'response' => $responseAmount,
                    'expected' => $expectedAmount,
                    'order_id' => $order->id,
                ]);
            }

            $session->update([
                'status' => $isPartialPayment ? 'partial' : 'completed',
                'hyp_transaction_id' => $transactionId,
                'completed_at' => now(),
            ]);

            $paidAmount = $responseAmount > 0 ? $responseAmount : $session->amount;
        } else {
            $paidAmount = (float) $amount;
            $expectedAmount = (float) $order->total_amount;
            $isPartialPayment = $paidAmount > 0 && ($paidAmount < $expectedAmount - 0.01);
        }

        // עדכון הזמנה — תשלום מלא = paid, חלקי = נשאר pending
        $orderUpdates = [
            'payment_transaction_id' => $transactionId,
            'payment_amount' => ($order->payment_amount ?? 0) + $paidAmount,
            'paid_at' => now(),
        ];

        if ($isPartialPayment) {
            // תשלום חלקי — נשאר pending, לא מעדכנים סטטוס
            $orderUpdates['payment_status'] = Order::PAYMENT_PENDING;
            Log::info('HYP order partial payment kept pending', [
                'order_id' => $order->id,
                'paid' => $paidAmount,
                'total' => $expectedAmount,
                'remaining' => $expectedAmount - $paidAmount,
            ]);
        } else {
            // תשלום מלא — סימון כשולם
            $orderUpdates['payment_status'] = Order::PAYMENT_PAID;
            if ($order->status === Order::STATUS_AWAITING_PAYMENT) {
                $orderUpdates['status'] = Order::STATUS_PENDING;
            }
            // הזמנת מזומן ששולמה באשראי דרך QR — עדכון אמצעי תשלום בפועל
            if ($order->payment_method === 'cash') {
                $orderUpdates['actual_payment_method'] = 'credit_card';
            }
        }
        $order->update($orderUpdates);

        try {
            CartSession::markCompletedForB2COrder($order->fresh());
        } catch (\Throwable $e) {
            Log::warning('CartSession markCompleted after HYP payment', ['order_id' => $order->id, 'error' => $e->getMessage()]);
        }

        $statusResult = $isPartialPayment ? 'partial' : 'success';

        Log::info('HYP order payment processed', [
            'order_id' => $order->id,
            'transaction_id' => $transactionId,
            'amount' => $paidAmount,
            'partial' => $isPartialPayment,
        ]);

        // FCM — רגילה: new_order למטבח; עתידית: future_order_created בלבד (new_order יישלח ב-ProcessFutureOrders)
        try {
            $isFutureOrder = (bool) $order->is_future_order;
            $baseBody = "{$order->customer_name} - ₪{$paidAmount}";

            if ($isFutureOrder) {
                $scheduledTime = $order->scheduled_for
                    ? \Carbon\Carbon::parse($order->scheduled_for)->timezone('Asia/Jerusalem')->format('d/m H:i')
                    : '';
                $notificationTitle = "הזמנה עתידית נרשמה #{$order->id}";
                $notificationBody = $scheduledTime !== ''
                    ? "{$baseBody} — מתוכננת ל-{$scheduledTime}"
                    : $baseBody;
                $notificationType = 'future_order_created';
                $alertType = 'future_order_created';
                $deepLink = '/admin/dashboard';
            } else {
                $notificationTitle = "הזמנה חדשה #{$order->id}";
                $notificationBody = $baseBody;
                $notificationType = 'new_order';
                $alertType = 'new_order';
                $deepLink = '/admin/orders';
            }

            $this->sendOrderNotification(
                tenantId: $restaurant->tenant_id,
                title: $notificationTitle,
                body: $notificationBody,
                data: [
                    'orderId' => (string) $order->id,
                    'type' => $notificationType,
                    'url' => $deepLink,
                ]
            );

            MonitoringAlert::create([
                'tenant_id' => $restaurant->tenant_id,
                'restaurant_id' => $restaurant->id,
                'alert_type' => $alertType,
                'title' => $notificationTitle,
                'body' => $notificationBody,
                'severity' => 'info',
                'metadata' => ['order_id' => $order->id, 'scheduled_for' => $order->scheduled_for],
                'is_read' => false,
            ]);

            $this->sendSuperAdminOrderAlert($order, $restaurant);
        } catch (\Throwable $e) {
            Log::warning('Failed to send FCM notification after HYP payment', [
                'order_id' => $order->id,
                'error' => $e->getMessage(),
            ]);
        }

        $message = $isPartialPayment
            ? 'תשלום חלקי התקבל — ממתין להשלמת הסכום'
            : 'התשלום בוצע בהצלחה';

        return ['restaurant_id' => $restaurant->id, 'order_id' => $order->id, 'status' => $statusResult, 'message' => $message];
    }

    /**
     * לוגיקת עיבוד כשלון תשלום
     */
    private function processError(array $inputParams): array
    {
        $params = $this->normalizeParams($inputParams);

        Log::warning('HYP order payment error callback', [
            'ccode' => $params['ccode'],
            'error' => $params['errMsg'],
            'hyp_order' => $params['order_field'],
        ]);

        $order = $this->findOrder($params);

        if ($order) {
            $order->update(['payment_status' => Order::PAYMENT_FAILED]);

            SystemErrorReporter::report(
                'payment_failure',
                'תשלום אשראי (HYP) נכשל: ' . ($params['errMsg'] ?: 'לא צוינה סיבה'),
                'warning',
                $order->tenant_id,
                $order->id,
                $order->correlation_id,
                null,
                ['ccode' => $params['ccode'] ?? null, 'hyp_order' => $params['order_field'] ?? null]
            );

            $session = PaymentSession::where('order_id', $order->id)
                ->where('status', '!=', 'completed')
                ->latest()
                ->first();

            if ($session) {
                $session->update([
                    'status' => 'failed',
                    'error_message' => $params['errMsg'] ?: 'payment_declined',
                ]);
            }

            $restaurant = Restaurant::withoutGlobalScope('tenant')->find($order->restaurant_id);

            // --- Notification for payment failure ---
            $tenantId = $restaurant?->tenant_id;
            if ($tenantId) {
                try {
                    MonitoringAlert::create([
                        'tenant_id' => $tenantId,
                        'restaurant_id' => $order->restaurant_id,
                        'alert_type' => 'payment_failed',
                        'title' => "תשלום נכשל — הזמנה #{$order->id}",
                        'body' => "תשלום באשראי נכשל עבור הזמנה #{$order->id} ({$order->customer_name}, ₪{$order->total_amount}). " . ($params['errMsg'] ?: 'סיבה לא ידועה'),
                        'severity' => 'critical',
                        'metadata' => ['order_id' => $order->id, 'error' => $params['errMsg']],
                        'is_read' => false,
                    ]);
                } catch (\Throwable $e) {
                    Log::warning('Failed to create MonitoringAlert for payment failure', ['error' => $e->getMessage()]);
                }
                try {
                    NotificationLog::create([
                        'channel' => 'system',
                        'type' => 'order_alert',
                        'title' => 'תשלום נכשל: ' . ($restaurant->name ?? $tenantId) . " — #{$order->id}",
                        'body' => "תשלום באשראי נכשל עבור הזמנה #{$order->id} (₪{$order->total_amount}). " . ($params['errMsg'] ?: ''),
                        'sender_id' => null,
                        'target_restaurant_ids' => [$order->restaurant_id],
                        'tokens_targeted' => 0,
                        'sent_ok' => 0,
                        'metadata' => ['order_id' => $order->id, 'action' => 'payment_failed', 'error' => $params['errMsg']],
                    ]);
                } catch (\Throwable $e) {
                    Log::warning('Failed to create NotificationLog for payment failure', ['error' => $e->getMessage()]);
                }
            }

            return [
                'restaurant_id' => $restaurant?->id ?? '',
                'order_id' => $order->id,
                'status' => 'failed',
                'message' => $params['errMsg'] ?: 'התשלום נכשל',
            ];
        }

        return ['restaurant_id' => '', 'order_id' => '', 'status' => 'failed', 'message' => 'התשלום נכשל'];
    }

    /**
     * תשלום אשראי (HYP) נדחה או נכשל — מעדכן הזמנה ו-session כדי שהקופה/דשבורד יראו תגית כשלון.
     */
    private function markOrderCreditPaymentFailed(Order $order, string $errorMessage = ''): void
    {
        if ($order->payment_status === Order::PAYMENT_PAID) {
            return;
        }

        if ($order->payment_method !== 'credit_card') {
            return;
        }

        $order->update(['payment_status' => Order::PAYMENT_FAILED]);

        $session = PaymentSession::where('order_id', $order->id)
            ->whereNotIn('status', ['completed'])
            ->latest()
            ->first();

        if ($session) {
            $session->update([
                'status' => 'failed',
                'error_message' => $errorMessage !== '' ? $errorMessage : 'payment_declined',
            ]);
        }
    }

    /**
     * מנרמל פרמטרים מ-HYP — תומך ב-query string וגם ב-JSON body
     */
    private function normalizeParams(array $input): array
    {
        return [
            'transaction_id' => $input['Id'] ?? '',
            'ccode' => (int) ($input['CCode'] ?? -1),
            'amount' => $input['Amount'] ?? '',
            'order_field' => $input['Order'] ?? '',
            'fild1' => $input['Fild1'] ?? '',
            'fild2' => $input['Fild2'] ?? '',
            'fild3' => $input['Fild3'] ?? '',
            'errMsg' => $input['errMsg'] ?? $input['ErrMsg'] ?? '',
            'sign' => $input['Sign'] ?? '',
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
            if ($order) {
                return $order;
            }
        }

        // fallback: Fild3 (אם HYP לא דרס אותו)
        $fild3 = $params['fild3'];
        if ($fild3 && is_numeric($fild3)) {
            $order = Order::withoutGlobalScope('tenant')->find((int) $fild3);
            if ($order) {
                return $order;
            }
        }

        return null;
    }

    /**
     * התראת סופר אדמין על הזמנה חדשה (אשראי)
     */
    private function sendSuperAdminOrderAlert(Order $order, Restaurant $restaurant): void
    {
        try {
            $superAdmins = User::where('is_super_admin', true)->pluck('id');
            if ($superAdmins->isEmpty()) {
                return;
            }

            $tokens = FcmToken::withoutGlobalScopes()
                ->where('tenant_id', '__super_admin__')
                ->whereIn('user_id', $superAdmins)
                ->pluck('token');

            if ($tokens->isEmpty()) {
                return;
            }

            $title = "הזמנה חדשה (אשראי) - {$restaurant->name}";
            $body = "#{$order->id} | {$order->customer_name} | ₪{$order->total_amount}";

            $fcm = app(FcmService::class);
            foreach ($tokens as $token) {
                $fcm->sendToToken($token, $title, $body, [
                    'type' => 'super_admin_order_alert',
                    'orderId' => (string) $order->id,
                    'tenantId' => $restaurant->tenant_id,
                ]);
            }

            NotificationLog::create([
                'channel' => 'push',
                'type' => 'order_alert',
                'title' => $title,
                'body' => $body,
                'sender_id' => null,
                'target_restaurant_ids' => [],
                'tokens_targeted' => $tokens->count(),
                'sent_ok' => $tokens->count(),
                'metadata' => ['order_id' => $order->id, 'tenant_id' => $restaurant->tenant_id, 'source' => 'credit_card'],
            ]);
        } catch (\Throwable $e) {
            Log::warning('Failed to send super admin order alert (HYP)', ['error' => $e->getMessage()]);
        }
    }

    /**
     * שליחת התראת Push לטאבלטים של המסעדה
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

    /**
     * מחפש context של הזמנה גם כשלא נמצאה ישירות
     */
    private function resolveOrderContext(array $params, string $status, string $message): array
    {
        $order = $this->findOrder($params);
        $restaurant = $order ? Restaurant::withoutGlobalScope('tenant')->find($order->restaurant_id) : null;

        return [
            'restaurant_id' => $restaurant?->id ?? '',
            'order_id' => $order?->id ?? '',
            'status' => $status,
            'message' => $message,
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

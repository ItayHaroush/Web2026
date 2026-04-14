<?php

namespace App\Services;

use App\Models\CashMovement;
use App\Models\CashRegisterShift;
use App\Models\MonitoringAlert;
use App\Models\NotificationLog;
use App\Models\Order;
use App\Models\Payment;
use App\Models\PosSession;
use App\Models\Restaurant;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class OrderRefundService
{
    public function __construct(
        private RestaurantPaymentService $restaurantPaymentService,
        private ZCreditResolver $zCreditResolver
    ) {}

    /**
     * @return array{success: bool, message: string}
     */
    public function refund(Order $order, User $user, ?PosSession $posSession = null, bool $requireCancelledPendingRefund = true): array
    {
        $restaurantId = (int) $user->restaurant_id;
        if ($order->restaurant_id !== $restaurantId) {
            return ['success' => false, 'message' => 'ההזמנה שייכת למסעדה אחרת'];
        }

        if ($order->payment_status !== Order::PAYMENT_PAID) {
            return ['success' => false, 'message' => 'ההזמנה לא שולמה — לא ניתן לבצע החזר'];
        }

        if ($requireCancelledPendingRefund) {
            if ($order->status !== Order::STATUS_CANCELLED) {
                return ['success' => false, 'message' => 'ניתן להחזיר רק הזמנה שבוטלה'];
            }
            if ($order->refund_pending_at === null) {
                return ['success' => false, 'message' => 'ההזמנה אינה מסומנת כממתינה להחזר'];
            }
        }

        $amount = $order->effectiveChargedAmount();

        $payment = Payment::where('order_id', $order->id)
            ->where('status', 'approved')
            ->latest()
            ->first();

        $referenceNumber = $payment?->transaction_id ?? $order->payment_transaction_id;

        $isMockReference = $referenceNumber
            && (str_starts_with((string) $referenceNumber, 'MOCK_')
                || str_starts_with((string) $referenceNumber, 'LOCAL-DEMO-'));

        $useZCredit = ($payment && $payment->provider === 'zcredit')
            || $isMockReference
            || ($order->source === 'pos' && $referenceNumber);

        $useHyp = ! $useZCredit
            && $order->payment_method === 'credit_card'
            && $referenceNumber;

        $isCreditRefund = $useZCredit || $useHyp;

        if ($useZCredit && $referenceNumber) {
            $restaurant = Restaurant::find($restaurantId);
            $zcredit = $restaurant
                ? $this->zCreditResolver->forOrder($order, $posSession)
                : new ZCreditService(null, null, null, false);
            $result = $zcredit->refundTransaction($referenceNumber, $amount);

            if (! $result['success']) {
                return [
                    'success' => false,
                    'message' => $result['data']['error_message'] ?? 'שגיאה בביצוע ההחזר',
                ];
            }

            if ($payment) {
                $payment->update([
                    'status' => 'refunded',
                    'provider_response' => $result['data']['full_response'] ?? null,
                ]);
            }
        } elseif ($useHyp && $referenceNumber) {
            $restaurant = Restaurant::find($restaurantId);
            if (! $restaurant || ! $this->restaurantPaymentService->isRestaurantReady($restaurant)) {
                return ['success' => false, 'message' => 'מסוף האשראי של המסעדה אינו מוכן להחזר HYP'];
            }

            $hypResult = $this->restaurantPaymentService->refundOrder($restaurant, (string) $referenceNumber, $amount);
            if (! $hypResult['success']) {
                return [
                    'success' => false,
                    'message' => $hypResult['error'] ?? 'שגיאה בביצוע ההחזר בהיפ',
                ];
            }
        }

        DB::transaction(function () use ($order, $restaurantId, $user, $isCreditRefund, $amount) {
            $order->update([
                'status' => Order::STATUS_CANCELLED,
                'payment_status' => Order::PAYMENT_REFUNDED,
                'refund_pending_at' => null,
            ]);

            $shift = CashRegisterShift::where('restaurant_id', $restaurantId)
                ->whereNull('closed_at')
                ->first();

            if ($shift) {
                CashMovement::create([
                    'shift_id' => $shift->id,
                    'order_id' => $order->id,
                    'user_id' => $user->id,
                    'type' => 'refund',
                    'payment_method' => $isCreditRefund ? 'credit' : 'cash',
                    'amount' => $amount,
                    'description' => "החזר הזמנה #{$order->id}",
                ]);
            }
        });

        $this->sendRefundNotifications($order, $user, $amount);

        return ['success' => true, 'message' => 'ההחזר בוצע בהצלחה'];
    }

    private function sendRefundNotifications(Order $order, User $user, float $amount): void
    {
        try {
            $restaurant = Restaurant::find($order->restaurant_id);
            $restaurantId = $order->restaurant_id;
            $tenantId = $restaurant?->tenant_id;
            if ($tenantId) {
                MonitoringAlert::create([
                    'tenant_id' => $tenantId,
                    'restaurant_id' => $restaurantId,
                    'alert_type' => 'order_refunded',
                    'title' => "החזר כספי — הזמנה #{$order->id}",
                    'body' => "בוצע החזר כספי בסך ₪{$amount} עבור הזמנה #{$order->id} ({$order->customer_name}) על ידי {$user->name}.",
                    'severity' => 'warning',
                    'metadata' => ['order_id' => $order->id, 'amount' => $amount, 'refunded_by' => $user->name],
                    'is_read' => false,
                ]);
                NotificationLog::create([
                    'channel' => 'system',
                    'type' => 'order_alert',
                    'title' => 'החזר: '.($restaurant->name ?? '')." — #{$order->id}",
                    'body' => "החזר ₪{$amount} בוצע להזמנה #{$order->id} ({$order->customer_name}) על ידי {$user->name}.",
                    'sender_id' => null,
                    'target_restaurant_ids' => [$restaurantId],
                    'tokens_targeted' => 0,
                    'sent_ok' => 0,
                    'metadata' => ['action' => 'order_refund', 'order_id' => $order->id, 'amount' => $amount],
                ]);
            }
        } catch (\Throwable $e) {
            Log::warning('Failed to create refund notification', ['error' => $e->getMessage()]);
        }
    }
}

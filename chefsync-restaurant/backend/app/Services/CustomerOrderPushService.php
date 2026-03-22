<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\CustomerPushToken;
use App\Models\CustomerRestaurantNotificationOptIn;
use App\Models\Order;
use Illuminate\Support\Facades\Log;

/**
 * פוש סטטוס הזמנה ללקוחות קצה (PWA) — רק אחרי opt-in למסעדה ורישום טוקן.
 */
class CustomerOrderPushService
{
    /**
     * תזכורת: הזמנה נשארה ב־pending (תשלום או המתנה לאישור מסעדה).
     * קישור לעמוד סטטוס אותה הזמנה עם continue=1.
     *
     * @return bool true אם נשלח FCM לפחות לטוקן אחד בהצלחה
     */
    public function sendPendingOrderReminder(Order $order): bool
    {
        $customer = $this->resolveCustomer($order);
        if (!$customer) {
            return false;
        }

        $tenantId = trim((string) $order->tenant_id);
        if ($tenantId === '') {
            return false;
        }

        if (!$this->customerAllowsPushForTenant($customer, $tenantId)) {
            return false;
        }

        $needPayment = $order->payment_method === 'credit_card'
            && $order->payment_status === Order::PAYMENT_PENDING;

        $messages = config('push.messages.customer_pending_reminder', []);
        $message = $needPayment
            ? ($messages['need_payment'] ?? null)
            : ($messages['awaiting_restaurant'] ?? null);

        if (!$message || empty($message['title']) || empty($message['body'])) {
            return false;
        }

        $tokens = $this->tokensForCustomerAndTenant($customer->id, $tenantId);
        if ($tokens->isEmpty()) {
            return false;
        }

        $path = '/' . rawurlencode($tenantId) . '/order-status/' . $order->id . '?continue=1';
        $data = [
            'type' => 'customer_pending_order',
            'orderId' => (string) $order->id,
            'tenantId' => $tenantId,
            'status' => $order->status,
            'action' => 'continue',
            'url' => $path,
        ];

        $fcm = app(FcmService::class);
        $anyOk = false;
        foreach ($tokens as $token) {
            try {
                if ($fcm->sendToToken($token, $message['title'], $message['body'], $data)) {
                    $anyOk = true;
                }
            } catch (\Throwable $e) {
                Log::warning('Customer pending reminder FCM failed', [
                    'error' => $e->getMessage(),
                    'order_id' => $order->id,
                    'customer_id' => $customer->id,
                ]);
            }
        }

        return $anyOk;
    }

    /**
     * שליחת התראת סטטוס הזמנה ללקוח המזוהה מההזמנה.
     */
    public function sendOrderStatusPush(Order $order, string $status): void
    {
        if (in_array($status, [Order::STATUS_PENDING, Order::STATUS_AWAITING_PAYMENT], true)) {
            return;
        }

        $customer = $this->resolveCustomer($order);
        if (!$customer) {
            return;
        }

        $tenantId = trim((string) $order->tenant_id);
        if ($tenantId === '') {
            return;
        }

        if (!$this->customerAllowsPushForTenant($customer, $tenantId)) {
            return;
        }

        $message = $this->resolveMessage($order, $status);
        if (!$message) {
            return;
        }

        $tokens = $this->tokensForCustomerAndTenant($customer->id, $tenantId);
        if ($tokens->isEmpty()) {
            return;
        }

        $data = $this->buildDataPayload($order, $status, $tenantId);
        $fcm = app(FcmService::class);

        foreach ($tokens as $token) {
            try {
                $fcm->sendToToken($token, $message['title'], $message['body'], $data);
            } catch (\Throwable $e) {
                Log::warning('Customer order status FCM failed', [
                    'error' => $e->getMessage(),
                    'order_id' => $order->id,
                    'customer_id' => $customer->id,
                ]);
            }
        }
    }

    private function resolveCustomer(Order $order): ?Customer
    {
        if ($order->customer_id) {
            $c = Customer::find($order->customer_id);
            if ($c) {
                return $c;
            }
        }

        if (empty($order->customer_phone)) {
            return null;
        }

        $phone = PhoneValidationService::normalizeIsraeliMobileE164((string) $order->customer_phone);
        if (!$phone) {
            return null;
        }

        return Customer::query()->where('phone', $phone)->first();
    }

    private function customerAllowsPushForTenant(Customer $customer, string $tenantId): bool
    {
        return CustomerRestaurantNotificationOptIn::query()
            ->where('customer_id', $customer->id)
            ->where('tenant_id', $tenantId)
            ->where('enabled', true)
            ->exists();
    }

    private function resolveMessageKey(Order $order, string $status): string
    {
        $messageKey = $status;
        if ($status === 'ready' || $status === 'delivered') {
            $messageKey = $order->delivery_method === 'pickup'
                ? $status . '_pickup'
                : $status . '_delivery';
        }

        return $messageKey;
    }

    /**
     * @return array{title: string, body: string}|null
     */
    private function resolveMessage(Order $order, string $status): ?array
    {
        $customerMessages = config('push.messages.customer_status', []);
        $key = $this->resolveMessageKey($order, $status);

        $message = $customerMessages[$key] ?? $customerMessages[$status] ?? null;
        if ($message) {
            return $message;
        }

        $fallback = config('push.messages.status', []);

        $message = $fallback[$key] ?? $fallback[$status] ?? null;

        return $message;
    }

    private function tokensForCustomerAndTenant(int $customerId, string $tenantId)
    {
        return CustomerPushToken::query()
            ->where('customer_id', $customerId)
            ->where(function ($q) use ($tenantId) {
                $q->whereNull('tenant_id')->orWhere('tenant_id', $tenantId);
            })
            ->pluck('token')
            ->unique()
            ->values();
    }

    /**
     * @return array<string, string>
     */
    private function buildDataPayload(Order $order, string $status, string $tenantId): array
    {
        $path = '/' . rawurlencode($tenantId) . '/order-status/' . $order->id;

        $data = [
            'type' => 'customer_order_status',
            'orderId' => (string) $order->id,
            'tenantId' => $tenantId,
            'status' => $status,
            'url' => $path,
        ];

        if ($status === Order::STATUS_DELIVERED) {
            $data['action'] = 'review';
            $data['url'] = $path . '?review=1';
        }

        return $data;
    }
}

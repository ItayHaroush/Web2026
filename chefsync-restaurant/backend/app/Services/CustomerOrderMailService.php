<?php

namespace App\Services;

use App\Mail\CustomerOrderCancelledMail;
use App\Mail\CustomerOrderReceiptMail;
use App\Models\Customer;
use App\Models\Order;
use App\Models\Restaurant;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class CustomerOrderMailService
{
    /**
     * שליחת מייל ללקוח לפי שינוי סטטוס הזמנה
     * נשלח רק אם ללקוח יש מייל מאומת
     */
    public static function sendOnStatusChange(Order $order, string $newStatus): void
    {
        if (! in_array($newStatus, ['delivered', 'cancelled'])) {
            return;
        }

        try {
            $customer = $order->customer_id
                ? Customer::find($order->customer_id)
                : Customer::where('phone', $order->customer_phone)->first();

            if (! $customer || empty($customer->email) || empty($customer->email_verified_at)) {
                return;
            }

            $restaurant = Restaurant::withoutGlobalScope('tenant')->find($order->restaurant_id);
            if (! $restaurant) {
                return;
            }

            $order->loadMissing('items.menuItem');

            $subject = '';
            $type = '';

            if ($newStatus === 'delivered') {
                $mailable = new CustomerOrderReceiptMail($order, $customer, $restaurant);
                $subject = "קבלה - הזמנה #{$order->id}";
                $type = 'order_receipt';
                Mail::to($customer->email)->send($mailable);
            } elseif ($newStatus === 'cancelled') {
                $mailable = new CustomerOrderCancelledMail($order, $customer, $restaurant);
                $subject = "ביטול הזמנה #{$order->id}";
                $type = 'order_cancelled';
                Mail::to($customer->email)->send($mailable);
            }

            if ($type) {
                EmailLogService::log($customer->email, $type, $subject, $customer->id, 'sent', null, [
                    'order_id' => $order->id,
                    'restaurant_id' => $order->restaurant_id,
                ]);
            }
        } catch (\Throwable $e) {
            Log::warning('Failed to send customer order status email', [
                'order_id' => $order->id,
                'status' => $newStatus,
                'error' => $e->getMessage(),
            ]);

            SystemErrorReporter::report(
                'email_failure',
                'מייל סטטוס הזמנה ללקוח נכשל: '.$e->getMessage(),
                'warning',
                $order->tenant_id,
                $order->id,
                $order->correlation_id,
                $e->getTraceAsString(),
                ['new_status' => $newStatus, 'customer_id' => isset($customer) ? $customer->id : null]
            );

            try {
                $customerId = isset($customer) ? $customer->id : null;
                $email = isset($customer) ? $customer->email : 'unknown';
                EmailLogService::log($email, 'order_'.$newStatus, "Failed: order #{$order->id}", $customerId, 'failed', $e->getMessage());
            } catch (\Throwable $logErr) {
                // Silently ignore logging failures
            }
        }
    }
}

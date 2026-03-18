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
        if (!in_array($newStatus, ['delivered', 'cancelled'])) {
            return;
        }

        try {
            $customer = $order->customer_id
                ? Customer::find($order->customer_id)
                : Customer::where('phone', $order->customer_phone)->first();

            if (!$customer || empty($customer->email) || empty($customer->email_verified_at)) {
                return;
            }

            $restaurant = Restaurant::withoutGlobalScope('tenant')->find($order->restaurant_id);
            if (!$restaurant) {
                return;
            }

            $order->loadMissing('items.menuItem');

            if ($newStatus === 'delivered') {
                Mail::to($customer->email)->queue(
                    new CustomerOrderReceiptMail($order, $customer, $restaurant)
                );
            } elseif ($newStatus === 'cancelled') {
                Mail::to($customer->email)->queue(
                    new CustomerOrderCancelledMail($order, $customer, $restaurant)
                );
            }
        } catch (\Throwable $e) {
            Log::warning('Failed to send customer order status email', [
                'order_id' => $order->id,
                'status' => $newStatus,
                'error' => $e->getMessage(),
            ]);
        }
    }
}

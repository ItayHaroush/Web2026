<?php

namespace App\Console\Commands;

use App\Models\Order;
use App\Services\CustomerOrderPushService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

/**
 * פוש ללקוח: הזמנה ב־pending יותר מ־X דקות מרגע היצירה — קישור להמשך (תשלום / מעקב).
 */
class NotifyPendingOrderCustomerPush extends Command
{
    protected $signature = 'orders:notify-pending-customer';

    protected $description = 'Send customer push reminder for orders stuck in pending status';

    public function handle(): int
    {
        $minutes = max(1, (int) config('push.pending_order_reminder_after_minutes', 10));
        $cutoff = now()->subMinutes($minutes);

        $query = Order::withoutGlobalScopes()
            ->where('status', Order::STATUS_PENDING)
            ->where('created_at', '<=', $cutoff)
            ->whereNull('pending_customer_reminder_sent_at')
            ->where('is_test', false)
            // הזמנה עתידית שכבר שולמה — ממתינה לחלון זמן בלבד; בלי תזכורת "המשך"
            ->where(function ($q) {
                $q->where('is_future_order', false)
                    ->orWhereNull('is_future_order')
                    ->orWhere('payment_status', '!=', Order::PAYMENT_PAID);
            });

        $sent = 0;
        $service = app(CustomerOrderPushService::class);

        $query->orderBy('id')->chunkById(100, function ($orders) use ($service, &$sent) {
            foreach ($orders as $order) {
                try {
                    if ($service->sendPendingOrderReminder($order)) {
                        $order->forceFill(['pending_customer_reminder_sent_at' => now()])->saveQuietly();
                        $sent++;
                    }
                } catch (\Throwable $e) {
                    Log::warning('NotifyPendingOrderCustomerPush failed for order', [
                        'order_id' => $order->id,
                        'error' => $e->getMessage(),
                    ]);
                }
            }
        });

        $this->info("Pending customer reminders sent: {$sent}");
        Log::info('NotifyPendingOrderCustomerPush', ['sent' => $sent, 'threshold_minutes' => $minutes]);

        return self::SUCCESS;
    }
}

<?php

namespace App\Console\Commands;

use App\Models\FcmToken;
use App\Models\MonitoringAlert;
use App\Models\Order;
use App\Services\FcmService;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

/**
 * מעבד הזמנות עתידיות — מעביר אותן לסטטוס "received" כ-60 דקות לפני scheduled_for
 */
class ProcessFutureOrders extends Command
{
    protected $signature = 'orders:process-future';
    protected $description = 'Process future orders — move to received status 60 minutes before scheduled_for';

    public function handle(): int
    {
        $threshold = Carbon::now('Asia/Jerusalem')->addMinutes(60);

        $orders = Order::withoutGlobalScopes()
            ->where('is_future_order', true)
            ->where('status', Order::STATUS_PENDING)
            ->where('payment_status', Order::PAYMENT_PAID)
            ->where('scheduled_for', '<=', $threshold)
            ->get();

        if ($orders->isEmpty()) {
            $this->line('No future orders to process.');
            return self::SUCCESS;
        }

        $this->info("Processing {$orders->count()} future order(s)...");

        foreach ($orders as $order) {
            try {
                $order->update(['status' => Order::STATUS_RECEIVED]);

                $scheduledTime = Carbon::parse($order->scheduled_for)->timezone('Asia/Jerusalem')->format('H:i');

                // Push notification — כניסה למטבח כרגיל
                $this->sendOrderNotification(
                    tenantId: $order->tenant_id,
                    title: "הזמנה חדשה #{$order->id}",
                    body: "{$order->customer_name} - ₪{$order->total_amount} (עתידית ל-{$scheduledTime})",
                    data: [
                        'orderId' => (string) $order->id,
                        'type' => 'new_order',
                        'url' => '/admin/orders',
                    ]
                );

                // MonitoringAlert
                MonitoringAlert::create([
                    'tenant_id' => $order->tenant_id,
                    'restaurant_id' => $order->restaurant_id,
                    'alert_type' => 'new_order',
                    'title' => "הזמנה עתידית נכנסה למטבח #{$order->id}",
                    'body' => "{$order->customer_name} - ₪{$order->total_amount} — מתוכננת ל-{$scheduledTime}",
                    'severity' => 'info',
                    'metadata' => ['order_id' => $order->id, 'scheduled_for' => $order->scheduled_for],
                    'is_read' => false,
                ]);

                $this->line("  ✅ Order #{$order->id} → received (scheduled for {$scheduledTime})");
            } catch (\Throwable $e) {
                Log::error("Failed to process future order #{$order->id}", ['error' => $e->getMessage()]);
                $this->error("  ❌ Order #{$order->id}: {$e->getMessage()}");
            }
        }

        return self::SUCCESS;
    }

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
            Log::warning('Failed to send FCM notification for future order', [
                'error' => $e->getMessage(),
            ]);
        }
    }
}

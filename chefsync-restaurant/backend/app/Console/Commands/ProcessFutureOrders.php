<?php

namespace App\Console\Commands;

use App\Models\FcmToken;
use App\Models\MonitoringAlert;
use App\Models\Order;
use App\Services\CustomerOrderPushService;
use App\Services\FcmService;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * מעבד הזמנות עתידיות — מפעיל אותן לפי זמן הכנה דינמי של המסעדה.
 * כולל: הדפסה למטבח, נעילת DB למניעת כפילויות, וטיפול בכשל הדפסה.
 */
class ProcessFutureOrders extends Command
{
    protected $signature = 'orders:process-future';
    protected $description = 'Activate future orders based on restaurant prep time before scheduled_for';

    public function handle(): int
    {
        $now = Carbon::now('Asia/Jerusalem');

        $orders = Order::withoutGlobalScopes()
            ->where('is_future_order', true)
            ->where('status', Order::STATUS_PENDING)
            ->where(function ($q) {
                $q->where('payment_status', Order::PAYMENT_PAID)
                  ->orWhere('payment_method', 'cash');
            })
            ->with('restaurant')
            ->get();

        if ($orders->isEmpty()) {
            $this->line('No future orders to process.');
            return self::SUCCESS;
        }

        $this->info("Checking {$orders->count()} future order(s)...");

        foreach ($orders as $order) {
            $restaurant = $order->restaurant;
            if (!$restaurant) {
                $this->warn("  Order #{$order->id}: no restaurant, skipping.");
                continue;
            }

            $prep = $order->delivery_method === 'delivery'
                ? (int) ($restaurant->delivery_time_minutes ?? 30)
                : (int) ($restaurant->pickup_time_minutes ?? 20);

            $activationTime = Carbon::parse($order->scheduled_for)
                ->timezone('Asia/Jerusalem')
                ->subMinutes($prep);

            if (!$now->gte($activationTime)) {
                continue;
            }

            try {
                DB::transaction(function () use ($order, $now) {
                    $fresh = Order::lockForUpdate()->find($order->id);

                    if (!$fresh || $fresh->status !== Order::STATUS_PENDING) {
                        return;
                    }

                    $fresh->update([
                        'status' => Order::STATUS_RECEIVED,
                        'activated_at' => $now,
                    ]);

                    try {
                        app(\App\Services\PrintService::class)->printOrder($fresh);
                    } catch (\Throwable $e) {
                        $fresh->update(['print_failed_at' => $now]);
                        Log::warning("Print failed for future order #{$fresh->id}", [
                            'error' => $e->getMessage(),
                        ]);
                    }

                    $scheduledTime = Carbon::parse($fresh->scheduled_for)
                        ->timezone('Asia/Jerusalem')->format('H:i');

                    $this->sendOrderNotification(
                        tenantId: $fresh->tenant_id,
                        title: "הזמנה חדשה #{$fresh->id}",
                        body: "{$fresh->customer_name} - ₪{$fresh->total_amount} (עתידית ל-{$scheduledTime})",
                        data: [
                            'orderId' => (string) $fresh->id,
                            'type' => 'new_order',
                            'url' => '/admin/orders',
                        ]
                    );

                    try {
                        app(CustomerOrderPushService::class)
                            ->sendOrderStatusPush($fresh, Order::STATUS_RECEIVED);
                    } catch (\Throwable $e) {
                        Log::warning('Customer push failed (future order)', [
                            'error' => $e->getMessage(),
                            'order_id' => $fresh->id,
                        ]);
                    }

                    MonitoringAlert::create([
                        'tenant_id' => $fresh->tenant_id,
                        'restaurant_id' => $fresh->restaurant_id,
                        'alert_type' => 'new_order',
                        'title' => "הזמנה חדשה #{$fresh->id}",
                        'body' => "{$fresh->customer_name} - ₪{$fresh->total_amount} (עתידית ל-{$scheduledTime})",
                        'severity' => 'info',
                        'metadata' => [
                            'order_id' => $fresh->id,
                            'scheduled_for' => $fresh->scheduled_for,
                        ],
                        'is_read' => false,
                    ]);
                });

                $this->line("  Order #{$order->id} -> received");
            } catch (\Throwable $e) {
                Log::error("Failed to process future order #{$order->id}", [
                    'error' => $e->getMessage(),
                ]);
                $this->error("  Order #{$order->id}: {$e->getMessage()}");
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

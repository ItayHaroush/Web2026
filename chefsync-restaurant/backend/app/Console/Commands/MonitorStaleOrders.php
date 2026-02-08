<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Order;
use App\Models\Restaurant;
use App\Models\MonitoringAlert;
use App\Models\FcmToken;
use App\Services\FcmService;
use Carbon\Carbon;
use Illuminate\Support\Facades\Log;

class MonitorStaleOrders extends Command
{
    protected $signature = 'monitor:stale-orders';
    protected $description = 'Check for stale orders stuck in a status beyond expected thresholds';

    /**
     * Thresholds in minutes for each order status
     */
    private const STATUS_THRESHOLDS = [
        'pending'    => 10,
        'received'   => 15,
        'preparing'  => 45,
        'ready'      => 30,
        'delivering' => 60,
    ];

    public function handle(): int
    {
        $now = Carbon::now();
        $alertsCreated = 0;

        // Get all active restaurants (approved + had orders recently)
        $restaurants = Restaurant::where('is_approved', true)->get();

        foreach ($restaurants as $restaurant) {
            // Temporarily set tenant context for scoped queries
            app()->instance('tenant_id', $restaurant->tenant_id);

            foreach (self::STATUS_THRESHOLDS as $status => $thresholdMinutes) {
                $cutoff = $now->copy()->subMinutes($thresholdMinutes);

                $staleOrders = Order::where('restaurant_id', $restaurant->id)
                    ->where('status', $status)
                    ->where('updated_at', '<', $cutoff)
                    ->get();

                foreach ($staleOrders as $order) {
                    $minutesStale = $now->diffInMinutes($order->updated_at);

                    // Check if we already alerted about this order recently (last 30 min)
                    $existingAlert = MonitoringAlert::withoutGlobalScopes()
                        ->where('restaurant_id', $restaurant->id)
                        ->where('alert_type', 'stale_order')
                        ->where('metadata->order_id', $order->id)
                        ->where('created_at', '>=', $now->copy()->subMinutes(30))
                        ->exists();

                    if ($existingAlert) {
                        continue;
                    }

                    $severity = $minutesStale > ($thresholdMinutes * 2) ? 'critical' : 'warning';

                    $statusLabels = [
                        'pending'    => 'ממתינה',
                        'received'   => 'התקבלה',
                        'preparing'  => 'בהכנה',
                        'ready'      => 'מוכנה',
                        'delivering' => 'במשלוח',
                    ];

                    $alert = MonitoringAlert::create([
                        'tenant_id'     => $restaurant->tenant_id,
                        'restaurant_id' => $restaurant->id,
                        'alert_type'    => 'stale_order',
                        'title'         => "הזמנה #{$order->id} תקועה בסטטוס \"{$statusLabels[$status]}\"",
                        'body'          => "ההזמנה של {$order->customer_name} (₪{$order->total_amount}) בסטטוס \"{$statusLabels[$status]}\" כבר {$minutesStale} דקות. הסף המקובל הוא {$thresholdMinutes} דקות.",
                        'severity'      => $severity,
                        'metadata'      => [
                            'order_id'     => $order->id,
                            'status'       => $status,
                            'minutes'      => $minutesStale,
                            'threshold'    => $thresholdMinutes,
                            'customer'     => $order->customer_name,
                            'total'        => $order->total_amount,
                        ],
                    ]);

                    $alertsCreated++;

                    // Send FCM push to restaurant staff
                    $this->sendPushToRestaurant($restaurant, $alert);
                }
            }

            // Clear tenant context
            app()->forgetInstance('tenant_id');
        }

        $this->info("Stale order check complete. {$alertsCreated} alerts created.");
        Log::info("MonitorStaleOrders: {$alertsCreated} alerts created");

        return self::SUCCESS;
    }

    private function sendPushToRestaurant(Restaurant $restaurant, MonitoringAlert $alert): void
    {
        try {
            $tokens = FcmToken::withoutGlobalScopes()
                ->where('tenant_id', $restaurant->tenant_id)
                ->pluck('token');

            if ($tokens->isEmpty()) {
                return;
            }

            $fcmService = new FcmService();
            foreach ($tokens as $token) {
                $fcmService->sendToToken(
                    $token,
                    $alert->title,
                    $alert->body,
                    [
                        'type'    => 'monitoring_alert',
                        'alert_id' => (string) $alert->id,
                        'severity' => $alert->severity,
                    ]
                );
            }
        } catch (\Exception $e) {
            Log::warning('Failed to send stale order push', [
                'restaurant_id' => $restaurant->id,
                'error'         => $e->getMessage(),
            ]);
        }
    }
}

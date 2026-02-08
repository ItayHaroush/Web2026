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

class MonitorDailySummary extends Command
{
    protected $signature = 'monitor:daily-summary';
    protected $description = 'Generate daily business summary for each active restaurant';

    public function handle(): int
    {
        $now = Carbon::now()->setTimezone('Asia/Jerusalem');
        $today = $now->copy()->startOfDay();
        $summariesCreated = 0;

        // Get all approved restaurants
        $restaurants = Restaurant::where('is_approved', true)->get();

        foreach ($restaurants as $restaurant) {
            app()->instance('tenant_id', $restaurant->tenant_id);

            // Daily stats
            $ordersToday = Order::where('restaurant_id', $restaurant->id)
                ->where('created_at', '>=', $today)
                ->count();

            // Skip restaurants with no activity today
            if ($ordersToday === 0) {
                app()->forgetInstance('tenant_id');
                continue;
            }

            $revenueToday = Order::where('restaurant_id', $restaurant->id)
                ->where('created_at', '>=', $today)
                ->where('status', '!=', 'cancelled')
                ->where('is_test', false)
                ->sum('total_amount');

            $cancelledToday = Order::where('restaurant_id', $restaurant->id)
                ->where('created_at', '>=', $today)
                ->where('status', 'cancelled')
                ->count();

            $deliveredToday = Order::where('restaurant_id', $restaurant->id)
                ->where('created_at', '>=', $today)
                ->where('status', 'delivered')
                ->count();

            // Compare with yesterday
            $yesterday = $today->copy()->subDay();
            $ordersYesterday = Order::where('restaurant_id', $restaurant->id)
                ->whereBetween('created_at', [$yesterday, $today])
                ->count();

            $trend = $ordersYesterday > 0
                ? round((($ordersToday - $ordersYesterday) / $ordersYesterday) * 100)
                : ($ordersToday > 0 ? 100 : 0);

            $trendText = $trend > 0 ? "+{$trend}%" : "{$trend}%";
            $trendEmoji = $trend > 0 ? '' : ($trend < 0 ? '' : '');

            $dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
            $dayName = $dayNames[$now->dayOfWeek];

            $body = "סיכום יום {$dayName} ({$now->format('d/m')}):\n";
            $body .= "הזמנות: {$ordersToday} ({$trendText} מאתמול {$trendEmoji})\n";
            $body .= "הכנסות: {$revenueToday} ש\"ח\n";
            $body .= "בוטלו: {$cancelledToday} | נמסרו: {$deliveredToday}";

            $severity = $cancelledToday > ($ordersToday * 0.3) ? 'warning' : 'info';

            $alert = MonitoringAlert::create([
                'tenant_id'     => $restaurant->tenant_id,
                'restaurant_id' => $restaurant->id,
                'alert_type'    => 'daily_summary',
                'title'         => "סיכום יומי - {$ordersToday} הזמנות, ₪" . number_format($revenueToday, 0),
                'body'          => $body,
                'severity'      => $severity,
                'metadata'      => [
                    'date'             => $now->format('Y-m-d'),
                    'orders_today'     => $ordersToday,
                    'orders_yesterday' => $ordersYesterday,
                    'revenue'          => $revenueToday,
                    'cancelled'        => $cancelledToday,
                    'delivered'        => $deliveredToday,
                    'trend_percent'    => $trend,
                ],
            ]);

            $summariesCreated++;

            // Send FCM push to restaurant owner
            $this->sendPushToOwner($restaurant, $alert);

            app()->forgetInstance('tenant_id');
        }

        $this->info("Daily summary complete. {$summariesCreated} summaries created.");
        Log::info("MonitorDailySummary: {$summariesCreated} summaries created");

        return self::SUCCESS;
    }

    private function sendPushToOwner(Restaurant $restaurant, MonitoringAlert $alert): void
    {
        try {
            // Send to all tokens for this restaurant (owners will have tokens registered)
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
                        'type'     => 'daily_summary',
                        'alert_id' => (string) $alert->id,
                    ]
                );
            }
        } catch (\Exception $e) {
            Log::warning('Failed to send daily summary push', [
                'restaurant_id' => $restaurant->id,
                'error'         => $e->getMessage(),
            ]);
        }
    }
}

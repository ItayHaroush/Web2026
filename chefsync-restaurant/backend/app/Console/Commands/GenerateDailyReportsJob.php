<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Restaurant;
use App\Models\DailyReport;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class GenerateDailyReportsJob extends Command
{
    protected $signature = 'reports:generate-daily {--restaurant= : Restaurant ID ספציפי} {--date= : תאריך ספציפי (YYYY-MM-DD)}';
    protected $description = 'יצירת דוחות יומיים לכל המסעדות הפעילות';

    public function handle(): int
    {
        $date = $this->option('date')
            ? Carbon::parse($this->option('date'))->setTimezone('Asia/Jerusalem')
            : Carbon::now('Asia/Jerusalem')->subDay();

        $dateStr = $date->toDateString();
        $startOfDay = $date->copy()->startOfDay();
        $endOfDay = $date->copy()->endOfDay();

        $restaurantId = $this->option('restaurant');

        $query = Restaurant::where('is_approved', true);
        if ($restaurantId) {
            $query->where('id', $restaurantId);
        }
        $restaurants = $query->get();

        $generated = 0;

        foreach ($restaurants as $restaurant) {
            try {
                $report = $this->generateForRestaurant($restaurant, $dateStr, $startOfDay, $endOfDay);
                if ($report) {
                    $generated++;
                }
            } catch (\Throwable $e) {
                Log::error("GenerateDailyReport failed for restaurant {$restaurant->id}", [
                    'error' => $e->getMessage(),
                ]);
                $this->error("שגיאה במסעדה {$restaurant->name}: {$e->getMessage()}");
            }
        }

        $this->info("נוצרו {$generated} דוחות יומיים עבור {$dateStr}");
        Log::info("GenerateDailyReportsJob: {$generated} reports generated for {$dateStr}");

        return self::SUCCESS;
    }

    public static function generateForRestaurant(Restaurant $restaurant, string $dateStr, Carbon $startOfDay, Carbon $endOfDay): ?DailyReport
    {
        // כמו דשבורד מסעדן: לא test, נראות למסעדה, מתאריך תחילת פעילות (אם הוגדר)
        $orders = Order::withoutGlobalScopes()
            ->where('restaurant_id', $restaurant->id)
            ->where('is_test', false)
            ->visibleToRestaurant()
            ->forOwnerReporting($restaurant)
            ->whereBetween('created_at', [$startOfDay, $endOfDay])
            ->get();

        if ($orders->isEmpty()) {
            return null;
        }

        $activeOrders = $orders->where('status', '!=', 'cancelled');
        $cancelledOrders = $orders->where('status', 'cancelled');

        $totalOrders = $activeOrders->count();
        $totalRevenue = (float) $activeOrders->sum('total_amount');
        $pickupOrders = $activeOrders->where('delivery_method', 'pickup')->count();
        $deliveryOrders = $activeOrders->where('delivery_method', 'delivery')->count();
        $cashTotal = (float) $activeOrders->where('payment_method', 'cash')->sum('total_amount');
        $creditTotal = (float) $activeOrders->where('payment_method', 'credit_card')->sum('total_amount');

        // פילוח לפי מקור הזמנה
        $webOrders = $activeOrders->filter(fn($o) => in_array($o->source, ['web', null, '']))->count();
        $webRevenue = (float) $activeOrders->filter(fn($o) => in_array($o->source, ['web', null, '']))->sum('total_amount');
        $kioskOrders = $activeOrders->where('source', 'kiosk')->count();
        $kioskRevenue = (float) $activeOrders->where('source', 'kiosk')->sum('total_amount');
        $posOrders = $activeOrders->where('source', 'pos')->count();
        $posRevenue = (float) $activeOrders->where('source', 'pos')->sum('total_amount');

        // פילוח קיוסק: לשבת / לקחת
        $dineInOrders = $activeOrders->where('order_type', 'dine_in')->count();
        $takeawayOrders = $activeOrders->where('order_type', 'takeaway')->count();

        $cancelledCount = $cancelledOrders->count();
        $cancelledTotal = (float) $cancelledOrders->sum('total_amount');
        $avgOrderValue = $totalOrders > 0 ? round($totalRevenue / $totalOrders, 2) : 0;

        // פירוט עסקאות
        $transactions = $activeOrders->map(function ($order) {
            return [
                'order_id' => $order->id,
                'time' => Carbon::parse($order->created_at)->setTimezone('Asia/Jerusalem')->format('H:i'),
                'type' => $order->delivery_method ?? 'pickup',
                'source' => $order->source ?? 'web',
                'order_type' => $order->order_type,
                'payment_method' => $order->payment_method ?? 'cash',
                'amount' => (float) $order->total_amount,
                'status' => $order->status,
                'items_count' => $order->items()->count(),
            ];
        })->values()->toArray();

        // פילוח לפי שעה
        $hourlyBreakdown = [];
        foreach ($activeOrders as $order) {
            $hour = Carbon::parse($order->created_at)->setTimezone('Asia/Jerusalem')->format('H');
            if (!isset($hourlyBreakdown[$hour])) {
                $hourlyBreakdown[$hour] = ['orders' => 0, 'revenue' => 0];
            }
            $hourlyBreakdown[$hour]['orders']++;
            $hourlyBreakdown[$hour]['revenue'] += (float) $order->total_amount;
        }
        ksort($hourlyBreakdown);

        // פריטים פופולריים (לפי שם פריט מתפריט)
        $orderIds = $activeOrders->pluck('id');
        $topItems = OrderItem::whereIn('order_items.order_id', $orderIds)
            ->join('menu_items', 'order_items.menu_item_id', '=', 'menu_items.id')
            ->select('menu_items.name as item_name', DB::raw('SUM(order_items.quantity) as total_qty'), DB::raw('SUM(order_items.price_at_order * order_items.quantity) as total_revenue'))
            ->groupBy('menu_items.name')
            ->orderByDesc('total_qty')
            ->limit(15)
            ->get()
            ->map(fn($item) => [
                'name' => $item->item_name ?? 'לא ידוע',
                'quantity' => (int) $item->total_qty,
                'revenue' => (float) $item->total_revenue,
            ])
            ->toArray();

        $reportJson = [
            'transactions' => $transactions,
            'hourly_breakdown' => $hourlyBreakdown,
            'top_items' => $topItems,
        ];

        return DailyReport::updateOrCreate(
            [
                'restaurant_id' => $restaurant->id,
                'date' => $dateStr,
            ],
            [
                'tenant_id' => $restaurant->tenant_id,
                'total_orders' => $totalOrders,
                'total_revenue' => $totalRevenue,
                'pickup_orders' => $pickupOrders,
                'delivery_orders' => $deliveryOrders,
                'web_orders' => $webOrders,
                'web_revenue' => $webRevenue,
                'kiosk_orders' => $kioskOrders,
                'kiosk_revenue' => $kioskRevenue,
                'pos_orders' => $posOrders,
                'pos_revenue' => $posRevenue,
                'dine_in_orders' => $dineInOrders,
                'takeaway_orders' => $takeawayOrders,
                'cash_total' => $cashTotal,
                'credit_total' => $creditTotal,
                'cancelled_orders' => $cancelledCount,
                'cancelled_total' => $cancelledTotal,
                'avg_order_value' => $avgOrderValue,
                'report_json' => $reportJson,
            ]
        );
    }
}

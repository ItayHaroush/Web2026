<?php

namespace App\Services;

use App\Models\Restaurant;
use App\Models\Order;
use App\Models\MenuItem;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use Carbon\Carbon;

/**
 * שירות תובנות יומיות חכמות למסעדה
 * מייצר תובנות דינמיות, לא חוזרות, עם פעולות לביצוע
 */
class InsightsService
{
    private Restaurant $restaurant;
    private string $tenantId;
    private Carbon $now;

    public function __construct(Restaurant $restaurant)
    {
        $this->restaurant = $restaurant;
        $this->tenantId = $restaurant->tenant_id;
        $this->now = Carbon::now('Asia/Jerusalem');
    }

    /**
     * הפקת תובנות יומיות מבוססות נתונים
     */
    public function generateDailyInsights(): array
    {
        $data = $this->collectData();

        if ($data['orders_month'] < 3) {
            return [
                'insights' => [
                    [
                        'type' => 'info',
                        'text' => 'המסעדה עדיין חדשה במערכת. ככל שיצטברו הזמנות, נוכל לייצר תובנות מדויקות.',
                        'action' => 'שתף את הקישור לתפריט ברשתות החברתיות ובקבוצות וואטסאפ כדי להתחיל לקבל הזמנות.',
                        'priority' => 'high',
                    ]
                ],
                'generated_at' => $this->now->toIso8601String(),
                'data_quality' => 'insufficient',
            ];
        }

        $generators = $this->getShuffledGenerators();
        $insights = [];

        foreach ($generators as $generator) {
            $insight = $this->$generator($data);
            if ($insight) {
                $insights[] = $insight;
            }
            if (count($insights) >= 3) break;
        }

        // אם לא מספיק — fallback
        if (count($insights) < 1) {
            $insights[] = [
                'type' => 'info',
                'text' => "היום התקבלו {$data['orders_today']} הזמנות. ממשיכים לעקוב.",
                'action' => 'בדוק שכל הפריטים בתפריט זמינים ומעודכנים.',
                'priority' => 'low',
            ];
        }

        return [
            'insights' => $insights,
            'generated_at' => $this->now->toIso8601String(),
            'data_quality' => 'good',
            'day_of_week' => $this->now->dayName,
        ];
    }

    /**
     * אסוף את כל הנתונים הנדרשים
     */
    private function collectData(): array
    {
        $restaurantId = $this->restaurant->id;

        // הזמנות לפי טווח
        $ordersToday = Order::where('restaurant_id', $restaurantId)
            ->whereDate('created_at', $this->now->toDateString())
            ->where('status', '!=', 'cancelled')
            ->where('is_test', false);

        $ordersYesterday = Order::where('restaurant_id', $restaurantId)
            ->whereDate('created_at', $this->now->copy()->subDay()->toDateString())
            ->where('status', '!=', 'cancelled')
            ->where('is_test', false);

        $ordersWeek = Order::where('restaurant_id', $restaurantId)
            ->where('created_at', '>=', $this->now->copy()->subDays(7))
            ->where('status', '!=', 'cancelled')
            ->where('is_test', false);

        $ordersMonth = Order::where('restaurant_id', $restaurantId)
            ->where('created_at', '>=', $this->now->copy()->subDays(30))
            ->where('status', '!=', 'cancelled')
            ->where('is_test', false);

        $revenueToday = (clone $ordersToday)->sum('total_amount');
        $revenueYesterday = (clone $ordersYesterday)->sum('total_amount');
        $revenueWeek = (clone $ordersWeek)->sum('total_amount');

        $countToday = (clone $ordersToday)->count();
        $countYesterday = (clone $ordersYesterday)->count();
        $countWeek = (clone $ordersWeek)->count();
        $countMonth = (clone $ordersMonth)->count();

        // מנות פופולריות (30 יום)
        $topDishes = DB::table('order_items')
            ->join('orders', 'order_items.order_id', '=', 'orders.id')
            ->where('orders.restaurant_id', $restaurantId)
            ->where('orders.created_at', '>=', $this->now->copy()->subDays(30))
            ->where('orders.status', '!=', 'cancelled')
            ->where('orders.is_test', false)
            ->select('order_items.name', DB::raw('SUM(order_items.qty) as total_qty'), DB::raw('SUM(order_items.total_price) as total_revenue'))
            ->groupBy('order_items.name')
            ->orderByDesc('total_qty')
            ->limit(10)
            ->get();

        // מנות חלשות (30 יום)
        $allMenuItems = MenuItem::where('restaurant_id', $restaurantId)
            ->where('is_active', true)
            ->where('is_available', true)
            ->pluck('name')
            ->toArray();

        $orderedNames = $topDishes->pluck('name')->toArray();
        $lowPerformers = array_diff($allMenuItems, $orderedNames);

        // שעות שיא
        $hourlyDistribution = DB::table('orders')
            ->where('restaurant_id', $restaurantId)
            ->where('created_at', '>=', $this->now->copy()->subDays(14))
            ->where('status', '!=', 'cancelled')
            ->where('is_test', false)
            ->select(DB::raw('HOUR(created_at) as hour'), DB::raw('COUNT(*) as count'))
            ->groupBy(DB::raw('HOUR(created_at)'))
            ->orderBy('hour')
            ->pluck('count', 'hour')
            ->toArray();

        // משלוח vs איסוף
        $deliveryCount = (clone $ordersWeek)->where('delivery_method', 'delivery')->count();
        $pickupCount = (clone $ordersWeek)->where('delivery_method', 'pickup')->count();

        // לקוחות חוזרים vs חדשים (30 יום)
        $customerPhones = DB::table('orders')
            ->where('restaurant_id', $restaurantId)
            ->where('created_at', '>=', $this->now->copy()->subDays(30))
            ->where('status', '!=', 'cancelled')
            ->where('is_test', false)
            ->select('customer_phone', DB::raw('COUNT(*) as order_count'))
            ->groupBy('customer_phone')
            ->get();

        $returningCustomers = $customerPhones->where('order_count', '>', 1)->count();
        $newCustomers = $customerPhones->where('order_count', '=', 1)->count();

        // ממוצע הזמנה
        $avgOrderToday = $countToday > 0 ? round($revenueToday / $countToday, 1) : 0;
        $avgOrderWeek = $countWeek > 0 ? round($revenueWeek / $countWeek, 1) : 0;

        // cancelled
        $cancelledToday = Order::where('restaurant_id', $restaurantId)
            ->whereDate('created_at', $this->now->toDateString())
            ->where('status', 'cancelled')
            ->where('is_test', false)
            ->count();

        // אמצעי תשלום
        $creditOrders = (clone $ordersWeek)->where('payment_method', 'credit_card')->count();
        $cashOrders = (clone $ordersWeek)->where('payment_method', 'cash')->count();

        return [
            'orders_today' => $countToday,
            'orders_yesterday' => $countYesterday,
            'orders_week' => $countWeek,
            'orders_month' => $countMonth,
            'revenue_today' => $revenueToday,
            'revenue_yesterday' => $revenueYesterday,
            'revenue_week' => $revenueWeek,
            'avg_order_today' => $avgOrderToday,
            'avg_order_week' => $avgOrderWeek,
            'top_dishes' => $topDishes,
            'low_performers' => array_values(array_slice($lowPerformers, 0, 5)),
            'hourly_distribution' => $hourlyDistribution,
            'delivery_count' => $deliveryCount,
            'pickup_count' => $pickupCount,
            'returning_customers' => $returningCustomers,
            'new_customers' => $newCustomers,
            'cancelled_today' => $cancelledToday,
            'credit_orders' => $creditOrders,
            'cash_orders' => $cashOrders,
        ];
    }

    /**
     * רשימת generators מעורבבת (כל יום סדר אחר)
     */
    private function getShuffledGenerators(): array
    {
        $generators = [
            'insightTopDish',
            'insightRevenueTrend',
            'insightDeadHours',
            'insightDeliveryVsPickup',
            'insightLowPerformers',
            'insightReturningCustomers',
            'insightAvgOrder',
            'insightCancelled',
            'insightPeakHour',
            'insightDayComparison',
        ];

        // ערבוב דטרמיניסטי לפי תאריך (אותו יום = אותו סדר)
        $seed = crc32($this->tenantId . $this->now->toDateString());
        mt_srand($seed);
        shuffle($generators);
        mt_srand(); // חזרה ל-random

        return $generators;
    }

    // ======================================
    // Generators — כל אחד מחזיר insight או null
    // ======================================

    private function insightTopDish(array $data): ?array
    {
        $top = $data['top_dishes']->first();
        if (!$top) return null;

        $templates = [
            fn($n, $q) => "{$n} מוביל/ה עם {$q} הזמנות ב-30 יום האחרונים — שווה להבליט למעלה בתפריט או להוסיף קומבו.",
            fn($n, $q) => "המנה הכי מבוקשת שלך: {$n} ({$q} יחידות). שקול לבנות סביבה ארוחה מלאה.",
            fn($n, $q) => "{$n} מזמינים {$q} פעמים. זה הסטאר — תתן לו את הספוט הראשי בתפריט.",
        ];

        $idx = crc32($this->tenantId . $this->now->dayOfYear . 'top') % count($templates);
        $text = $templates[$idx]($top->name, $top->total_qty);

        return [
            'type' => 'success',
            'text' => $text,
            'action' => "הזז את {$top->name} לראש הקטגוריה או צור מבצע קומבו.",
            'priority' => 'medium',
            'cta' => ['label' => 'ערוך תפריט', 'link' => '/admin/menu'],
        ];
    }

    private function insightRevenueTrend(array $data): ?array
    {
        if ($data['revenue_yesterday'] == 0) return null;

        $change = round((($data['revenue_today'] - $data['revenue_yesterday']) / $data['revenue_yesterday']) * 100);

        if (abs($change) < 5) return null;

        if ($change > 0) {
            return [
                'type' => 'success',
                'text' => "ההכנסות היום גבוהות ב-{$change}% מאתמול (₪{$data['revenue_today']} מול ₪{$data['revenue_yesterday']}). היום טוב — תמשיך ככה.",
                'action' => 'נצל את המומנטום ושלח הודעה ללקוחות חוזרים עם הצעה מיוחדת.',
                'priority' => 'low',
            ];
        }

        $absChange = abs($change);
        return [
            'type' => 'warning',
            'text' => "ירידה של {$absChange}% בהכנסות היום לעומת אתמול. לא נורא, אבל שווה לבדוק מה השתנה.",
            'action' => 'הפעל מבצע כמו "10% הנחה להזמנה מעל ₪80" כדי לעודד הזמנות.',
            'priority' => 'high',
            'cta' => ['label' => 'צור מבצע', 'link' => '/admin/promotions'],
        ];
    }

    private function insightDeadHours(array $data): ?array
    {
        $hours = $data['hourly_distribution'];
        if (count($hours) < 3) return null;

        $avg = array_sum($hours) / count($hours);
        $deadHours = [];

        for ($h = 10; $h <= 21; $h++) {
            if (($hours[$h] ?? 0) < $avg * 0.3) {
                $deadHours[] = $h;
            }
        }

        if (empty($deadHours)) return null;

        // מצא טווח רציף
        sort($deadHours);
        $start = $deadHours[0];
        $end = $deadHours[count($deadHours) - 1];

        $templates = [
            "בין {$start}:00 ל-{$end}:00 כמעט אין הזמנות. זה חלון מושלם למבצע שעות מתות.",
            "שעות שקטות: {$start}:00–{$end}:00. הכנס עסקה כמו 1+1 או הנחה קבועה לטווח הזה.",
            "הזמנות כמעט נעלמות בין {$start}:00 ל-{$end}:00 — שווה לשקול Happy Hour.",
        ];

        $idx = crc32($this->tenantId . $this->now->dayOfYear . 'dead') % count($templates);

        return [
            'type' => 'warning',
            'text' => $templates[$idx],
            'action' => "צור מבצע לשעות {$start}:00-{$end}:00, לדוגמה: '15% הנחה על הכל'.",
            'priority' => 'high',
            'cta' => ['label' => 'צור מבצע שעות מתות', 'link' => '/admin/promotions'],
        ];
    }

    private function insightDeliveryVsPickup(array $data): ?array
    {
        $total = $data['delivery_count'] + $data['pickup_count'];
        if ($total < 5) return null;

        $deliveryPct = round(($data['delivery_count'] / $total) * 100);
        $pickupPct = 100 - $deliveryPct;

        if ($deliveryPct > 70) {
            return [
                'type' => 'info',
                'text' => "{$deliveryPct}% מההזמנות הן משלוח. הלקוחות שלך מעדיפים שמגיעים אליהם.",
                'action' => 'שקול להרחיב אזורי משלוח או להוסיף אפשרות משלוח חינם מעל סכום מסוים.',
                'priority' => 'medium',
            ];
        }

        if ($pickupPct > 70) {
            return [
                'type' => 'info',
                'text' => "{$pickupPct}% מהלקוחות מגיעים לאסוף. אולי שווה לעודד משלוחים עם דמי משלוח מוזלים.",
                'action' => 'הוסף באנר "דמי משלוח ₪5 בלבד" לעמוד התפריט.',
                'priority' => 'medium',
            ];
        }

        return null;
    }

    private function insightLowPerformers(array $data): ?array
    {
        $lowPerformers = $data['low_performers'];
        if (empty($lowPerformers)) return null;

        $name = $lowPerformers[0];
        $count = count($lowPerformers);

        $templates = [
            fn() => "{$name} לא הוזמנה אף פעם ב-30 יום. שנה שם, תיאור או תמונה — או הוצא מהתפריט.",
            fn() => "יש {$count} מנות שאף אחד לא מזמין. זה עומס מיותר בתפריט — שקול להסיר או לרענן.",
            fn() => "המנה {$name} ישנה — 0 הזמנות. בדוק אם המחיר, השם או התמונה דורשים שדרוג.",
        ];

        $idx = crc32($this->tenantId . $this->now->dayOfYear . 'low') % count($templates);

        return [
            'type' => 'warning',
            'text' => ($templates[$idx])(),
            'action' => "כנס ל'ניהול תפריט' ועדכן את {$name}: שם חדש, תיאור מושך, ותמונה איכותית.",
            'priority' => 'medium',
            'cta' => ['label' => 'עדכן תפריט', 'link' => '/admin/menu'],
        ];
    }

    private function insightReturningCustomers(array $data): ?array
    {
        $total = $data['returning_customers'] + $data['new_customers'];
        if ($total < 5) return null;

        $returningPct = round(($data['returning_customers'] / $total) * 100);

        if ($returningPct > 40) {
            return [
                'type' => 'success',
                'text' => "{$returningPct}% מהלקוחות שלך חוזרים. סימן מצוין שהאוכל שלך עושה את שלו.",
                'action' => 'תגמל אותם: שקול תוכנית נאמנות או מבצע "הזמנה חמישית — מנה במתנה".',
                'priority' => 'low',
            ];
        }

        if ($returningPct < 20) {
            return [
                'type' => 'warning',
                'text' => "רק {$returningPct}% מהלקוחות חוזרים. רוב הלקוחות מזמינים פעם אחת ונעלמים.",
                'action' => 'שלח הודעת SMS/וואטסאפ ללקוחות עם קופון חזרה: "חזור וקבל 15% הנחה".',
                'priority' => 'high',
                'cta' => ['label' => 'צור מבצע חזרה', 'link' => '/admin/promotions'],
            ];
        }

        return null;
    }

    private function insightAvgOrder(array $data): ?array
    {
        if ($data['avg_order_today'] == 0 || $data['avg_order_week'] == 0) return null;

        $avg = $data['avg_order_week'];

        if ($avg < 50) {
            return [
                'type' => 'info',
                'text' => "ממוצע הזמנה: ₪{$avg}. נמוך יחסית — שווה לבנות קומבואים שמעלים את הסל.",
                'action' => "צור ארוחה משולבת (מנה + שתייה + תוספת) במחיר ₪" . round($avg * 1.5) . " כדי להעלות ממוצע.",
                'priority' => 'high',
                'cta' => ['label' => 'ערוך תפריט', 'link' => '/admin/menu'],
            ];
        }

        return null;
    }

    private function insightCancelled(array $data): ?array
    {
        if ($data['cancelled_today'] < 2) return null;

        return [
            'type' => 'alert',
            'text' => "{$data['cancelled_today']} הזמנות בוטלו היום. זה מדאיג — בדוק אם יש בעיה בזמני הכנה או בתקשורת עם הלקוח.",
            'action' => 'בדוק את ההזמנות המבוטלות ושנה את זמן ה-ETA אם הוא לא ריאלי.',
            'priority' => 'critical',
        ];
    }

    private function insightPeakHour(array $data): ?array
    {
        $hours = $data['hourly_distribution'];
        if (empty($hours)) return null;

        $peakHour = array_keys($hours, max($hours))[0] ?? null;
        if ($peakHour === null) return null;

        $peakCount = $hours[$peakHour];

        return [
            'type' => 'info',
            'text' => "השעה הכי עמוסה: {$peakHour}:00 ({$peakCount} הזמנות ב-14 יום). ודא שיש מספיק כוח אדם.",
            'action' => 'שקול להכין מנות פופולריות מראש כדי לקצר זמני הכנה בשיא.',
            'priority' => 'medium',
        ];
    }

    private function insightDayComparison(array $data): ?array
    {
        if ($data['orders_yesterday'] == 0) return null;

        $diff = $data['orders_today'] - $data['orders_yesterday'];

        if (abs($diff) < 2) return null;

        if ($diff > 0) {
            return [
                'type' => 'success',
                'text' => "היום כבר {$data['orders_today']} הזמנות, יותר מאתמול ({$data['orders_yesterday']}). יום חזק!",
                'action' => 'תעשה פוסט ברשת: "ביקוש גבוה היום! הזמינו לפני שנגמר".',
                'priority' => 'low',
            ];
        }

        return [
            'type' => 'warning',
            'text' => "אתמול היו {$data['orders_yesterday']} הזמנות, היום רק {$data['orders_today']}. יום חלש.",
            'action' => 'שלח הודעת וואטסאפ ללקוחות קבועים עם הצעה חד-פעמית.',
            'priority' => 'high',
            'cta' => ['label' => 'צור מבצע מיידי', 'link' => '/admin/promotions'],
        ];
    }
}

<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Services\AiService;
use App\Models\AiCredit;
use App\Models\AiUsageLog;
use App\Models\Restaurant;
use App\Models\RestaurantSubscription;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\MenuItem;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ChatController extends Controller
{
    /**
     * עוזר AI לסופר אדמין - צ'אט אינטראקטיבי
     * POST /api/super-admin/ai/chat
     */
    public function chat(Request $request)
    {
        $user = $request->user();

        // הרשאה: רק super admin
        if (!$user || !$user->is_super_admin) {
            return response()->json([
                'success' => false,
                'message' => 'גישה מוגבלת לסופר אדמין בלבד',
            ], 403);
        }

        $request->validate([
            'message' => 'required|string|max:1000',
            'preset' => 'nullable|string|in:daily_insights,dormant_restaurants,pilot_candidates,sms_draft',
            'context' => 'nullable|array',
        ]);

        $message = $request->input('message');
        $preset = $request->input('preset');
        $userContext = $request->input('context', []);

        // בניית context עסקי
        $systemContext = $this->buildSuperAdminContext();
        $fullContext = array_merge($systemContext, $userContext);

        // בדיקת קרדיטים (super admin תמיד מקבל bypass)
        $bypassReason = null;
        $creditsUsed = 0;

        // Super Admin תמיד מקבל bypass (אין לו restaurant_id)
        if ($user->is_super_admin) {
            $bypassReason = 'super_admin';
        } elseif ($user->ai_unlimited) {
            $bypassReason = 'ai_unlimited';
        } elseif (config('app.env') === 'local') {
            $bypassReason = 'dev_mode';
        } else {
            // בדיקת קרדיטים רגילה - לא אמור להגיע לכאן עבור Super Admin
            // אבל אם הגענו, זה שגיאה בלוגיקה
            return response()->json([
                'success' => false,
                'message' => 'שגיאה במערכת - Super Admin צריך bypass אוטומטי',
            ], 500);
        }

        $startTime = microtime(true);

        try {
            // יצירת AiService זמני (ללא tenant/restaurant כי זה super admin)
            // Super Admin לא צריך restaurant object - נעביר dummy restaurant עם ID
            $dummyRestaurant = new Restaurant();
            $dummyRestaurant->id = 0; // Dummy ID למניעת errors
            $dummyRestaurant->tenant_id = 'super-admin';
            $dummyRestaurant->name = 'Super Admin';
            
            $aiService = new AiService('super-admin', $dummyRestaurant, $user);

            // קריאה ל-AI Service
            $response = $aiService->chatWithSuperAdmin(
                $message,
                $fullContext,
                $preset
            );

            $responseTime = round((microtime(true) - $startTime) * 1000);

            // ספירת קרדיטים - לא רלוונטי לSuper Admin (תמיד יש bypass)
            // Super Admin לא צורך קרדיטים מה-AiCredit table

            // רישום ב-AiUsageLog
            AiUsageLog::create([
                'tenant_id' => 'super-admin', // סופר אדמין אין לו tenant ספציפי
                'user_id' => $user->id,
                'restaurant_id' => null, // super admin לא משויך למסעדה
                'feature' => 'super_admin_chat',
                'action' => $preset ?? 'chat',
                'prompt_type' => $preset ? 'insight' : 'chat',
                'credits_used' => $creditsUsed,
                'tokens_used' => $response['tokens'] ?? 0,
                'response_time_ms' => $responseTime,
                'bypass_reason' => $bypassReason,
                'cached' => false,
                'status' => 'success',
                'prompt' => config('app.debug') ? $message : null,
                'response' => config('app.debug') ? $response['content'] : null,
            ]);

            return response()->json([
                'success' => true,
                'answer' => $response['content'],
                'actions' => $response['actions'] ?? [],
                'meta' => [
                    'credits_used' => $creditsUsed,
                    'bypass_reason' => $bypassReason,
                    'response_time_ms' => $responseTime,
                    'tokens_used' => $response['tokens'] ?? 0,
                ],
            ]);
        } catch (\Exception $e) {
            $responseTime = round((microtime(true) - $startTime) * 1000);

            // רישום שגיאה
            AiUsageLog::create([
                'tenant_id' => 'super-admin',
                'user_id' => $user->id,
                'restaurant_id' => null,
                'feature' => 'super_admin_chat',
                'action' => $preset ?? 'chat',
                'prompt_type' => $preset ? 'insight' : 'chat',
                'credits_used' => 0,
                'tokens_used' => 0,
                'response_time_ms' => $responseTime,
                'bypass_reason' => $bypassReason,
                'cached' => false,
                'status' => 'error',
                'error_message' => $e->getMessage(),
                'prompt' => config('app.debug') ? $message : null,
            ]);

            return response()->json([
                'success' => false,
                'message' => 'שגיאה בעיבוד הבקשה',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error',
            ], 500);
        }
    }

    /**
     * בניית Context עסקי לסופר אדמין
     * תקציר מספרים קומפקטי (לא כל הרשומות)
     */
    protected function buildSuperAdminContext()
    {
        $now = Carbon::now();
        $today = $now->copy()->startOfDay();
        $weekAgo = $now->copy()->subWeek();
        $monthAgo = $now->copy()->subMonth();
        $thirtyDaysAgo = $now->copy()->subDays(30);
        $sevenDaysAgo = $now->copy()->subDays(7);

        // 1. סטטיסטיקות מסעדות
        $totalRestaurants = Restaurant::count();
        $activeRestaurants = Restaurant::whereHas('orders', function ($q) use ($thirtyDaysAgo) {
            $q->where('created_at', '>=', $thirtyDaysAgo);
        })->count();
        $approvedRestaurants = Restaurant::where('is_approved', true)->count();

        // 2. הזמנות
        $ordersToday = Order::where('created_at', '>=', $today)->count();
        $ordersThisWeek = Order::where('created_at', '>=', $weekAgo)->count();
        $ordersThisMonth = Order::where('created_at', '>=', $monthAgo)->count();

        // 3. הכנסות
        $revenueToday = Order::where('created_at', '>=', $today)
            ->whereNotIn('status', ['cancelled'])
            ->sum('total_amount');
        $revenueThisWeek = Order::where('created_at', '>=', $weekAgo)
            ->whereNotIn('status', ['cancelled'])
            ->sum('total_amount');
        $revenueThisMonth = Order::where('created_at', '>=', $monthAgo)
            ->whereNotIn('status', ['cancelled'])
            ->sum('total_amount');

        // 4. Top 5 מסעדות (לפי הזמנות)
        $topRestaurants = Restaurant::withCount(['orders' => function ($q) use ($monthAgo) {
            $q->where('created_at', '>=', $monthAgo);
        }])
            ->orderBy('orders_count', 'desc')
            ->limit(5)
            ->get(['id', 'name', 'tenant_id', 'city'])
            ->map(function ($r) {
                return [
                    'name' => $r->name,
                    'city' => $r->city,
                    'orders_count' => $r->orders_count,
                ];
            });

        // 5. מסעדות רדומות (ללא הזמנות 7 ימים)
        $dormantRestaurants = Restaurant::whereDoesntHave('orders', function ($q) use ($sevenDaysAgo) {
            $q->where('created_at', '>=', $sevenDaysAgo);
        })
            ->where('is_approved', true)
            ->limit(10)
            ->get(['id', 'name', 'tenant_id', 'city'])
            ->map(function ($r) {
                return [
                    'name' => $r->name,
                    'city' => $r->city,
                ];
            });

        // 6. מועמדים לפיילוט (מסעדות עם עלייה בהזמנות)
        $pilotCandidates = Restaurant::select('restaurants.id', 'restaurants.name', 'restaurants.city', 'restaurants.tenant_id')
            ->leftJoin('orders', 'restaurants.id', '=', 'orders.restaurant_id')
            ->where('orders.created_at', '>=', $weekAgo)
            ->groupBy('restaurants.id', 'restaurants.name', 'restaurants.city', 'restaurants.tenant_id')
            ->havingRaw('COUNT(orders.id) >= 10') // לפחות 10 הזמנות בשבוע
            ->orderByRaw('COUNT(orders.id) DESC')
            ->limit(5)
            ->get()
            ->map(function ($r) use ($weekAgo) {
                $ordersCount = Order::where('restaurant_id', $r->id)
                    ->where('created_at', '>=', $weekAgo)
                    ->count();
                return [
                    'name' => $r->name,
                    'city' => $r->city,
                    'weekly_orders' => $ordersCount,
                ];
            });

        // 7. פריטי תפריט פופולריים (Top 5)
        $topMenuItems = DB::table('order_items')
            ->join('menu_items', 'order_items.menu_item_id', '=', 'menu_items.id')
            ->join('orders', 'order_items.order_id', '=', 'orders.id')
            ->where('orders.created_at', '>=', $monthAgo)
            ->select('menu_items.name', DB::raw('COUNT(*) as count'), DB::raw('SUM(order_items.quantity) as total_quantity'))
            ->groupBy('menu_items.id', 'menu_items.name')
            ->orderBy('count', 'desc')
            ->limit(5)
            ->get()
            ->map(function ($item) {
                return [
                    'name' => $item->name,
                    'orders_count' => $item->count,
                    'total_quantity' => $item->total_quantity,
                ];
            });

        return [
            'summary' => [
                'total_restaurants' => $totalRestaurants,
                'active_restaurants_30d' => $activeRestaurants,
                'approved_restaurants' => $approvedRestaurants,
            ],
            'orders' => [
                'today' => $ordersToday,
                'this_week' => $ordersThisWeek,
                'this_month' => $ordersThisMonth,
            ],
            'revenue' => [
                'today' => round($revenueToday, 2),
                'this_week' => round($revenueThisWeek, 2),
                'this_month' => round($revenueThisMonth, 2),
            ],
            'top_restaurants' => $topRestaurants->toArray(),
            'dormant_restaurants' => $dormantRestaurants->toArray(),
            'pilot_candidates' => $pilotCandidates->toArray(),
            'top_menu_items' => $topMenuItems->toArray(),
            'generated_at' => $now->toIso8601String(),
        ];
    }

    /**
     * עוזר AI למנהל מסעדה - עם בדיקת קרדיטים ונתונים ספציפיים למסעדה
     */
    public function restaurantChat(Request $request)
    {
        $request->validate([
            'message' => 'required|string|max:1000',
            'preset' => 'nullable|string|in:order_summary,menu_suggestions,performance_insights,customer_engagement'
        ]);

        $user = $request->user();
        $tenantId = app('tenant_id');

        // קבלת מסעדה
        $restaurant = Restaurant::where('tenant_id', $tenantId)->firstOrFail();

        // בדיקת קרדיטים
        $aiCredit = AiCredit::getOrCreateForRestaurant($restaurant);
        $aiCredit->checkAndResetIfNeeded();

        // בדיקה אם יש מספיק קרדיטים
        if (!$aiCredit->hasCredits(1)) {
            return response()->json([
                'success' => false,
                'message' => 'הגעת למכסת השאילתות החודשית. שדרג למנוי Pro לקבלת 300 שאילתות חודשיות.',
                'credits_remaining' => $aiCredit->credits_remaining,
                'credits_limit' => $aiCredit->monthly_limit
            ], 429);
        }

        try {
            // בניית הקשר של המסעדה
            $context = $this->buildRestaurantContext($tenantId, $restaurant);

            // יצירת AiService עם הפרמטרים הנכונים
            $aiService = new AiService($tenantId, $restaurant, $user);

            // קריאה לסוכן AI עם preset אם קיים
            $preset = $request->input('preset');
            $response = $aiService->chatWithRestaurant(
                $request->input('message'),
                $context,
                $preset
            );

            // רישום השימוש
            AiUsageLog::create([
                'tenant_id' => $tenantId,
                'restaurant_id' => $restaurant->id,
                'user_id' => $user->id,
                'feature' => 'restaurant_chat',
                'action' => $preset ?? 'chat',
                'prompt' => $request->input('message'),
                'response' => $response,
                'credits_used' => 1,
                'tokens_used' => 1, // ספירה פשוטה - 1 שאילתה
                'status' => 'success',
                'cached' => false,
                'prompt_type' => 'chat',
            ]);

            // עדכון מונה הקרדיטים
            $aiCredit->useCredits(1);
            $creditsRemaining = $aiCredit->credits_remaining;

            return response()->json([
                'success' => true,
                'response' => $response,
                'credits_remaining' => $creditsRemaining,
                'credits_limit' => $aiCredit->monthly_limit,
                'suggested_actions' => $aiService->getRestaurantSuggestedActions($context, $preset)
            ]);
        } catch (\Exception $e) {
            Log::error('Restaurant AI Chat Error', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'tenant_id' => $tenantId,
                'restaurant_id' => $restaurant->id ?? null
            ]);

            return response()->json([
                'success' => false,
                'message' => 'אירעה שגיאה בעיבוד הבקשה. אנא נסה שוב.',
                'error_details' => config('app.debug') ? $e->getMessage() : null
            ], 500);
        }
    }

    /**
     * בניית קונטקסט ספציפי למסעדה - רק נתוני המסעדה הנוכחית
     */
    private function buildRestaurantContext($tenantId, $restaurant)
    {
        $now = now();

        // הזמנות (רק של המסעדה הזו)
        $ordersToday = Order::whereDate('created_at', $now->toDateString())->count();
        $ordersWeek = Order::whereBetween('created_at', [$now->copy()->startOfWeek(), $now])->count();
        $ordersMonth = Order::whereMonth('created_at', $now->month)->whereYear('created_at', $now->year)->count();

        // הכנסות (רק של המסעדה הזו)
        $revenueToday = Order::whereDate('created_at', $now->toDateString())
            ->whereIn('status', ['delivered', 'ready'])
            ->sum('total_amount');
        $revenueWeek = Order::whereBetween('created_at', [$now->copy()->startOfWeek(), $now])
            ->whereIn('status', ['delivered', 'ready'])
            ->sum('total_amount');
        $revenueMonth = Order::whereMonth('created_at', $now->month)
            ->whereYear('created_at', $now->year)
            ->whereIn('status', ['delivered', 'ready'])
            ->sum('total_amount');

        // פריטי תפריט פופולריים (רק של המסעדה הזו)
        $topMenuItems = OrderItem::select('menu_item_id', DB::raw('COUNT(*) as order_count'))
            ->whereHas('order', function ($q) use ($now) {
                $q->whereBetween('created_at', [$now->copy()->subDays(30), $now]);
            })
            ->groupBy('menu_item_id')
            ->orderBy('order_count', 'desc')
            ->limit(5)
            ->with('menuItem')
            ->get();

        // סטטוס מנויים
        $subscription = RestaurantSubscription::where('restaurant_id', $restaurant->id)
            ->where('status', 'active')
            ->first();

        return [
            'restaurant' => [
                'name' => $restaurant->name,
                'tenant_id' => $tenantId,
                'subscription_tier' => config('app.dev_mode') ? 'pro' : ($subscription ? $subscription->plan_name : 'free'),
                'is_approved' => $restaurant->is_approved,
                'total_menu_items' => MenuItem::count()
            ],
            'orders' => [
                'today' => $ordersToday,
                'this_week' => $ordersWeek,
                'this_month' => $ordersMonth
            ],
            'revenue' => [
                'today' => $revenueToday,
                'this_week' => $revenueWeek,
                'this_month' => $revenueMonth
            ],
            'top_items' => $topMenuItems->map(function ($item) {
                return [
                    'name' => $item->menuItem->name ?? 'N/A',
                    'orders' => $item->order_count
                ];
            })->toArray(),
            'generated_at' => $now->toIso8601String()
        ];
    }
}

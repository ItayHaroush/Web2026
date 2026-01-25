<?php

namespace App\Http\Controllers;

use App\Services\AiService;
use App\Models\Restaurant;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;

class AiController extends Controller
{
    /**
     * Generate description for menu item
     * 
     * POST /admin/ai/generate-description
     * 
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function generateDescription(Request $request)
    {
        try {
            // Validate request
            $validated = $request->validate([
                'name' => 'required|string|max:255',
                'price' => 'required|numeric|min:0',
                'category' => 'nullable|string',
                'allergens' => 'nullable|array',
                'is_vegetarian' => 'nullable|boolean',
                'is_vegan' => 'nullable|boolean',
                'force_regenerate' => 'nullable|boolean',
            ]);

            $tenantId = app('tenant_id');
            $restaurant = Restaurant::where('tenant_id', $tenantId)->firstOrFail();
            $user = $request->user();

            // Initialize AI Service
            $ai = new AiService($tenantId, $restaurant, $user);

            // Generate description (bypass cache if regenerating)
            $forceRegenerate = $validated['force_regenerate'] ?? false;
            $result = $ai->generateDescription($validated, $forceRegenerate);

            return response()->json([
                'success' => true,
                'message' => 'תיאור נוצר בהצלחה',
                'data' => $result,
            ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'שגיאה בנתונים שהוזנו',
                'errors' => $e->errors(),
            ], 422);
        } catch (\Exception $e) {
            Log::error('AI Description Generation Failed', [
                'tenant_id' => app('tenant_id'),
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            // Check for specific error types
            if (str_contains($e->getMessage(), 'קרדיטים')) {
                return response()->json([
                    'success' => false,
                    'message' => $e->getMessage(),
                    'error_code' => 'insufficient_credits',
                ], 402); // Payment Required
            }

            if (str_contains($e->getMessage(), 'מגבלת')) {
                return response()->json([
                    'success' => false,
                    'message' => $e->getMessage(),
                    'error_code' => 'rate_limit_exceeded',
                ], 429); // Too Many Requests
            }

            return response()->json([
                'success' => false,
                'message' => 'שגיאה ביצירת תיאור. נסה שוב.',
                'error_code' => 'generation_failed',
            ], 500);
        }
    }

    /**
     * Get AI credits status
     * 
     * GET /admin/ai/credits
     * 
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function getCreditsStatus(Request $request)
    {
        try {
            $tenantId = app('tenant_id');
            $restaurant = Restaurant::where('tenant_id', $tenantId)->firstOrFail();

            $status = AiService::getCreditsStatus($restaurant);

            return response()->json([
                'success' => true,
                'credits_remaining' => $status['credits_remaining'],
                'credits_limit' => $status['monthly_limit'],
                'data' => $status, // פרטים נוספים
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'שגיאה בקבלת מידע על קרדיטים',
            ], 500);
        }
    }

    /**
     * Get AI usage statistics
     * 
     * GET /admin/ai/usage-stats
     * 
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function getUsageStats(Request $request)
    {
        try {
            $tenantId = app('tenant_id');
            $restaurant = Restaurant::where('tenant_id', $tenantId)->firstOrFail();

            // Optional date range
            $startDate = $request->input('start_date')
                ? \Carbon\Carbon::parse($request->input('start_date'))
                : now()->startOfMonth();
            $endDate = $request->input('end_date')
                ? \Carbon\Carbon::parse($request->input('end_date'))
                : now()->endOfMonth();

            $stats = AiService::getUsageStats($restaurant, $startDate, $endDate);

            return response()->json([
                'success' => true,
                'data' => $stats,
            ]);
        } catch (\Exception $e) {
            Log::error('AI Usage Stats Failed', [
                'tenant_id' => app('tenant_id'),
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'שגיאה בקבלת נתוני שימוש',
            ], 500);
        }
    }

    /**
     * Get AI-generated dashboard insights
     * 
     * GET /admin/ai/dashboard-insights
     * 
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function getDashboardInsights(Request $request)
    {
        try {
            $tenantId = app('tenant_id');
            $restaurant = Restaurant::where('tenant_id', $tenantId)->firstOrFail();
            $user = $request->user();

            // Check cache first (24 hours)
            $cacheKey = "ai:insights:tenant:{$tenantId}:" . now()->format('Y-m-d');
            $cached = Cache::get($cacheKey);

            if ($cached) {
                return response()->json([
                    'success' => true,
                    'data' => $cached, // ✅ Return cached data as-is
                    'cached' => true,
                ]);
            }

            // Initialize AI Service
            $ai = new AiService($tenantId, $restaurant, $user);

            // Build dashboard context
            $context = [
                'restaurant_name' => $restaurant->name,
                'total_menu_items' => $restaurant->menuItems()->count(),
                'active_categories' => $restaurant->categories()->count(),
                'orders_today' => $restaurant->orders()->whereDate('created_at', today())->count(),
                'orders_week' => $restaurant->orders()->where('created_at', '>=', now()->subDays(7))->count(),
                'orders_month' => $restaurant->orders()->where('created_at', '>=', now()->subDays(30))->count(),
                'revenue_today' => $restaurant->orders()->whereDate('created_at', today())->sum('total_amount'),
                'revenue_week' => $restaurant->orders()->where('created_at', '>=', now()->subDays(7))->sum('total_amount'),
                'pending_orders' => $restaurant->orders()->where('status', 'received')->count(),
            ];

            // Generate insights
            $insightsData = $ai->getDashboardInsights($context);

            // Cache for 24 hours
            Cache::put($cacheKey, $insightsData, 86400);

            return response()->json([
                'success' => true,
                'data' => $insightsData, // ✅ Return fresh data as-is
                'cached' => false,
            ]);
        } catch (\Exception $e) {
            Log::error('AI Dashboard Insights Failed', [
                'tenant_id' => app('tenant_id'),
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            // Return empty insights on error (graceful degradation)
            return response()->json([
                'success' => true,
                'data' => [
                    'insights' => [],
                    'error' => $e->getMessage(),
                ],
            ], 200);
        }
    }

    /**
     * Recommend optimal price for menu item
     * 
     * POST /admin/ai/recommend-price
     * 
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function recommendPrice(Request $request)
    {
        try {
            // Validate request
            $validated = $request->validate([
                'name' => 'required|string|max:255',
                'category_id' => 'required|integer|exists:categories,id',
                'category_name' => 'nullable|string',
                'description' => 'nullable|string',
                'price' => 'nullable|numeric|min:0',
            ]);

            $tenantId = app('tenant_id');
            $restaurant = Restaurant::where('tenant_id', $tenantId)->firstOrFail();
            $user = $request->user();

            // Initialize AI Service
            $ai = new AiService($tenantId, $restaurant, $user);

            // Generate price recommendation
            $recommendation = $ai->recommendPrice($validated);

            return response()->json([
                'success' => true,
                'data' => $recommendation,
            ]);
        } catch (\Exception $e) {
            Log::error('AI Price Recommendation Failed', [
                'tenant_id' => app('tenant_id'),
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 200);
        }
    }
}

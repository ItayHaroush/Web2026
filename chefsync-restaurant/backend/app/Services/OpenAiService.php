<?php

namespace App\Services;

use App\Models\AiUsageLog;
use App\Models\AiCredit;
use App\Models\Restaurant;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Http;
use Carbon\Carbon;

/**
 * OpenAI Service - Production AI Provider
 * 
 * Uses OpenAI HTTP API (no CLI required)
 * Suitable for server/production environments
 * Supports mock mode for testing without API costs
 */
class OpenAiService extends BaseAiService
{
    protected string $tenantId;
    protected Restaurant $restaurant;
    protected ?User $user;
    private string $apiKey;
    private string $model;
    private string $baseUrl;
    private bool $mockMode;

    /**
     * Initialize OpenAI Service
     */
    public function __construct(string $tenantId, Restaurant $restaurant, ?User $user = null)
    {
        $this->tenantId = $tenantId;
        $this->restaurant = $restaurant;
        $this->user = $user;

        // Check if mock mode is enabled
        $this->mockMode = config('ai.openai.mock', false);

        // Get OpenAI configuration (not required in mock mode)
        $this->apiKey = config('ai.openai.api_key', '');
        $this->model = config('ai.openai.model', 'gpt-4o-mini');
        $this->baseUrl = config('ai.openai.base_url', 'https://api.openai.com/v1');

        if (!$this->mockMode && empty($this->apiKey)) {
            throw new \Exception('OpenAI API key not configured. Set OPENAI_API_KEY or enable OPENAI_MOCK=true for testing.');
        }

        Log::info('OpenAI Service initialized', [
            'tenant_id' => $tenantId,
            'model' => $this->model,
            'mock_mode' => $this->mockMode
        ]);
    }

    /**
     * Generate menu item description
     */
    public function generateDescription(array $menuItemData, bool $forceRegenerate = false): array
    {
        $feature = 'description_generator';
        $startTime = microtime(true);

        try {
            // Check cache first (unless forcing regeneration)
            $cacheKey = null;
            if (!$forceRegenerate && config('ai.features.description_generator.cache_enabled', true)) {
                $cacheKey = $this->getCacheKey('description', $menuItemData);
                $cached = Cache::get($cacheKey);

                if ($cached) {
                    $responseTime = (int)((microtime(true) - $startTime) * 1000);
                    $this->logUsage(
                        $feature,
                        'generate',
                        0,
                        0,
                        true,
                        $cacheKey,
                        'success',
                        null,
                        $responseTime,
                        ['menu_item' => $menuItemData, 'source' => 'cache']
                    );
                    return $cached;
                }
            }

            // Validate access and deduct credits (from BaseAiService)
            $this->validateAccess($feature, $this->restaurant, $this->user);

            // Build prompt
            $prompt = $this->buildDescriptionPrompt($menuItemData);

            // Call OpenAI with clear system context
            $systemPrompt = "אתה מחולל תיאורים מקצועיים למנות במסעדות. המשימה שלך היא לכתוב תיאורים קצרים, עובדתיים וממוקדים בלבד - ללא המלצות עסקיות, ללא ניתוחים, ללא שיווק מוגזם. רק תיאור המנה עצמה.";
            $response = $this->callOpenAi($prompt, $systemPrompt);
            $responseTime = (int)((microtime(true) - $startTime) * 1000);

            $result = [
                'description' => $response['content'] ?? '',
                'generated_at' => now()->toIso8601String(),
                'provider' => 'openai',
                'model' => $this->mockMode ? 'mock' : $this->model
            ];

            // Cache result (shorter TTL than Copilot for production freshness)
            if ($cacheKey) {
                $cacheTtl = config('ai.features.description_generator.cache_ttl', 172800); // 2 days default
                Cache::put($cacheKey, $result, $cacheTtl);
            }

            // Log usage (from BaseAiService)
            $costCredits = config("ai.features.{$feature}.cost_credits", 1);
            $this->logUsage(
                $feature,
                'generate',
                $costCredits,
                $response['tokens'] ?? 0,
                false,
                $cacheKey,
                'success',
                null,
                $responseTime,
                ['menu_item' => $menuItemData, 'mock' => $this->mockMode]
            );

            return $result;
        } catch (\Exception $e) {
            $responseTime = (int)((microtime(true) - $startTime) * 1000);
            $this->logUsage(
                $feature,
                'generate',
                0,
                0,
                false,
                null,
                'error',
                $responseTime,
                null,
                ['error' => $e->getMessage()]
            );
            throw $e;
        }
    }

    /**
     * Chat with Super Admin
     */
    public function chatWithSuperAdmin(string $message, array $context = [], ?string $preset = null): array
    {
        Log::info('Super Admin Chat Request', [
            'message_length' => strlen($message),
            'preset' => $preset,
            'mock_mode' => $this->mockMode
        ]);

        try {
            $systemPrompt = "You are a helpful AI assistant for TakeEat super admin. Provide insights about the restaurant management platform.";

            $messages = [
                ['role' => 'system', 'content' => $systemPrompt],
                ['role' => 'user', 'content' => $message]
            ];

            $response = $this->callOpenAi($messages);

            Log::info('Super Admin Chat Success', [
                'response_length' => strlen($response['content'] ?? ''),
                'tokens' => $response['tokens'] ?? 0
            ]);

            return [
                'response' => $response['content'] ?? '',
                'provider' => 'openai',
                'model' => $this->mockMode ? 'mock' : $this->model,
                'tokens' => $response['tokens'] ?? 0
            ];
        } catch (\Exception $e) {
            Log::error('Super Admin Chat Error', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            throw $e;
        }
    }

    /**
     * Chat with Restaurant
     */
    public function chatWithRestaurant(string $message, array $context = [], ?string $preset = null): array
    {
        $feature = 'restaurant_chat';
        $startTime = microtime(true);

        try {
            // Validate access (from BaseAiService)
            $this->validateAccess($feature, $this->restaurant, $this->user);

            $systemPrompt = $this->buildRestaurantChatPrompt($context);

            $messages = [
                ['role' => 'system', 'content' => $systemPrompt],
                ['role' => 'user', 'content' => $message]
            ];

            $response = $this->callOpenAi($messages);
            $responseTime = (int)((microtime(true) - $startTime) * 1000);

            $result = [
                'response' => $response['content'] ?? '',
                'provider' => 'openai',
                'model' => $this->mockMode ? 'mock' : $this->model,
                'suggested_actions' => $this->getRestaurantSuggestedActions($context, $preset)
            ];

            // Log usage (from BaseAiService)
            $costCredits = config("ai.features.{$feature}.cost_credits", 1);
            $this->logUsage(
                $feature,
                'chat',
                $costCredits,
                $response['tokens'] ?? 0,
                false,
                null,
                'success',
                null,
                $responseTime,
                ['preset' => $preset, 'mock' => $this->mockMode]
            );

            return $result;
        } catch (\Exception $e) {
            $responseTime = (int)((microtime(true) - $startTime) * 1000);
            $this->logUsage(
                $feature,
                'chat',
                0,
                0,
                false,
                null,
                'error',
                $responseTime,
                null,
                ['error' => $e->getMessage()]
            );
            throw $e;
        }
    }

    /**
     * Get dashboard insights
     */
    public function getDashboardInsights(array $context): array
    {
        $feature = 'dashboard_insights';
        $startTime = microtime(true);

        try {
            $this->validateAccess($feature, $this->restaurant, $this->user);

            $restaurantName = $context['restaurant_name'] ?? 'המסעדה';
            $tenantId = $context['tenant_id'] ?? 'unknown';
            $ordersToday = $context['orders_today'] ?? 0;
            $ordersWeek = $context['orders_week'] ?? 0;
            $ordersMonth = $context['orders_month'] ?? 0;
            $revenueToday = $context['revenue_today'] ?? 0;
            $revenueWeek = $context['revenue_week'] ?? 0;
            $menuItems = $context['total_menu_items'] ?? 0;
            $categories = $context['active_categories'] ?? 0;
            $pendingOrders = $context['pending_orders'] ?? 0;
            $isOpen = $context['is_open'] ?? true;
            $statusText = $isOpen ? '🟢 פתוח כעת' : '🔴 סגור כעת';

            // CRITICAL: Add actual menu data
            $menuItemsList = $context['menu_items'] ?? [];
            $categoriesList = $context['categories'] ?? [];
            $topSellers = $context['top_sellers'] ?? [];

            $menuSummary = "תפריט המסעדה:\n";
            if (!empty($menuItemsList)) {
                foreach ($menuItemsList as $item) {
                    $menuSummary .= "- {$item['name']} ({$item['category']}) - ₪{$item['price']}\n";
                }
            } else {
                $menuSummary .= "אין מנות בתפריט\n";
            }

            $topSellersSummary = "\nהמנות הנמכרות ביותר (30 יום אחרונים):\n";
            if (!empty($topSellers)) {
                foreach ($topSellers as $seller) {
                    $sellerName = is_object($seller) ? $seller->name : ($seller['name'] ?? 'מנה');
                    $sellerSold = is_object($seller) ? $seller->total_sold : ($seller['total_sold'] ?? 0);
                    $topSellersSummary .= "- {$sellerName}: {$sellerSold} יחידות\n";
                }
            } else {
                $topSellersSummary .= "אין נתוני מכירות זמינים\n";
            }

            // Build hourly distribution summary
            $hourlyDistribution = $context['hourly_distribution'] ?? [];
            $hourlySummary = "\nפילוח הזמנות לפי שעות (30 יום אחרונים):\n";
            if (!empty($hourlyDistribution)) {
                foreach ($hourlyDistribution as $hour => $count) {
                    $hourlySummary .= "- שעה {$hour}:00 - {$count} הזמנות\n";
                }
            } else {
                $hourlySummary .= "אין נתוני שעות זמינים\n";
            }

            $systemPrompt = "אתה אנליסט עסקי למסעדה '{$restaurantName}' (tenant_id: {$tenantId}). אתה חייב לענות רק על סמך הנתונים האמיתיים של המסעדה הזו. אסור לך להמציא מנות או מידע שלא קיים. אם אין נתונים - אמור זאת במפורש. הנתח את הנתונים בעברית ובצורה ממוקדת.";

            $prompt = "נתח את נתוני הדשבורד של מסעדה '{$restaurantName}' (tenant: {$tenantId}):\n\n"
                . "📊 סטטיסטיקות הזמנות:\n"
                . "- סטטוס: {$statusText}\n"
                . "- היום: {$ordersToday} הזמנות\n"
                . "- שבוע אחרון: {$ordersWeek} הזמנות\n"
                . "- חודש אחרון: {$ordersMonth} הזמנות\n\n"
                . "💰 הכנסות:\n"
                . "- היום: ₪{$revenueToday}\n"
                . "- שבוע אחרון: ₪{$revenueWeek}\n\n"
                . "🍽️ {$menuSummary}\n"
                . "🏆 {$topSellersSummary}\n"
                . "🕐 {$hourlySummary}\n"
                . "⏳ הזמנות ממתינות: {$pendingOrders}\n\n"
                . "**חשוב: השתמש רק במידע האמיתי שסיפקתי. אל תמציא מנות או נתונים!**\n\n"
                . "החזר JSON בפורמט הזה בלבד (תוכן בעברית):\n"
                . '{"sales_trend": "ניתוח מגמת מכירות", "top_performers": "המנות המובילות בפועל", '
                . '"peak_times": "זמני שיא לפי הנתונים", "recommendations": ["המלצה 1", "המלצה 2"], "alert": "התראה חשובה אם יש, או אין התראות"}';

            $response = $this->callOpenAi($prompt, $systemPrompt);
            $responseTime = (int)((microtime(true) - $startTime) * 1000);

            // Parse JSON response
            $content = $response['content'] ?? '';

            $result = null;
            // Try to extract JSON from response
            if (preg_match('/\{[\s\S]*\}/', $content, $matches)) {
                try {
                    $parsed = json_decode($matches[0], true);
                    if (json_last_error() === JSON_ERROR_NONE) {
                        $sanitize = fn($val) => ($val === 'null' || $val === null) ? 'אין נתונים' : $val;
                        $result = [
                            'sales_trend' => $sanitize($parsed['sales_trend'] ?? 'אין נתונים'),
                            'top_performers' => $sanitize($parsed['top_performers'] ?? 'אין נתונים'),
                            'peak_times' => $sanitize($parsed['peak_times'] ?? 'אין נתונים'),
                            'recommendations' => $parsed['recommendations'] ?? [],
                            'alert' => $sanitize($parsed['alert'] ?? 'אין התראות'),
                            'provider' => 'openai'
                        ];
                    }
                } catch (\Exception $e) {
                    Log::warning('Failed to parse dashboard insights JSON', ['error' => $e->getMessage()]);
                }
            }

            // Fallback: return default structure
            if (!$result) {
                // Fallback: Smart Mock based on REAL DATA from context
                $menuItemsList = $context['menu_items'] ?? [];
                $topSellers = $context['top_sellers'] ?? [];
                $hourlyDistribution = $context['hourly_distribution'] ?? [];

                // Generate "Smart" text based on real top sellers
                if (!empty($topSellers)) {
                    $topNames = [];
                    foreach (array_slice($topSellers, 0, 2) as $seller) {
                        $topNames[] = is_object($seller) ? $seller->name : ($seller['name'] ?? 'מנה');
                    }
                    $topPerformersText = implode(' ו-', $topNames) . " מובילות את המכירות השבוע.";
                } else {
                    $topPerformersText = "עדיין אין מספיק נתונים לזיהוי מנות מובילות.";
                }

                // Generate peak times from hourly distribution
                $peakTimesText = "טרם זוהו שעות עומס מובהקות";
                if (!empty($hourlyDistribution)) {
                    arsort($hourlyDistribution);
                    $topHours = array_slice($hourlyDistribution, 0, 3, true);
                    $peakParts = [];
                    foreach ($topHours as $hour => $count) {
                        $peakParts[] = "{$hour}:00 ({$count} הזמנות)";
                    }
                    $peakTimesText = "שעות שיא: " . implode(', ', $peakParts);
                }

                // Generate "Smart" recommendations based on real menu
                $recommendations = [];
                if (!empty($menuItemsList)) {
                    $randomItem = $menuItemsList[array_rand($menuItemsList)]['name'];
                    $recommendations[] = "שקול לקדם את מנת ה-{$randomItem} בספיישלים";
                } else {
                    $recommendations[] = "הוסף מנות לתפריט כדי להתחיל למכור";
                }
                $recommendations[] = "בדוק את דוח המכירות המלא לקבלת תמונה רחבה יותר";

                $result = [
                    'sales_trend' => $ordersWeek > 0 ? "נרשמת פעילות עסקית עם {$ordersWeek} הזמנות השבוע" : "אין מספיק נתונים לזיהוי מגמה",
                    'top_performers' => $topPerformersText,
                    'peak_times' => $peakTimesText,
                    'recommendations' => $recommendations,
                    'alert' => 'אין התראות',
                    'provider' => 'openai_smart_fallback'
                ];
            }

            // Log usage
            $costCredits = config("ai.features.{$feature}.cost_credits", 1);
            $this->logUsage(
                $feature,
                'analyze',
                $costCredits,
                $response['tokens'] ?? 0,
                false,
                null,
                'success',
                null,
                $responseTime,
                ['mock' => $this->mockMode]
            );

            return $result;
        } catch (\Exception $e) {
            $responseTime = (int)((microtime(true) - $startTime) * 1000);
            $this->logUsage(
                $feature,
                'analyze',
                0,
                0,
                false,
                null,
                'error',
                $responseTime,
                null,
                ['error' => $e->getMessage()]
            );
            throw $e;
        }
    }

    /**
     * Recommend price for menu item
     */
    public function recommendPrice(array $menuItemData, array $context = []): array
    {
        $feature = 'price_recommendation';
        $startTime = microtime(true);

        try {
            $this->validateAccess($feature, $this->restaurant, $this->user);

            $prompt = "המלץ מחיר למנה. החזר JSON:\n\n"
                . "שם: " . ($menuItemData['name'] ?? 'לא צוין') . "\n"
                . "קטגוריה: " . ($menuItemData['category_name'] ?? 'לא צוין') . "\n"
                . "תיאור: " . ($menuItemData['description'] ?? 'לא צוין') . "\n"
                . "מחיר נוכחי: " . ($menuItemData['price'] ?? 'אין') . " ₪\n\n"
                . '{"recommended_price": 45.00, "confidence": "high", "reasoning": "סיבה קצרה", '
                . '"market_data": {"min_price": 35, "avg_price": 42, "max_price": 55}, '
                . '"factors": ["מרכיב1", "מרכיב2"]}';

            $response = $this->callOpenAi($prompt);
            $responseTime = (int)((microtime(true) - $startTime) * 1000);

            // Parse JSON response
            $content = $response['content'] ?? '';

            $result = null;
            // Try to extract JSON from response
            if (preg_match('/\{[\s\S]*\}/', $content, $matches)) {
                try {
                    $parsed = json_decode($matches[0], true);
                    if (json_last_error() === JSON_ERROR_NONE) {
                        $result = [
                            'recommended_price' => floatval($parsed['recommended_price'] ?? 0),
                            'confidence' => $parsed['confidence'] ?? 'medium',
                            'reasoning' => $parsed['reasoning'] ?? 'אין הסבר זמין',
                            'market_data' => $parsed['market_data'] ?? null,
                            'factors' => $parsed['factors'] ?? [],
                            'provider' => 'openai'
                        ];
                    }
                } catch (\Exception $e) {
                    Log::warning('Failed to parse price recommendation JSON', ['error' => $e->getMessage()]);
                }
            }

            // Fallback: return raw response with default values
            if (!$result) {
                $result = [
                    'recommended_price' => 0,
                    'confidence' => 'low',
                    'reasoning' => $content ?: 'לא ניתן לקבל המלצה',
                    'market_data' => null,
                    'factors' => [],
                    'provider' => 'openai'
                ];
            }

            // Log usage
            $costCredits = config("ai.features.{$feature}.cost_credits", 1);
            $this->logUsage(
                $feature,
                'recommend',
                $costCredits,
                $response['tokens'] ?? 0,
                false,
                null,
                'success',
                null,
                $responseTime,
                ['item' => $menuItemData['name'] ?? 'unknown', 'mock' => $this->mockMode]
            );

            return $result;
        } catch (\Exception $e) {
            $responseTime = (int)((microtime(true) - $startTime) * 1000);
            $this->logUsage(
                $feature,
                'recommend',
                0,
                0,
                false,
                null,
                'error',
                $responseTime,
                null,
                ['error' => $e->getMessage()]
            );
            throw $e;
        }
    }

    /**
     * Call OpenAI API (or return mock response)
     */
    private function callOpenAi($input, $systemPrompt = null): array
    {
        // Mock mode: return sample responses
        if ($this->mockMode) {
            return $this->generateMockResponse($input);
        }

        try {
            // Build messages array
            $messages = [];

            // Add system prompt if provided
            if ($systemPrompt) {
                $messages[] = ['role' => 'system', 'content' => $systemPrompt];
            }

            // Convert string to user message or use provided messages array
            if (is_string($input)) {
                $messages[] = ['role' => 'user', 'content' => $input];
            } else {
                $messages = array_merge($messages, $input);
            }

            $response = Http::withHeaders([
                'Authorization' => 'Bearer ' . $this->apiKey,
                'Content-Type' => 'application/json'
            ])->timeout(30)->post($this->baseUrl . '/chat/completions', [
                'model' => $this->model,
                'messages' => $messages,
                'temperature' => 0.7,
                'max_tokens' => 1000
            ]);

            if ($response->failed()) {
                Log::error('OpenAI API error', [
                    'status' => $response->status(),
                    'body' => $response->body()
                ]);

                // Production: No fallback - return clear error
                throw new \Exception('OpenAI API לא זמין כרגע. אנא נסה שוב מאוחר יותר.');
            }

            $data = $response->json();

            return [
                'content' => $data['choices'][0]['message']['content'] ?? '',
                'tokens' => $data['usage']['total_tokens'] ?? 0,
                'model' => $data['model'] ?? $this->model
            ];
        } catch (\Exception $e) {
            Log::error('OpenAI API exception', [
                'error' => $e->getMessage(),
                'tenant_id' => $this->tenantId
            ]);
            throw $e;
        }
    }

    /**
     * Generate mock response for testing (like CopilotService mock mode)
     */
    private function generateMockResponse($input): array
    {
        $inputText = is_array($input) ? json_encode($input) : $input;

        // Detect intent from input
        if (str_contains($inputText, 'description') || str_contains($inputText, 'תיאור')) {
            $mockContent = "מנה טעימה ומיוחדת שתפנק את החיך שלכם! מוכנת בקפידה ממרכיבים טריים ואיכותיים. מומלץ מאוד!";
        } elseif (str_contains($inputText, 'price') || str_contains($inputText, 'מחיר')) {
            $mockContent = "המחיר המומלץ: ₪45-55 בהתבסס על ניתוח השוק והמתחרים.";
        } elseif (str_contains($inputText, 'insight') || str_contains($inputText, 'תובנות')) {
            $mockContent = "תובנות: המכירות השבוע עלו ב-15%. הפריט הפופולרי ביותר: פיצה מרגריטה. המלצה: הוסף מנות דומות.";
        } else {
            $mockContent = "שלום! אני עוזר ה-AI שלך (במצב Mock). איך אני יכול לעזור היום?";
        }

        return [
            'content' => $mockContent,
            'tokens' => strlen($mockContent), // Simulated token count
            'model' => 'mock-gpt-4o-mini'
        ];
    }

    /**
     * Build restaurant chat system prompt with Hebrew glossary support
     */
    private function buildRestaurantChatPrompt(array $context): string
    {
        $prompt = "אתה עוזר AI ידידותי למנהלי מסעדות המשתמשים במערכת TakeEat.\n\n";

        // תאריך ושעה נוכחיים
        if (!empty($context['current_datetime'])) {
            $prompt .= "📅 תאריך ושעה נוכחיים (שעון ישראל): {$context['current_datetime']}\n\n";
        }

        // Add restaurant specific context
        if (!empty($context['restaurant'])) {
            $r = $context['restaurant'];
            $prompt .= "המסעדה: " . ($r['name'] ?? 'לא ידוע') . "\n";

            // Check for active trial
            $subscriptionText = 'free';
            if (!empty($r['trial_ends_at'])) {
                $trialEnd = \Carbon\Carbon::parse($r['trial_ends_at']);
                if ($trialEnd->isFuture()) {
                    $daysRemaining = now()->diffInDays($trialEnd);
                    $subscriptionText = "Pro (תקופת ניסיון - נותרו {$daysRemaining} ימים)";
                } else {
                    $subscriptionText = $r['subscription_tier'] ?? 'free';
                }
            } elseif (!empty($r['subscription_tier'])) {
                $subscriptionText = $r['subscription_tier'];
            }

            $prompt .= "מסלול מנוי: " . $subscriptionText . "\n\n";
        }

        if (!empty($context['orders'])) {
            $o = $context['orders'];
            $prompt .= "נתוני הזמנות:\n";
            $prompt .= "- היום: " . ($o['today'] ?? 0) . "\n";
            $prompt .= "- השבוע: " . ($o['this_week'] ?? 0) . "\n";
            $prompt .= "- החודש: " . ($o['this_month'] ?? 0) . "\n\n";
        }

        if (!empty($context['revenue'])) {
            $rev = $context['revenue'];
            $prompt .= "הכנסות:\n";
            $prompt .= "- היום: ₪" . number_format($rev['today'] ?? 0, 2) . "\n";
            $prompt .= "- השבוע: ₪" . number_format($rev['this_week'] ?? 0, 2) . "\n";
            $prompt .= "- החודש: ₪" . number_format($rev['this_month'] ?? 0, 2) . "\n\n";
        }

        if (!empty($context['top_items'])) {
            $prompt .= "מנות מובילות (רבי מכר):\n";
            foreach ($context['top_items'] as $item) {
                $prompt .= "- " . ($item['name'] ?? 'לא ידוע') . " (" . ($item['orders'] ?? 0) . " הזמנות)\n";
            }
            $prompt .= "\n";
        }

        $prompt .= "תפקידך: לעזור בניהול תפריט, הזמנות, וניתוח עסקי.\n";
        $prompt .= "השתמש בנתונים האמיתיים שלך למתן תשובות מדויקות.\n\n";

        // Add Hebrew glossary from config
        $glossary = config('ai.language.glossary', [
            'שווארמה' => 'shawarma',
            'פלאפל' => 'falafel',
            'חומוס' => 'hummus'
        ]);

        if (!empty($glossary)) {
            $prompt .= "מילון מונחים:\n";
            foreach ($glossary as $he => $en) {
                $prompt .= "- {$he} ({$en})\n";
            }
            $prompt .= "\n";
        }

        $prompt .= "השב בעברית, בצורה ברורה ומעשית.";

        return $prompt;
    }

    /**
     * Build description prompt with Hebrew support
     */
    private function buildDescriptionPrompt(array $menuItemData): string
    {
        $restaurantType = $this->restaurant->restaurant_type ?? 'general';
        $promptFile = config("ai.restaurant_types.{$restaurantType}.prompt_file", 'general.txt');
        $promptPath = storage_path("prompts/{$promptFile}");

        // Load prompt template from file
        if (file_exists($promptPath)) {
            $template = file_get_contents($promptPath);
        } else {
            // Fallback to general if file not found
            $fallbackPath = storage_path('prompts/general.txt');
            $template = file_exists($fallbackPath) ? file_get_contents($fallbackPath) : $this->getFallbackPrompt();
        }

        // Prepare data
        $name = $menuItemData['name'] ?? 'Unknown';
        $price = $menuItemData['price'] ?? 0;
        $category = $menuItemData['category'] ?? 'Food';
        $allergens = $menuItemData['allergens'] ?? [];
        $isVegetarian = $menuItemData['is_vegetarian'] ?? false;
        $isVegan = $menuItemData['is_vegan'] ?? false;

        // Build allergens and diet text
        $allergensText = empty($allergens) ? '' : "אלרגנים: " . implode(', ', $allergens) . "\n";
        $dietText = '';
        if ($isVegan) {
            $dietText = "מתאים לטבעונים\n";
        } elseif ($isVegetarian) {
            $dietText = "מתאים לצמחונים\n";
        }

        // Replace placeholders (price removed - not needed in description)
        return str_replace(
            ['{name}', '{category}', '{allergens}', '{dietary}'],
            [$name, $category, $allergensText, $dietText],
            $template
        );
    }

    /**
     * Fallback prompt if files missing
     */
    private function getFallbackPrompt(): string
    {
        return "כתוב תיאור קצר ומקצועי למנה (משפט אחד, עד 15 מילים):\n\nשם: {name}\nקטגוריה: {category}\n{allergens}{dietary}\n\nכללים: תיאור עובדתי, ללא שיווק מוגזם, פשוט וברור. אם זה משקה - תאר סוג וגודל בלבד.\n\nהחזר רק תיאור בעברית, ללא מחירים.";
    }

    /**
     * Generate cache key for results
     */
    private function getCacheKey(string $type, array $data): string
    {
        $key = "openai_{$type}_{$this->tenantId}_" . md5(json_encode($data));
        return $key;
    }

    /**
     * Get suggested actions for restaurant (like CopilotService)
     */
    public function getRestaurantSuggestedActions(array $context, ?string $preset = null): array
    {
        $actions = [];

        // Recommendations based on preset
        if ($preset === 'menu_suggestions') {
            $actions[] = ['label' => '📋 עריכת תפריט', 'route' => '/admin/menu'];
            $actions[] = ['label' => '📊 ניהול קטגוריות', 'route' => '/admin/categories'];
        } elseif ($preset === 'order_summary') {
            $actions[] = ['label' => '📦 הזמנות פעילות', 'route' => '/admin/orders'];
            $actions[] = ['label' => '📈 דוחות', 'route' => '/admin/reports'];
        }

        return array_slice($actions, 0, 3); // Max 3 actions
    }
}

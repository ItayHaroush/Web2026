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

            // Call OpenAI (or mock)
            $response = $this->callOpenAi($prompt);
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
        $ordersToday = $context['orders_today'] ?? 0;
        $ordersWeek = $context['orders_week'] ?? 0;
        $ordersMonth = $context['orders_month'] ?? 0;
        $revenueToday = $context['revenue_today'] ?? 0;
        $revenueWeek = $context['revenue_week'] ?? 0;
        $menuItems = $context['total_menu_items'] ?? 0;
        $categories = $context['active_categories'] ?? 0;
        $pendingOrders = $context['pending_orders'] ?? 0;

        $prompt = "אתה יועץ עסקי למסעדות בישראל. נתח את נתוני הדשבורד הבאים עבור מסעדת \"{$restaurantName}\":\n\n"
            . "📊 סטטיסטיקות:\n"
            . "- הזמנות היום: {$ordersToday}\n"
            . "- הזמנות השבוע: {$ordersWeek}\n"
            . "- הזמנות החודש: {$ordersMonth}\n"
            . "- הכנסות היום: ₪{$revenueToday}\n"
            . "- הכנסות השבוע: ₪{$revenueWeek}\n"
            . "- פריטים בתפריט: {$menuItems}\n"
            . "- קטגוריות פעילות: {$categories}\n"
            . "- הזמנות ממתינות: {$pendingOrders}\n\n"
            . "החזר תשובה בפורמט JSON הבא בעברית:\n"
            . "{\n"
            . '  "sales_trend": "ניתוח מגמת המכירות - האם עולות/יורדות/יציבות",' . "\n"
            . '  "top_performers": "הפריטים/קטגוריות המובילים (על סמך הנתונים)",' . "\n"
            . '  "peak_times": "ניתוח זמני העומס והשקט",' . "\n"
            . '  "recommendations": ["המלצה 1", "המלצה 2", "המלצה 3"],' . "\n"
            . '  "alert": "אזהרה חשובה אם יש (או null)"' . "\n"
            . "}\n\nהחזר רק JSON, ללא טקסט נוסף.";

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
                        $result = array_merge([
                            'sales_trend' => $parsed['sales_trend'] ?? 'אין נתונים',
                            'top_performers' => $parsed['top_performers'] ?? 'אין נתונים',
                            'peak_times' => $parsed['peak_times'] ?? 'אין נתונים',
                            'recommendations' => $parsed['recommendations'] ?? [],
                            'alert' => $parsed['alert'] ?? null,
                            'provider' => 'openai'
                        ]);
                    }
                } catch (\Exception $e) {
                    \Log::warning('Failed to parse dashboard insights JSON', ['error' => $e->getMessage()]);
                }
            }

            // Fallback: return default structure
            if (!$result) {
                $result = [
                    'sales_trend' => 'לא ניתן לנתח את הנתונים כרגע',
                    'top_performers' => 'אין מספיק נתונים',
                    'peak_times' => 'אין מספיק נתונים',
                    'recommendations' => [],
                    'alert' => null,
                    'provider' => 'openai'
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

        $prompt = "אתה יועץ תמחור למסעדות בישראל. נתח את הפריט הבא והמלץ על מחיר הוגן:\n\n"
            . "שם: " . ($menuItemData['name'] ?? 'לא צוין') . "\n"
            . "קטגוריה: " . ($menuItemData['category_name'] ?? 'לא צוין') . "\n"
            . "תיאור: " . ($menuItemData['description'] ?? 'לא צוין') . "\n"
            . "מחיר נוכחי: " . ($menuItemData['price'] ?? 'אין') . " ₪\n\n"
            . "החזר תשובה בפורמט JSON הבא:\n"
            . "{\n"
            . '  "recommended_price": 45.00,' . "\n"
            . '  "confidence": "high/medium/low",' . "\n"
            . '  "reasoning": "הסבר קצר בעברית למה המחיר הזה הגיוני",' . "\n"
            . '  "market_data": {' . "\n"
            . '    "min_price": 35.00,' . "\n"
            . '    "avg_price": 42.00,' . "\n"
            . '    "max_price": 55.00' . "\n"
            . '  },' . "\n"
            . '  "factors": ["מרכיבים איכותיים", "גודל מנה", "תחרות"]' . "\n"
            . "}\n\nהחזר רק JSON, ללא טקסט נוסף.";

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
                    \Log::warning('Failed to parse price recommendation JSON', ['error' => $e->getMessage()]);
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
    private function callOpenAi($input): array
    {
        // Mock mode: return sample responses
        if ($this->mockMode) {
            return $this->generateMockResponse($input);
        }

        try {
            // Convert string to messages array
            if (is_string($input)) {
                $messages = [
                    ['role' => 'user', 'content' => $input]
                ];
            } else {
                $messages = $input;
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
        $prompt .= "תפקידך: לעזור בניהול תפריט, הזמנות, וניתוח עסקי.\n\n";

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
        $name = $menuItemData['name'] ?? 'Unknown';
        $category = $menuItemData['category'] ?? 'Food';
        $price = $menuItemData['price'] ?? 0;

        return "צור תיאור מפתה וטעים לפריט תפריט זה:\n\nשם: {$name}\nקטגוריה: {$category}\nמחיר: ₪{$price}\n\nספק תיאור של 2-3 משפטים בעברית.";
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

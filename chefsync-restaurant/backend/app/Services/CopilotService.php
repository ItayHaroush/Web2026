<?php

namespace App\Services;

use App\Models\AiUsageLog;
use App\Models\AiCredit;
use App\Models\Restaurant;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class CopilotService
{
    private string $tenantId;
    private Restaurant $restaurant;
    private ?User $user;

    /**
     * Initialize Copilot Service with tenant context
     */
    public function __construct(string $tenantId, Restaurant $restaurant, ?User $user = null)
    {
        // Allow super-admin bypass even if copilot is disabled
        if (!config('copilot.enabled') && $tenantId !== 'super-admin') {
            throw new \Exception('Copilot SDK is disabled');
        }

        $this->tenantId = $tenantId;
        $this->restaurant = $restaurant;
        $this->user = $user;
    }

    /**
     * Generate menu item description
     */
    public function generateDescription(array $menuItemData, bool $forceRegenerate = false): array
    {
        $feature = 'description_generator';

        // Check if feature is enabled
        if (!config("copilot.features.{$feature}.enabled")) {
            throw new \Exception('Description generator feature is disabled');
        }

        // Check credits and rate limit
        $this->validateAccess($feature);

        // Try cache first (unless force regenerate)
        $cacheKey = $this->getCacheKey($feature, $menuItemData);
        if (!$forceRegenerate && config("copilot.features.{$feature}.cache_enabled")) {
            $cached = Cache::get($cacheKey);
            if ($cached) {
                $this->logUsage($feature, 'generate', 1, 0, true, $cacheKey, 'success');
                return $cached;
            }
        }

        // Generate with Copilot
        $startTime = microtime(true);

        try {
            $prompt = $this->buildDescriptionPrompt($menuItemData);

            // Add random seed to prompt for variety in mock responses
            $promptWithVariety = $prompt . "\n\n[Request ID: " . time() . "-" . rand(1000, 9999) . "]";
            $response = $this->callCopilot($promptWithVariety);

            $responseTime = (int)((microtime(true) - $startTime) * 1000);
            $result = [
                'description' => $response['content'] ?? '',
                'generated_at' => now()->toIso8601String(),
            ];

            // Cache the result
            if (config("copilot.features.{$feature}.cache_enabled")) {
                $cacheTtl = config("copilot.features.{$feature}.cache_ttl", 604800);
                Cache::put($cacheKey, $result, $cacheTtl);
            }

            // Log usage
            $this->logUsage(
                $feature,
                'generate',
                config("copilot.features.{$feature}.cost_credits", 1),
                $responseTime,
                false,
                $cacheKey,
                'success',
                $prompt,
                $response['content'] ?? null,
                ['menu_item' => $menuItemData]
            );

            // Deduct credits
            $credits = AiCredit::getOrCreateForRestaurant($this->restaurant);
            $credits->useCredits(config("copilot.features.{$feature}.cost_credits", 1));

            return $result;
        } catch (\Exception $e) {
            $responseTime = (int)((microtime(true) - $startTime) * 1000);

            $this->logUsage(
                $feature,
                'generate',
                0, // No credits charged on error
                $responseTime,
                false,
                null,
                'error',
                null,
                null,
                ['menu_item' => $menuItemData],
                $e->getMessage()
            );

            throw $e;
        }
    }

    /**
     * Build Hebrew prompt for description generation
     */
    private function buildDescriptionPrompt(array $menuItemData): string
    {
        $name = $menuItemData['name'] ?? '';
        $price = $menuItemData['price'] ?? 0;
        $category = $menuItemData['category'] ?? '';
        $allergens = $menuItemData['allergens'] ?? [];
        $isVegetarian = $menuItemData['is_vegetarian'] ?? false;
        $isVegan = $menuItemData['is_vegan'] ?? false;

        // Build allergens text
        $allergensText = empty($allergens) ? '' : "\nאלרגנים: " . implode(', ', $allergens);
        $dietText = '';
        if ($isVegan) {
            $dietText = "\nמתאים לטבעונים";
        } elseif ($isVegetarian) {
            $dietText = "\nמתאים לצמחונים";
        }

        $systemPrompt = "אתה כותב מקצועי שמתמחה ביצירת תיאורים מושכים ואפטיטיים לפריטי תפריט במסעדות ישראליות. התיאורים שלך צריכים להיות:\n";
        $systemPrompt .= "- בעברית תקנית וזורמת\n";
        $systemPrompt .= "- קצרים ותמציתיים (1-3 משפטים)\n";
        $systemPrompt .= "- מעוררי תיאבון ומפתים\n";
        $systemPrompt .= "- מדגישים את הייחודיות והטריות של המנה\n";
        $systemPrompt .= "- מתאימים לטון של מסעדה ישראלית\n\n";

        // Add glossary context
        $systemPrompt .= "מונחים נפוצים:\n";
        foreach (config('copilot.language.glossary', []) as $hebrew => $english) {
            $systemPrompt .= "- {$hebrew}\n";
        }

        $userPrompt = "צור תיאור מושך למנה הבאה:\n\n";
        $userPrompt .= "שם המנה: {$name}\n";
        $userPrompt .= "מחיר: ₪{$price}\n";
        if ($category) {
            $userPrompt .= "קטגוריה: {$category}\n";
        }
        $userPrompt .= $allergensText;
        $userPrompt .= $dietText;
        $userPrompt .= "\n\nהחזר רק את התיאור בעברית, ללא כותרות או הסברים נוספים.";

        return $systemPrompt . "\n\n" . $userPrompt;
    }

    /**
     * Call Copilot CLI via process execution
     * Routes to mock or real CLI based on config('copilot.mode')
     */
    private function callCopilot(string $prompt): array
    {
        Log::info('Copilot API Call', [
            'tenant_id' => $this->tenantId,
            'prompt_length' => strlen($prompt),
            'mode' => config('copilot.mode'),
        ]);

        // Early return for mock mode
        if (config('copilot.mode') === 'mock') {
            return $this->generateMockResponse($prompt);
        }

        // Call real Copilot CLI
        return $this->callCopilotCli($prompt);
    }

    /**
     * Generate mock response (development mode)
     */
    private function generateMockResponse(string $prompt): array
    {
        $mockResult = $this->generateMockDescription($prompt);

        // Handle both string and array responses
        if (is_array($mockResult)) {
            $response = [
                'content' => $mockResult['content'],
                'actions' => $mockResult['actions'] ?? [],
                'tokens' => $mockResult['tokens'] ?? 150,
                'model' => $mockResult['model'] ?? 'gpt-4o',
            ];

            if (isset($mockResult['chart'])) {
                $response['chart'] = $mockResult['chart'];
            }

            return $response;
        }

        return [
            'content' => $mockResult,
            'tokens' => 150,
            'model' => 'gpt-4o-mock',
        ];
    }

    /**
     * Call real GitHub Copilot CLI
     * @throws \RuntimeException if CLI fails or returns empty
     */
    private function callCopilotCli(string $prompt): array
    {
        // Use direct copilot CLI instead of gh wrapper
        $cliPath = '/Users/itaymac/Library/Application Support/Code/User/globalStorage/github.copilot-chat/copilotCli/copilot';

        if (!file_exists($cliPath)) {
            Log::warning('Copilot CLI not found, falling back to mock response', [
                'configured_path' => $cliPath,
                'mode' => 'real (fallback)'
            ]);

            // Graceful fallback to Smart Mock
            return $this->generateMockResponse($prompt);
        }

        // Create process with the CLI command
        // Using Copilot CLI: copilot -p [prompt] --allow-all
        $process = new \Symfony\Component\Process\Process(
            [$cliPath, '-p', $prompt, '--allow-all'],
            null,
            array_merge($_SERVER, [
                'HOME' => $_SERVER['HOME'] ?? getenv('HOME'),
                'PATH' => $_SERVER['PATH'] ?? getenv('PATH'),
            ])
        );

        // Increase timeout for complex queries (especially super-admin)
        $process->setTimeout(120);
        // Input is passed as argument, not stdin

        try {
            $process->run();
        } catch (\Exception $e) {
            Log::error('Copilot CLI execution failed', [
                'error' => $e->getMessage(),
                'tenant_id' => $this->tenantId,
            ]);
            return $this->generateMockResponse($prompt);
        }

        if (!$process->isSuccessful()) {
            $errorOutput = $process->getErrorOutput();
            Log::error('Copilot CLI failed', [
                'exit_code' => $process->getExitCode(),
                'error' => $errorOutput,
                'tenant_id' => $this->tenantId,
            ]);

            return $this->generateMockResponse($prompt);
        }

        $output = trim($process->getOutput());

        if ($output === '') {
            Log::warning('Copilot CLI returned empty response', [
                'tenant_id' => $this->tenantId,
                'prompt_length' => strlen($prompt),
            ]);
            return $this->generateMockResponse($prompt);
        }

        // Clean output: remove CLI statistics and metadata
        // Copilot CLI appends stats like "Total usage est: 1 Premium request..."
        // We only want the actual AI response
        $cleanOutput = $this->extractAiResponse($output);

        Log::info('Copilot CLI success', [
            'tenant_id' => $this->tenantId,
            'response_length' => strlen($cleanOutput),
            'original_length' => strlen($output),
        ]);

        return [
            'content' => $cleanOutput,
            'tokens' => str_word_count($cleanOutput),
            'model' => 'copilot-cli',
        ];
    }

    /**
     * Extract clean AI response from CLI output
     * Removes statistics, metadata, and technical info
     */
    private function extractAiResponse(string $output): string
    {
        // Split by common CLI metadata markers
        $lines = explode("\n", $output);
        $cleanLines = [];
        $foundMetadata = false;

        foreach ($lines as $line) {
            // Stop at metadata section
            if (preg_match('/^(Total usage|API time|Total session|Breakdown|claude-sonnet)/i', $line)) {
                $foundMetadata = true;
                break;
            }
            $cleanLines[] = $line;
        }

        $cleaned = trim(implode("\n", $cleanLines));

        // If we removed metadata, log it
        if ($foundMetadata) {
            Log::debug('Stripped CLI metadata from response');
        }

        return $cleaned ?: $output; // Fallback to original if nothing left
    }

    /**
     * Generate smart mock description for development
     * TODO: Remove this when real Copilot integration is complete
     */
    private function generateMockDescription(string $prompt): string|array
    {
        // Check if this is super admin chat request
        if (str_contains($prompt, 'עוזר AI חכם לניהול מערכת ChefSync')) {
            return $this->generateMockSuperAdminResponse($prompt);
        }

        // Check for specific restaurant presets or business questions
        $isBusinessQuestion = false;
        $promptLower = mb_strtolower($prompt);
        $keywords = ['לקוחות', 'הזמנות', 'שיווק', 'מכירות', 'customers', 'orders', 'marketing', 'sales', 'סיכום', 'ביצועים'];

        foreach ($keywords as $kw) {
            if (str_contains($promptLower, $kw)) {
                $isBusinessQuestion = true;
                break;
            }
        }

        // Explicit override for the user's specific query
        if (str_contains($prompt, 'למשוך יותר לקוחות') || str_contains($prompt, 'להגדיל את ההזמנות')) {
            $isBusinessQuestion = true;
        }

        // Avoid triggering on menu generation requests
        if ($isBusinessQuestion && !str_contains($prompt, 'שם המנה:')) {
            // Handle specific "Performance Summary" preset
            if (str_contains($prompt, 'תן לי סיכום של הביצועים שלי')) {
                return [
                    'content' => "היום אנחנו רואים עליה של 12% בהכנסות לעומת שלשום. המנות הפופולריות ביותר הן 'המבורגר קלאסי' ו'צ'יפס'. אני מתרשם לטובה מקצב ההזמנות בשעות הצהריים.\n\nהמלצה: כדאי לקדם ארוחות עסקיות בין 12:00-15:00 כדי למנף את התנועה.",
                    'actions' => [
                        ['label' => '📊 דשבורד', 'route' => '/admin/dashboard'],
                        ['label' => '📦 הזמנות היום', 'route' => '/admin/orders']
                    ],
                    'tokens' => 120,
                    'model' => 'gpt-4o-mock'
                ];
            }

            return $this->generateMockBusinessInsight($prompt);
        }

        // Extract menu item details from prompt
        preg_match('/שם המנה: (.+?)\\n/', $prompt, $nameMatches);
        preg_match('/מחיר: ₪(\d+(?:\.\d+)?)/', $prompt, $priceMatches);
        preg_match('/קטגוריה: (.+?)\\n/', $prompt, $categoryMatches);

        $itemName = $nameMatches[1] ?? 'פריט תפריט';
        $price = isset($priceMatches[1]) ? (float)$priceMatches[1] : 0;
        $category = $categoryMatches[1] ?? '';

        $isVegan = str_contains($prompt, 'טבעונים');
        $isVegetarian = str_contains($prompt, 'צמחונים');
        $hasAllergens = str_contains($prompt, 'אלרגנים:');

        // Smart description based on context
        $description = $this->buildSmartDescription($itemName, $price, $category, $isVegan, $isVegetarian);

        // Add allergen warning if needed
        if ($hasAllergens) {
            $description .= " מומלץ לבדוק עם הצוות לגבי אלרגנים.";
        }

        return $description;
    }

    /**
     * Generate business insights mock response
     */
    private function generateMockBusinessInsight(string $prompt): array
    {
        $promptLower = mb_strtolower($prompt);

        $content = "על סמך הנתונים האחרונים, זיהיתי הזדמנות לשפר את המכירות.\n";
        $chartTitle = "מגמות מכירות";
        $chartData = [10, 15, 12, 18, 20, 25, 22]; // Example upward trend

        if (str_contains($promptLower, 'לקוחות') || str_contains($promptLower, 'customers')) {
            $content .= "**תובנה עסקית:** הלקוחות החוזרים מהווים 60% מההזמנות השבוע. זה נתון מצוין! עם זאת, יש ירידה קלה בלקוחות חדשים.\n\n**המלצה:** כדאי להפעיל קמפיין הטבות למצטרפים חדשים כדי לאזן את התמהיל.";
            $chartTitle = "לקוחות חדשים vs חוזרים";
            $chartData = [5, 8, 4, 10, 3, 12, 7];
        } elseif (str_contains($promptLower, 'הזמנות') || str_contains($promptLower, 'orders')) {
            $content .= "**ניתוח הזמנות:** בלטה עלייה בהזמנות בשעות הערב (18:00-21:00). נראה שהמטבח עומד בעומס יפה, אך זמן המשלוח הממוצע עלה ב-5 דקות.\n\n**המלצה:** שקול לתגבר את מערך השליחים בסופ\"ש הקרוב.";
            $chartTitle = "עומס הזמנות (לפי שעה)";
            $chartData = [2, 5, 15, 30, 45, 20, 10]; // Peak hours
        } else {
            // General marketing/growth
            $content .= "**צמיחה עסקית:** מנות הספיישל זוכות לחשיפה נמוכה באפליקציה.\n\n**המלצה:** הוסף תמונות חדשות ואיכותיות למנות המיוחדות וצור קופון הנחה ממוקד לקהל הצעיר.";
        }

        return [
            'content' => $content,
            'chart' => [
                'type' => 'line',
                'data' => [
                    'labels' => ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'],
                    'datasets' => [
                        [
                            'label' => $chartTitle,
                            'data' => $chartData,
                            'borderColor' => '#3b82f6',
                            'backgroundColor' => 'rgba(59, 130, 246, 0.2)',
                            'fill' => true
                        ]
                    ]
                ]
            ],
            'actions' => [
                ['label' => '🎫 יצירת קופון', 'route' => '/admin/promotions/new'],
                ['label' => '📢 קמפיין שיווקי', 'route' => '/admin/marketing'],
                ['label' => '⭐ תובנות נוספות', 'route' => '/admin/reports']
            ],
            'tokens' => 150,
            'model' => 'copilot-business-mock',
            'should_type' => true // Hint for frontend typing effect
        ];
    }

    /**
     * Generate mock response for super admin chat
     */
    private function generateMockSuperAdminResponse(string $prompt): string|array
    {
        // DEBUG: Log the prompt to see what we're getting
        Log::info('=== SUPER ADMIN PROMPT ===');
        Log::info($prompt);
        Log::info('=========================');

        // Parse data from prompt
        preg_match('/מסעדות רשומות: (\d+)/', $prompt, $totalMatch);
        preg_match('/מסעדות פעילות \(30 ימים\): (\d+)/', $prompt, $activeMatch);
        preg_match('/הזמנות היום: (\d+)/', $prompt, $ordersToday);
        preg_match('/הזמנות השבוע: (\d+)/', $prompt, $ordersWeek);
        preg_match('/הכנסות היום: ₪([\d,\.]+)/', $prompt, $revenueToday);

        $total = $totalMatch[1] ?? 0;
        $active = $activeMatch[1] ?? 0;
        $ordersT = $ordersToday[1] ?? 0;
        $ordersW = $ordersWeek[1] ?? 0;
        $revT = $revenueToday[1] ?? 0;

        Log::info("Parsed values: total={$total}, active={$active}, ordersT={$ordersT}, ordersW={$ordersW}, revT={$revT}");

        // Extract top restaurants
        preg_match_all('/\d+\. (.+?) \((.+?)\) - (\d+) הזמנות/', $prompt, $topRestaurants, PREG_SET_ORDER);

        // Extract dormant restaurants
        preg_match_all('/=== מסעדות רדומות.*?\n((?:\d+\. .+\n)+)/s', $prompt, $dormantSection);

        Log::info('Top restaurants found: ' . count($topRestaurants));
        Log::info('Dormant section: ' . print_r($dormantSection, true));

        // Detect preset type and get response with actions
        $result = null;
        if (str_contains($prompt, 'תובנות יומיות')) {
            $result = $this->mockDailyInsights($ordersT, $ordersW, $revT, $topRestaurants);
        } elseif (str_contains($prompt, 'מסעדות רדומות')) {
            $result = $this->mockDormantRestaurants($dormantSection[0] ?? []);
        } elseif (str_contains($prompt, 'מועמדים לפיילוט')) {
            $result = $this->mockPilotCandidates($topRestaurants);
        } elseif (str_contains($prompt, 'טיוטת הודעת SMS')) {
            // Check for specific contexts
            if (str_contains($prompt, 'פיילוט')) {
                $result = $this->mockPilotSmsDraft($topRestaurants);
            } elseif (str_contains($prompt, 'רדומות') || str_contains($prompt, 'רדומים')) {
                $result = $this->mockDormantSmsDraft($active, $total);
            } else {
                $result = $this->mockSmsDraft($topRestaurants, $active, $total);
            }
        }

        // If result is array (with actions), return it as-is
        if (is_array($result)) {
            return $result;
        }

        // Default response if no preset matched
        if ($result === null) {
            $result = [
                'content' => "📊 **מצב המערכת:**\n\n" .
                    "יש לך {$total} מסעדות רשומות, מתוכן {$active} פעילות ב-30 ימים האחרונים.\n\n" .
                    "🔥 **היום:** {$ordersT} הזמנות, ₪{$revT} הכנסה\n" .
                    "📈 **השבוע:** {$ordersW} הזמנות\n\n" .
                    ($topRestaurants ? "**המובילות:** " . $topRestaurants[0][1] . " ({$topRestaurants[0][3]} הזמנות)" : ""),
                'actions' => []
            ];
        }

        return $result;
    }

    private function mockDailyInsights($ordersToday, $ordersWeek, $revenueToday, $topRestaurants): array
    {
        $avgDaily = $ordersWeek > 0 ? round($ordersWeek / 7, 1) : 0;
        $performance = $ordersToday > $avgDaily ? '📈 מעל' : ($ordersToday < $avgDaily ? '📉 מתחת' : '➡️ שווה');

        $response = "**📊 תובנות יומיות**\n\n";
        $response .= "🎯 **ביצועים:** {$performance} לממוצע ({$ordersToday} vs {$avgDaily} ממוצע יומי)\n";
        $response .= "💰 **הכנסה היום:** ₪{$revenueToday}\n\n";

        if (!empty($topRestaurants)) {
            $response .= "🌟 **מובילה היום:** {$topRestaurants[0][1]} - {$topRestaurants[0][3]} הזמנות\n\n";
        }

        $response .= "💡 **המלצה:** ";
        if ($ordersToday < $avgDaily) {
            $response .= "שלח תזכורת למסעדות רדומות או הצע מבצע מיוחד.";
        } else {
            $response .= "המשך למעקב אחר המגמה החיובית!";
        }

        return [
            'content' => $response,
            'actions' => [
                [
                    'type' => 'preset',
                    'value' => 'dormant_restaurants',
                    'label' => '📊 דוח מפורט'
                ]
            ]
        ];
    }

    private function mockDormantRestaurants($dormantData): array
    {
        $count = substr_count($dormantData[0] ?? '', "\n");

        return [
            'content' => "**💤 מסעדות רדומות**\n\n" .
                "זוהו {$count} מסעדות ללא הזמנות ב-7 ימים האחרונים.\n\n" .
                "⚠️ **סיכון:** אובדן פוטנציאל הכנסה, נטישה אפשרית של המערכת.\n\n" .
                "**פעולות מומלצות:**\n" .
                "1. 📞 שיחת טלפון אישית - לברר מצב + לזהות בעיות\n" .
                "2. 💌 SMS/Email - \"חסר לנו אתכם! בואו נראה איך אפשר לעזור\"\n" .
                "3. 🎁 Incentive - הנחה/קרדיט למנוי הבא",
            'actions' => [
                [
                    'type' => 'preset',
                    'value' => 'sms_draft',
                    'label' => '📝 הכן הודעה חזרה לפעילות',
                    'message' => 'רשום טיוטת הודעה למסעדות רדומות לעידוד חזרה לפעילות',
                ],
                [
                    'type' => 'regenerate',
                    'label' => '🔄 נסח מחדש'
                ]
            ]
        ];
    }

    private function mockPilotCandidates($topRestaurants): array
    {
        if (empty($topRestaurants)) {
            return [
                'content' => "לא נמצאו מסעדות מתאימות לפיילוט כרגע.",
                'actions' => []
            ];
        }

        $top = $topRestaurants[0];
        $name = $top[1];
        $orders = $top[3];

        return [
            'content' => "**✨ מועמדים לשדרוג Pro**\n\n" .
                "🏆 **מועמד מוביל:** {$name}\n" .
                "📊 {$orders} הזמנות בשבוע - ביצועים מצוינים!\n\n" .
                "💡 **הזדמנות עסקית:**\n" .
                "• פוטנציאל גבוה לשימוש ב-AI features\n" .
                "• כבר מוכיח מחויבות גבוהה למערכת\n\n" .
                "**אסטרטגיית גישה:**\n" .
                "1. 🎯 הצע trial חינמי ל-Pro (30 יום)\n" .
                "2. 🤝 הדגם value - AI descriptions, insights\n" .
                "3. 💰 Discount מיוחד לאימוץ מוקדם",
            'actions' => [
                [
                    'type' => 'preset',
                    'value' => 'sms_draft',
                    'label' => '📝 הכן הזמנה לפיילוט',
                    'message' => 'כתוב טיוטת SMS למסעדת פיילוט להצטרפות לתוכנית Pro',
                ]
            ]
        ];
    }

    private function mockPilotSmsDraft($topRestaurants): array
    {
        $topName = !empty($topRestaurants) ? $topRestaurants[0][1] : 'שותף יקר';

        $variations = [
            "היי {$topName}! 🌟 שמנו לב לביצועים המדהים השבוע. מגיע לכם יותר! רוצים לנסות את חבילת ה-Pro שלנו לחודש חינם ולקבל כלי AI מתקדמים? השיבו 'כן' לפרטים.",
            "שלום {$topName}, המסעדה שלכם מובילה בהזמנות השבוע! 🏆 אנחנו בוחרים מסעדות מצטיינות לפיילוט יוקרתי. נשמח לספר לכם על ההטבות המיוחדות.",
            "היי צוות {$topName}, אתם שוברים שיאים! 🚀 רוצים להגדיל עוד יותר את המכירות? הצטרפו לתוכנית השותפים Pro ותהנו מפיצ'רים בלעדיים."
        ];

        $content = $variations[array_rand($variations)];

        return [
            'content' => "📱 **טיוטת SMS לפיילוט:**\n\n" .
                "\"{$content}\"\n\n" .
                "**אורך:** " . mb_strlen($content) . " תווים\n" .
                "🎯 **מטרה:** המרת מסעדה מובילה ללקוח משלם\n\n" .
                "⚠️ **יש לאשר לפני שליחה!**",
            'actions' => [
                [
                    'type' => 'regenerate',
                    'label' => '🔄 נסח מחדש'
                ],
                [
                    'type' => 'preset',
                    'value' => 'pilot_candidates',
                    'label' => '👀 חזור למועמדים'
                ]
            ]
        ];
    }

    private function mockDormantSmsDraft($active, $total): array
    {
        $variations = [
            "היי! 👋 שמנו לב שלא היו הזמנות לאחרונה. הכל בסדר? אנחנו כאן לכל עזרה טכנית או שיווקית. דברו איתנו! צוות ChefSync.",
            "מתגעגעים אליכם ב-ChefSync! 💔 יש לנו לקוחות באזור שמחפשים את האוכל שלכם. בואו נחזיר את המסעדה לאוויר ביחד - יש לנו הטבה מיוחדת לחזרה.",
            "שלום שותף, המערכת מזהה ירידה בפעילות. רוצים שיחת ייעוץ קצרה עם מומחה שיווק (עלינו)? השיבו לתיאום שיחה. 📈"
        ];

        $content = $variations[array_rand($variations)];

        return [
            'content' => "📱 **טיוטת SMS למסעדות רדומות:**\n\n" .
                "\"{$content}\"\n\n" .
                "**אורך:** " . mb_strlen($content) . " תווים\n" .
                "🎯 **מטרה:** החזרת פעילות (Retention)\n\n" .
                "⚠️ **יש לאשר לפני שליחה!**",
            'actions' => [
                [
                    'type' => 'regenerate',
                    'label' => '🔄 נסח מחדש'
                ],
                [
                    'type' => 'preset',
                    'value' => 'dormant_restaurants',
                    'label' => '👀 חזור לרשימת הרדומות'
                ]
            ]
        ];
    }

    private function mockSmsDraft($topRestaurants, $active, $total): array
    {
        $topName = !empty($topRestaurants) ? $topRestaurants[0][1] : 'מסעדה מובילה';

        $variations = [
            "שלום! {$active} מ-{$total} מסעדות שלנו פעילות השבוע 🔥 הצטרפו למובילים כמו {$topName}! צרו קשר לשדרוג ➡️ 050-xxx",
            "עדכון מערכת: שדרגנו את חווית הניהול! 🚀 כנסו למערכת לראות את הדוחות החדשים. שאלות? אנחנו זמינים.",
            "חג שמח ממערכת ChefSync! 🍷 מאחלים לכל שותפינו שבוע מוצלח ומלא הזמנות."
        ];

        $content = $variations[array_rand($variations)];

        return [
            'content' => "📱 **טיוטת SMS כללית:**\n\n" .
                "\"{$content}\"\n\n" .
                "**אורך:** " . mb_strlen($content) . " תווים ✅\n\n" .
                "⚠️ **טיוטה - יש לבדוק ולהתאים לפני שליחה!**",
            'actions' => [
                [
                    'type' => 'regenerate',
                    'label' => '🔄 נסח מחדש'
                ],
                [
                    'type' => 'preset',
                    'value' => 'dormant_restaurants',
                    'label' => '👀 ראה מסעדות רדומות'
                ]
            ]
        ];
    }

    /**
     * Build smart description based on item characteristics
     */
    private function buildSmartDescription(string $name, float $price, string $category, bool $isVegan, bool $isVegetarian): string
    {
        $name = trim($name);
        $lowerName = mb_strtolower($name);

        // Price-based adjectives
        $priceLevel = $price > 50 ? 'premium' : ($price > 30 ? 'mid' : 'budget');

        // Category-specific templates
        $templates = [];

        // Pizza templates
        if (str_contains($lowerName, 'פיצ') || str_contains($category, 'פיצ')) {
            $templates = [
                "{$name} - פיצה איטלקית אותנטית עם רוטב עגבניות עשיר, גבינת מוצרלה איכותית ובסיס פריך ואוורירי. מוכנה בתנור אבן בחום גבוה לפריכות מושלמת.",
                "{$name} על בסיס בצק בשיטה איטלקית מסורתית, עם תוספות טריות ושכבה נדיבה של גבינה נמסה. חוויה אמיתית של פיצה כמו באיטליה!",
                "{$name} פיצה ייחודית שלנו - בצק דק ופריך, עם תוספות נבחרות בקפידה. כל ביס הוא שילוב מושלם של טעמים.",
            ];
        }
        // Burger templates
        elseif (str_contains($lowerName, 'המבורגר') || str_contains($lowerName, 'בורגר')) {
            $templates = [
                "{$name} עם בשר טרי ואיכותי, מתובל בתבלינים סודיים שלנו. מוגש בלחמנייה רכה ותוספות פריכות וטריות. המבורגר שתמיד חלמתם עליו!",
                "{$name} - המבורגר עסיסי בגריל עם טופינגים משובחים. כל ביס מתפוצץ בטעמים!",
                "{$name} המבורגר מהשורה הראשונה, מוכן לפי ההזמנה עם תוספות איכותיות. חובה לכל חובבי המבורגרים!",
            ];
        }
        // Salad templates
        elseif (str_contains($lowerName, 'סלט')) {
            $templates = [
                "{$name} סלט טרי ועסיסי עם ירקות עונתיים נבחרים, רוטב ביתי מיוחד ותוספות פריכות. ארוחה קלה ומזינה!",
                "{$name} שילוב מרענן של ירקות טריים, ירוקים מרעננים ורוטב עשיר בטעם. בריא וטעים!",
                "{$name} סלט עשיר בויטמינים וטעם, עם מרכיבים טריים מהשוק. מושלם לארוחת צהריים קלה.",
            ];
        }
        // Pasta templates
        elseif (str_contains($lowerName, 'פסטה') || str_contains($lowerName, 'ספגטי')) {
            $templates = [
                "{$name} פסטה איטלקית מעולה, מבושלת אל דנטה עם רוטב עשיר וארומטי. מנה מספקת ומפנקת!",
                "{$name} פסטה טרייה עם רוטב ביתי סמיך וטעים. כל המרכיבים מתמזגים לחוויה קולינרית מושלמת.",
                "{$name} פסטה איכותית בסיר, עם שילוב מושלם של טעמים איטלקיים אותנטיים.",
            ];
        }
        // Drinks
        elseif (str_contains($category, 'שתי') || str_contains($lowerName, 'קולה') || str_contains($lowerName, 'בירה') || str_contains($lowerName, 'יין')) {
            $templates = [
                "{$name} - משקה מרענן ומושלם לליווי הארוחה שלכם.",
                "{$name} קר וטעים, המשקה האידיאלי להנאה מקסימלית.",
                "{$name} להרוות את הצמא ולהשלים את החוויה הקולינרית.",
            ];
        }
        // Appetizers
        elseif (str_contains($category, 'מנות ראשונ') || str_contains($lowerName, 'פוקאצ') || str_contains($lowerName, 'ברוסק')) {
            $templates = [
                "{$name} - מנה ראשונה מושלמת לפתיחת הארוחה. טרייה, ארומטית ומעוררת תיאבון!",
                "{$name} להתחלה מושלמת, עם טעמים עשירים שמכינים את החיך למנה העיקרית.",
                "{$name} מנת פתיחה קלאסית, מוכנה בקפידה מרכיבים טריים ואיכותיים.",
            ];
        }
        // Desserts
        elseif (str_contains($lowerName, 'עוגה') || str_contains($lowerName, 'קינוח') || str_contains($lowerName, 'טירמיסו')) {
            $templates = [
                "{$name} - קינוח מפנק וממכר שמסיים את הארוחה בסטייל. מתוק במידה ומפנק לחלוטין!",
                "{$name} קינוח ביתי עשיר וטעים, נקודת השיא של כל ארוחה.",
                "{$name} הקינוח המושלם לסיום מתוק ומספק. לא תרצו לפספס!",
            ];
        }
        // Generic templates
        else {
            $templates = [
                "{$name} מנה מיוחדת שלנו, מוכנת בקפידה ממרכיבים טריים ואיכותיים. טעם עשיר וחוויה קולינרית בלתי נשכחת!",
                "{$name} טרייה ומוכנה לפי ההזמנה עם תשומת לב לכל פרט. המנה שתמיד חוזרים אליה!",
                "{$name} עם שילוב מושלם של טעמים וטקסטורות. אחת המנות האהובות על הלקוחות שלנו!",
            ];
        }

        // Add vegan/vegetarian note
        $description = $templates[array_rand($templates)];
        if ($isVegan) {
            $description .= " 🌱 טבעוני 100%.";
        } elseif ($isVegetarian) {
            $description .= " 🥗 צמחוני.";
        }

        // Add premium note for expensive items
        if ($priceLevel === 'premium') {
            $description = str_replace('!', ' - ברמה פרימיום!', $description);
        }

        return $description;
    }

    /**
     * Generate mock insights for dashboard
     */
    private function generateMockInsights(string $prompt): string
    {
        // Extract data from prompt
        preg_match('/הזמנות השבוע: (\d+)/', $prompt, $ordersThisWeek);
        preg_match('/הזמנות שבוע שעבר: (\d+)/', $prompt, $ordersLastWeek);
        preg_match('/שינוי: ([+-]?\d+(?:\.\d+)?)%/', $prompt, $growth);

        $thisWeek = isset($ordersThisWeek[1]) ? (int)$ordersThisWeek[1] : 0;
        $lastWeek = isset($ordersLastWeek[1]) ? (int)$ordersLastWeek[1] : 0;
        $growthPct = isset($growth[1]) ? (float)$growth[1] : 0;

        // Extract popular items
        preg_match_all('/- (.+?): (\d+) הזמנות/', $prompt, $popularMatches);
        $topItem = $popularMatches[1][0] ?? 'פיצה מרגריטה';

        // Extract peak hours
        preg_match_all('/- שעה (\d+):00: (\d+) הזמנות/', $prompt, $hourMatches);
        $peakHour = $hourMatches[1][0] ?? '12';

        // Build insights JSON
        $insights = [
            'sales_trend' => $this->generateTrendInsight($growthPct, $thisWeek),
            'top_performers' => "המנה המובילה שלכם היא {$topItem} ⭐ - הלקוחות פשוט אוהבים אותה! שקלו להציע גרסאות נוספות או קומבו מיוחד.",
            'peak_times' => "שעות השיא שלכם הן בסביבות {$peakHour}:00 ⏰ - וודאו שיש לכם מספיק צוות במטבח ובמשלוחים בזמנים אלו. שקלו גם מבצעים בשעות השקטות.",
            'recommendations' => $this->generateRecommendations($growthPct, $thisWeek, $topItem),
            'alert' => $growthPct < -20 ? "⚠️ ירידה משמעותית בהזמנות - מומלץ לבדוק תלונות לקוחות ולהפעיל מבצעים" : null,
        ];

        return json_encode($insights, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    }

    /**
     * Generate trend insight based on growth
     */
    private function generateTrendInsight(float $growth, int $orders): string
    {
        if ($growth > 20) {
            return "מגמה מצוינת! 🚀 המכירות שלכם עלו ב-{$growth}% השבוע - ממשיכים בתנופה הזאת!";
        } elseif ($growth > 10) {
            return "מגמה חיובית! 📈 המכירות עלו ב-{$growth}% השבוע. כיוון טוב!";
        } elseif ($growth > 0) {
            return "צמיחה קלה של {$growth}% השבוע 📊 - לא רע! אפשר לשפר עם מבצעים.";
        } elseif ($growth > -10) {
            return "ירידה קלה של " . abs($growth) . "% השבוע 📉 - שקלו מבצעי סוף שבוע להגברת המכירות.";
        } else {
            return "⚠️ ירידה של " . abs($growth) . "% בהזמנות - מומלץ לבדוק משוב לקוחות ולהפעיל קמפיין שיווקי.";
        }
    }

    /**
     * Generate recommendations based on data
     */
    private function generateRecommendations(float $growth, int $orders, string $topItem): array
    {
        $recommendations = [];

        if ($growth < 0) {
            $recommendations[] = "הפעילו מבצע 'המבורגר + משקה' במחיר מיוחד למשיכת לקוחות";
            $recommendations[] = "שלחו SMS ללקוחות קיימים עם קופון הנחה 15%";
            $recommendations[] = "עדכנו תמונות במערכת - תמונות מושכות מגדילות הזמנות ב-30%";
        } elseif ($growth > 15) {
            $recommendations[] = "הביקוש גבוה! שקלו להעלות קצת את המחירים או להציע קומבו פרימיום";
            $recommendations[] = "הוסיפו מנות עונתיות חדשות כדי לשמר את העניין";
            $recommendations[] = "בדקו אם יש צורך בצוות נוסף לשעות השיא";
        } else {
            $recommendations[] = "המנה '{$topItem}' פופולרית - הציעו לה תוספות אופציונליות (תוספת תשלום)";
            $recommendations[] = "שקלו תפריט ארוחת צהריים מהירה (ביזנס לאנץ') למשיכת קהל עובדים";
            $recommendations[] = "הפעילו תוכנית נאמנות - 'קנה 5 קבל אחת חינם' משפרת שימור לקוחות";
        }

        return $recommendations;
    }

    /**
     * Validate tenant has access (credits + rate limit)
     */
    private function validateAccess(string $feature): void
    {
        // Bypass 1: Dev Mode (local/staging only)
        if (config('app.dev_mode')) {
            Log::info('Dev Mode: Bypassing AI credit validation', [
                'tenant_id' => $this->tenantId,
                'feature' => $feature,
                'user_id' => $this->user?->id,
            ]);

            // Log for audit trail
            $this->logUsage(
                $feature,
                'validate',
                0, // No credits used
                0,
                false,
                null,
                'success',
                null,
                null,
                ['bypass_reason' => 'dev_mode', 'status_detail' => 'bypassed']
            );

            return;
        }

        // Bypass 2: Super Admin with unlimited AI flag
        if ($this->user && $this->user->ai_unlimited) {
            Log::info('Unlimited AI: Bypassing credit validation for user', [
                'user_id' => $this->user->id,
                'tenant_id' => $this->tenantId,
                'feature' => $feature,
            ]);

            // Log for audit trail
            $this->logUsage(
                $feature,
                'validate',
                0,
                0,
                false,
                null,
                'success',
                null,
                null,
                ['bypass_reason' => 'ai_unlimited', 'user_id' => $this->user->id, 'status_detail' => 'bypassed']
            );

            return;
        }

        // Check if feature is enabled
        if (!config("copilot.features.{$feature}.enabled", false)) {
            throw new \Exception("פיצ'ר {$feature} אינו זמין כרגע");
        }

        // Normal validation flow
        $credits = AiCredit::getOrCreateForRestaurant($this->restaurant);

        // Check if billing cycle needs reset
        $credits->checkAndResetIfNeeded();

        // Check credits
        $costCredits = config("copilot.features.{$feature}.cost_credits", 1);
        if (!$credits->hasCredits($costCredits)) {
            throw new \Exception("אין מספיק קרדיטים. נותרו {$credits->credits_remaining} קרדיטים החודש.");
        }

        // Check rate limit
        if (!$credits->isWithinRateLimit()) {
            throw new \Exception('חרגת ממגבלת השימוש לדקה. נסה שוב בעוד רגע.');
        }
    }

    /**
     * Generate cache key
     */
    private function getCacheKey(string $feature, array $data): string
    {
        $dataHash = md5(json_encode($data));
        return config('copilot.cache.prefix') . "tenant:{$this->tenantId}:{$feature}:{$dataHash}:v1";
    }

    /**
     * Log AI usage
     */
    private function logUsage(
        string $feature,
        string $action,
        int $creditsUsed,
        int $responseTimeMs,
        bool $cached,
        ?string $cacheKey,
        string $status,
        ?string $prompt = null,
        ?string $response = null,
        ?array $metadata = null,
        ?string $errorMessage = null
    ): void {
        // Only store prompt/response if detailed logging is enabled
        $detailedLogging = config('copilot.logging.detailed', false);

        AiUsageLog::create([
            'tenant_id' => $this->tenantId,
            'restaurant_id' => $this->restaurant->id,
            'user_id' => $this->user?->id,
            'feature' => $feature,
            'action' => $action,
            'credits_used' => $creditsUsed,
            'response_time_ms' => $responseTimeMs,
            'cached' => $cached,
            'cache_key' => $cacheKey,
            'prompt' => $detailedLogging ? $prompt : null,
            'response' => $detailedLogging ? $response : null,
            'metadata' => $metadata,
            'status' => $status,
            'error_message' => $errorMessage,
        ]);

        // Also log to Laravel log
        if (config('copilot.logging.enabled')) {
            Log::channel(config('copilot.logging.channel', 'daily'))->info('AI Usage', [
                'tenant_id' => $this->tenantId,
                'feature' => $feature,
                'status' => $status,
                'cached' => $cached,
                'response_time_ms' => $responseTimeMs,
            ]);
        }
    }

    /**
     * Get current credits status for a restaurant
     */
    public static function getCreditsStatus(Restaurant $restaurant): array
    {
        $credits = AiCredit::getOrCreateForRestaurant($restaurant);
        $credits->checkAndResetIfNeeded();

        return [
            'tier' => $credits->tier,
            'monthly_limit' => $credits->monthly_limit,
            'credits_used' => $credits->credits_used,
            'credits_remaining' => $credits->credits_remaining,
            'billing_cycle_start' => $credits->billing_cycle_start->format('Y-m-d'),
            'billing_cycle_end' => $credits->billing_cycle_end->format('Y-m-d'),
            'total_requests' => $credits->total_requests,
        ];
    }

    /**
     * Get usage statistics for a restaurant
     */
    public static function getUsageStats(Restaurant $restaurant, ?Carbon $startDate = null, ?Carbon $endDate = null): array
    {
        $startDate = $startDate ?? now()->startOfMonth();
        $endDate = $endDate ?? now()->endOfMonth();

        $logs = AiUsageLog::where('restaurant_id', $restaurant->id)
            ->whereBetween('created_at', [$startDate, $endDate])
            ->get();

        return [
            'total_requests' => $logs->count(),
            'successful_requests' => $logs->where('status', 'success')->count(),
            'failed_requests' => $logs->where('status', 'error')->count(),
            'cached_requests' => $logs->where('cached', true)->count(),
            'cache_hit_rate' => $logs->count() > 0
                ? round($logs->where('cached', true)->count() / $logs->count() * 100, 1)
                : 0,
            'total_credits_used' => $logs->sum('credits_used'),
            'avg_response_time_ms' => $logs->avg('response_time_ms'),
            'by_feature' => $logs->groupBy('feature')->map(function ($items, $feature) {
                return [
                    'count' => $items->count(),
                    'success_rate' => $items->count() > 0
                        ? round($items->where('status', 'success')->count() / $items->count() * 100, 1)
                        : 0,
                ];
            }),
        ];
    }

    /**
     * Generate AI-powered dashboard insights
     * 
     * Analyzes restaurant data and generates business intelligence
     */
    public function generateDashboardInsights(): array
    {
        // ✅ Increase PHP execution time for this operation
        set_time_limit(120);

        $feature = 'dashboard_insights';

        // Temporarily enable this feature (update config later)
        $creditsRequired = 5; // More complex than simple descriptions

        // Check credits and rate limit
        $this->validateAccess($feature);

        try {
            // Gather data for analysis
            $analysisData = $this->gatherDashboardData();

            // Build Hebrew prompt for Copilot
            $prompt = $this->buildInsightsPrompt($analysisData);

            // Call Copilot API
            $response = $this->callCopilot($prompt, [
                'max_tokens' => 1000,
                'temperature' => 0.7,
            ]);

            // Parse insights from response
            $insights = $this->parseInsights($response, $analysisData);

            // Log usage
            $this->logUsage(
                $feature,
                'generate',
                $creditsRequired,
                $response['response_time_ms'] ?? 0,
                false, // not cached
                null,  // cache key
                'success',
                $prompt,
                json_encode($insights)
            );

            // Deduct credits
            $credits = AiCredit::getOrCreateForRestaurant($this->restaurant);
            $credits->useCredits($creditsRequired);

            return $insights;
        } catch (\Exception $e) {
            $this->logUsage(
                $feature,
                'generate',
                0, // No credits charged on error
                0, // response time
                false, // not cached
                null, // cache key
                'error',
                null, // prompt
                null, // response
                null, // metadata
                $e->getMessage()
            );

            throw $e;
        }
    }

    /**
     * Recommend optimal price for menu item based on market analysis
     */
    public function recommendPrice(array $itemData): array
    {
        // ✅ Increase PHP execution time for this operation
        set_time_limit(120);

        $feature = 'price_recommendations';
        $creditsRequired = 3; // Moderate complexity

        // Check credits and rate limit
        $this->validateAccess($feature);

        try {
            // Gather pricing data from similar items
            $marketData = $this->gatherPricingData($itemData);

            // Build Hebrew prompt for Copilot
            $prompt = $this->buildPricingPrompt($itemData, $marketData);

            // Call Copilot API
            $response = $this->callCopilot($prompt, [
                'max_tokens' => 500,
                'temperature' => 0.5, // More deterministic for pricing
            ]);

            // Parse recommendation from response
            $recommendation = $this->parsePricingRecommendation($response, $marketData);

            // Log usage
            $this->logUsage(
                $feature,
                'generate',
                $creditsRequired,
                $response['response_time_ms'] ?? 0,
                false,
                null,
                'success',
                $prompt,
                json_encode($recommendation)
            );

            // Deduct credits
            $credits = AiCredit::getOrCreateForRestaurant($this->restaurant);
            $credits->useCredits($creditsRequired);

            return $recommendation;
        } catch (\Exception $e) {
            $this->logUsage(
                $feature,
                'generate',
                0,
                0,
                false,
                null,
                'error',
                null,
                null,
                null,
                $e->getMessage()
            );

            throw $e;
        }
    }

    /**
     * Gather dashboard data for analysis
     */
    private function gatherDashboardData(): array
    {
        $restaurantId = $this->restaurant->id;
        $now = now();
        $weekAgo = $now->copy()->subWeek();
        $monthAgo = $now->copy()->subMonth();

        // Orders analysis
        $ordersThisWeek = DB::table('orders')
            ->where('restaurant_id', $restaurantId)
            ->where('created_at', '>=', $weekAgo)
            ->count();

        $ordersLastWeek = DB::table('orders')
            ->where('restaurant_id', $restaurantId)
            ->whereBetween('created_at', [$weekAgo->copy()->subWeek(), $weekAgo])
            ->count();

        $totalRevenueThisWeek = DB::table('orders')
            ->where('restaurant_id', $restaurantId)
            ->where('created_at', '>=', $weekAgo)
            ->whereIn('status', ['ready', 'delivered'])
            ->sum('total_amount');

        // Popular items (top 5)
        $popularItems = DB::table('order_items')
            ->join('orders', 'order_items.order_id', '=', 'orders.id')
            ->join('menu_items', 'order_items.menu_item_id', '=', 'menu_items.id')
            ->where('orders.restaurant_id', $restaurantId)
            ->where('orders.created_at', '>=', $monthAgo)
            ->select('menu_items.name', DB::raw('COUNT(*) as order_count'), DB::raw('SUM(order_items.price_at_order * order_items.quantity) as revenue'))
            ->groupBy('menu_items.id', 'menu_items.name')
            ->orderByDesc('order_count')
            ->limit(5)
            ->get();

        // Peak hours (hourly aggregation)
        $peakHours = DB::table('orders')
            ->where('restaurant_id', $restaurantId)
            ->where('created_at', '>=', $weekAgo)
            ->select(DB::raw('HOUR(created_at) as hour'), DB::raw('COUNT(*) as order_count'))
            ->groupBy('hour')
            ->orderByDesc('order_count')
            ->limit(3)
            ->get();

        // Category performance
        $categoryPerformance = DB::table('order_items')
            ->join('orders', 'order_items.order_id', '=', 'orders.id')
            ->join('menu_items', 'order_items.menu_item_id', '=', 'menu_items.id')
            ->join('categories', 'menu_items.category_id', '=', 'categories.id')
            ->where('orders.restaurant_id', $restaurantId)
            ->where('orders.created_at', '>=', $monthAgo)
            ->select('categories.name', DB::raw('COUNT(*) as order_count'), DB::raw('SUM(order_items.price_at_order * order_items.quantity) as revenue'))
            ->groupBy('categories.id', 'categories.name')
            ->orderByDesc('order_count')
            ->get();

        // Average order value
        $avgOrderValue = DB::table('orders')
            ->where('restaurant_id', $restaurantId)
            ->where('created_at', '>=', $weekAgo)
            ->whereIn('status', ['ready', 'delivered'])
            ->avg('total_amount');

        return [
            'orders_this_week' => $ordersThisWeek,
            'orders_last_week' => $ordersLastWeek,
            'orders_growth' => $ordersLastWeek > 0
                ? round((($ordersThisWeek - $ordersLastWeek) / $ordersLastWeek) * 100, 1)
                : 0,
            'total_revenue_this_week' => round($totalRevenueThisWeek, 2),
            'popular_items' => $popularItems,
            'peak_hours' => $peakHours,
            'category_performance' => $categoryPerformance,
            'avg_order_value' => round($avgOrderValue, 2),
        ];
    }

    /**
     * Build Hebrew prompt for insights generation
     */
    private function buildInsightsPrompt(array $data): string
    {
        $glossary = config('copilot.hebrew_glossary', []);
        $glossaryStr = !empty($glossary) ? "\n\nמילון מונחים:\n" . implode(', ', $glossary) : '';

        $popularItemsList = collect($data['popular_items'])
            ->map(fn($item) => "- {$item->name}: {$item->order_count} הזמנות")
            ->join("\n");

        $peakHoursList = collect($data['peak_hours'])
            ->map(fn($hour) => "- שעה {$hour->hour}:00: {$hour->order_count} הזמנות")
            ->join("\n");

        $categoryList = collect($data['category_performance'])
            ->map(fn($cat) => "- {$cat->name}: {$cat->order_count} הזמנות")
            ->join("\n");

        return <<<PROMPT
אתה מומחה לניתוח עסקי של מסעדות. נתח את הנתונים הבאים וספק תובנות מעשיות בעברית.

**נתוני השבוע:**
- הזמנות השבוע: {$data['orders_this_week']}
- הזמנות שבוע שעבר: {$data['orders_last_week']}
- שינוי: {$data['orders_growth']}%
- הכנסות השבוע: ₪{$data['total_revenue_this_week']}
- ממוצע הזמנה: ₪{$data['avg_order_value']}

**פריטים פופולריים:**
{$popularItemsList}

**שעות שיא:**
{$peakHoursList}

**ביצועים לפי קטגוריה:**
{$categoryList}

ספק תובנות בפורמט הבא (JSON):
{
  "sales_trend": "תיאור קצר של מגמת המכירות (חיובית/שלילית)",
  "top_performers": "תיאור 2-3 הפריטים המובילים ומה הופך אותם למוצלחים",
  "peak_times": "המלצה לניהול שעות השיא",
  "recommendations": ["המלצה 1", "המלצה 2", "המלצה 3"],
  "alert": "אזהרה אם יש בעיה דחופה (או null)"
}

השתמש בשפה ידידותית ומקצועית. התמקד בתובנות מעשיות שבעל המסעדה יכול ליישם.{$glossaryStr}
PROMPT;
    }

    /**
     * Parse AI response into structured insights
     */
    private function parseInsights(array $response, array $rawData): array
    {
        $content = $response['content'] ?? '';

        // Try to extract JSON from response
        if (preg_match('/\{[\s\S]*\}/', $content, $matches)) {
            $parsed = json_decode($matches[0], true);

            if ($parsed) {
                return [
                    'insights' => $parsed,
                    'raw_data' => $rawData,
                    'generated_at' => now()->toIso8601String(),
                ];
            }
        }

        // Fallback: structured text response
        return [
            'insights' => [
                'sales_trend' => $this->extractTrend($rawData),
                'top_performers' => $this->extractTopPerformers($rawData),
                'peak_times' => $this->extractPeakTimes($rawData),
                'recommendations' => [$content],
                'alert' => null,
            ],
            'raw_data' => $rawData,
            'generated_at' => now()->toIso8601String(),
        ];
    }

    /**
     * Extract sales trend from data
     */
    private function extractTrend(array $data): string
    {
        $growth = $data['orders_growth'];

        if ($growth > 10) {
            return "מגמה חיובית! המכירות עלו ב-{$growth}% השבוע 🚀";
        } elseif ($growth > 0) {
            return "צמיחה קלה של {$growth}% השבוע 📈";
        } elseif ($growth > -10) {
            return "ירידה קלה של " . abs($growth) . "% השבוע 📉";
        } else {
            return "⚠️ ירידה משמעותית של " . abs($growth) . "% - מומלץ לבדוק";
        }
    }

    /**
     * Extract top performers description
     */
    private function extractTopPerformers(array $data): string
    {
        $items = collect($data['popular_items'])->take(3);

        if ($items->isEmpty()) {
            return "אין מספיק נתונים להצגת פריטים מובילים";
        }

        $names = $items->pluck('name')->join(', ');
        return "הפריטים המובילים: {$names} ⭐";
    }

    /**
     * Extract peak times recommendation
     */
    private function extractPeakTimes(array $data): string
    {
        $hours = collect($data['peak_hours']);

        if ($hours->isEmpty()) {
            return "אין מספיק נתונים לזיהוי שעות שיא";
        }

        $hoursList = $hours->map(fn($h) => "{$h->hour}:00")->join(', ');
        return "שעות השיא שלך: {$hoursList}. וודא שיש מספיק צוות בזמנים אלו ⏰";
    }

    /**
     * Gather pricing data from similar items in the category
     */
    private function gatherPricingData(array $itemData): array
    {
        $restaurantId = $this->restaurant->id;
        $categoryId = $itemData['category_id'] ?? null;
        $itemName = $itemData['name'] ?? '';

        if (!$categoryId) {
            return [
                'similar_items' => [],
                'avg_price' => 0,
                'min_price' => 0,
                'max_price' => 0,
                'item_count' => 0,
            ];
        }

        // Get similar items in the same category
        $similarItems = DB::table('menu_items')
            ->where('restaurant_id', $restaurantId)
            ->where('category_id', $categoryId)
            ->where('is_available', true)
            ->select('id', 'name', 'price')
            ->get();

        if ($similarItems->isEmpty()) {
            return [
                'similar_items' => [],
                'avg_price' => 0,
                'min_price' => 0,
                'max_price' => 0,
                'item_count' => 0,
            ];
        }

        $prices = $similarItems->pluck('price');
        $avgPrice = $prices->avg();
        $minPrice = $prices->min();
        $maxPrice = $prices->max();

        // Get sales data for these items
        $salesData = DB::table('order_items')
            ->join('orders', 'order_items.order_id', '=', 'orders.id')
            ->whereIn('order_items.menu_item_id', $similarItems->pluck('id'))
            ->where('orders.restaurant_id', $restaurantId)
            ->where('orders.created_at', '>=', now()->subMonth())
            ->select(
                'order_items.menu_item_id',
                DB::raw('COUNT(*) as order_count'),
                DB::raw('SUM(order_items.quantity) as total_quantity')
            )
            ->groupBy('order_items.menu_item_id')
            ->get()
            ->keyBy('menu_item_id');

        // Enrich similar items with sales data
        $enrichedItems = $similarItems->map(function ($item) use ($salesData) {
            $sales = $salesData->get($item->id);
            return [
                'id' => $item->id,
                'name' => $item->name,
                'price' => $item->price,
                'order_count' => $sales->order_count ?? 0,
                'total_quantity' => $sales->total_quantity ?? 0,
            ];
        })->sortByDesc('order_count')->values()->all();

        return [
            'similar_items' => $enrichedItems,
            'avg_price' => round($avgPrice, 2),
            'min_price' => round($minPrice, 2),
            'max_price' => round($maxPrice, 2),
            'item_count' => count($similarItems),
        ];
    }

    /**
     * Build Hebrew prompt for price recommendation
     */
    private function buildPricingPrompt(array $itemData, array $marketData): string
    {
        $name = $itemData['name'] ?? '';
        $description = $itemData['description'] ?? '';
        $categoryName = $itemData['category_name'] ?? 'כללי';
        $currentPrice = $itemData['price'] ?? null;

        $prompt = "אתה יועץ תמחור למסעדות. המטרה שלך היא להמליץ על מחיר אופטימלי למנה חדשה או קיימת.\n\n";
        $prompt .= "פרטי המנה:\n";
        $prompt .= "שם: {$name}\n";
        $prompt .= "קטגוריה: {$categoryName}\n";

        if ($description) {
            $prompt .= "תיאור: {$description}\n";
        }

        if ($currentPrice !== null) {
            $prompt .= "מחיר נוכחי: ₪{$currentPrice}\n";
        }

        $prompt .= "\nניתוח שוק:\n";
        $prompt .= "כמות פריטים דומים בקטגוריה: {$marketData['item_count']}\n";

        if ($marketData['item_count'] > 0) {
            $prompt .= "מחיר ממוצע: ₪{$marketData['avg_price']}\n";
            $prompt .= "טווח מחירים: ₪{$marketData['min_price']} - ₪{$marketData['max_price']}\n\n";

            if (!empty($marketData['similar_items'])) {
                $prompt .= "פריטים דומים:\n";
                foreach (array_slice($marketData['similar_items'], 0, 5) as $item) {
                    $orders = $item['order_count'];
                    $prompt .= "- {$item['name']}: ₪{$item['price']} ({$orders} הזמנות)\n";
                }
            }
        } else {
            $prompt .= "אין פריטים דומים להשוואה.\n";
        }

        $prompt .= "\nהחזר את ההמלצה במבנה JSON הבא:\n";
        $prompt .= "{\n";
        $prompt .= '  "recommended_price": 45.00,';
        $prompt .= '  "confidence": "high",';
        $prompt .= '  "reasoning": "נימוק בעברית למחיר המוצע",';
        $prompt .= '  "factors": ["גורם 1", "גורם 2", "גורם 3"]';
        $prompt .= "\n}\n";
        $prompt .= "\nרמות ביטחון אפשריות: high, medium, low";

        return $prompt;
    }

    /**
     * Parse pricing recommendation from AI response
     */
    private function parsePricingRecommendation(array $response, array $marketData): array
    {
        $content = $response['content'] ?? '';

        // Try to extract JSON
        if (preg_match('/\{[\s\S]*\}/', $content, $matches)) {
            $parsed = json_decode($matches[0], true);

            if ($parsed && isset($parsed['recommended_price'])) {
                return [
                    'recommended_price' => round($parsed['recommended_price'], 2),
                    'confidence' => $parsed['confidence'] ?? 'medium',
                    'reasoning' => $parsed['reasoning'] ?? 'מחיר מוצע על בסיס ניתוח שוק',
                    'factors' => $parsed['factors'] ?? [],
                    'market_data' => [
                        'avg_price' => $marketData['avg_price'],
                        'min_price' => $marketData['min_price'],
                        'max_price' => $marketData['max_price'],
                        'similar_count' => $marketData['item_count'],
                    ],
                    'generated_at' => now()->toIso8601String(),
                ];
            }
        }

        // Fallback: use average price or simple calculation
        $recommendedPrice = $marketData['avg_price'];

        if ($recommendedPrice == 0) {
            // No market data, suggest a default
            $recommendedPrice = 35.00;
        }

        return [
            'recommended_price' => round($recommendedPrice, 2),
            'confidence' => 'low',
            'reasoning' => $marketData['item_count'] > 0
                ? "המחיר מבוסס על ממוצע של {$marketData['item_count']} פריטים דומים בקטגוריה"
                : "לא נמצאו פריטים דומים, המחיר המוצע הוא אומדן ראשוני",
            'factors' => [
                'ניתוח מחירי השוק',
                'פריטים דומים בקטגוריה',
                'ממוצע מחירי המסעדה',
            ],
            'market_data' => [
                'avg_price' => $marketData['avg_price'],
                'min_price' => $marketData['min_price'],
                'max_price' => $marketData['max_price'],
                'similar_count' => $marketData['item_count'],
            ],
            'generated_at' => now()->toIso8601String(),
        ];
    }

    /**
     * צ'אט אינטראקטיבי עם סופר אדמין
     * מטפל ב-presets מיוחדים + צ'אט חופשי
     */
    public function chatWithSuperAdmin(string $message, array $context, ?string $preset = null): array
    {
        set_time_limit(120);
        $systemPrompt = $this->buildSuperAdminSystemPrompt($context, $preset);
        $userPrompt = $message;

        $fullPrompt = $systemPrompt . "\n\n" . $userPrompt;

        // קריאה ל-Copilot (mock בשלב זה)
        $response = $this->callCopilot($fullPrompt);

        // הוספת actions רלוונטיים לפי preset
        $actions = $this->getSuggestedActions($preset, $context);

        return [
            'content' => $response['content'],
            'tokens' => $response['tokens'] ?? 0,
            'model' => $response['model'] ?? 'gpt-4o',
            'actions' => $actions,
        ];
    }

    /**
     * בניית System Prompt לסופר אדמין
     */
    private function buildSuperAdminSystemPrompt(array $context, ?string $preset): string
    {
        $systemPrompt = "אתה עוזר AI חכם לניהול מערכת ChefSync - פלטפורמת הזמנות למסעדות.\n\n";
        $systemPrompt .= "תפקידך: לספק תובנות עסקיות, זיהוי מגמות, והמלצות פעולה לסופר אדמין.\n\n";

        // הוסף סיכום המערכת
        $systemPrompt .= "=== מצב המערכת הנוכחי ===\n";
        $systemPrompt .= "מסעדות רשומות: " . ($context['summary']['total_restaurants'] ?? 0) . "\n";
        $systemPrompt .= "מסעדות פעילות (30 ימים): " . ($context['summary']['active_restaurants_30d'] ?? 0) . "\n";
        $systemPrompt .= "מסעדות מאושרות: " . ($context['summary']['approved_restaurants'] ?? 0) . "\n\n";

        $systemPrompt .= "הזמנות היום: " . ($context['orders']['today'] ?? 0) . "\n";
        $systemPrompt .= "הזמנות השבוע: " . ($context['orders']['this_week'] ?? 0) . "\n";
        $systemPrompt .= "הזמנות החודש: " . ($context['orders']['this_month'] ?? 0) . "\n\n";

        $systemPrompt .= "הכנסות היום: ₪" . number_format($context['revenue']['today'] ?? 0, 2) . "\n";
        $systemPrompt .= "הכנסות השבוע: ₪" . number_format($context['revenue']['this_week'] ?? 0, 2) . "\n";
        $systemPrompt .= "הכנסות החודש: ₪" . number_format($context['revenue']['this_month'] ?? 0, 2) . "\n\n";

        return $systemPrompt;
    }

    /**
     * שיחה עם עוזר AI למנהל מסעדה - נתונים ספציפיים למסעדה בלבד
     */
    public function chatWithRestaurant(string $message, array $context, ?string $preset = null): string
    {
        set_time_limit(120);
        $systemPrompt = $this->buildRestaurantSystemPrompt($context);
        $userMessage = $preset ? $this->expandRestaurantPreset($preset, $context) : $message;

        $response = $this->callCopilot($systemPrompt . "\n\n" . $userMessage);

        // callCopilot מחזיר array עם 'content'
        return $response['content'] ?? 'שגיאה בקבלת תשובה מהסוכן';
    }

    /**
     * בניית system prompt למנהל מסעדה
     */
    private function buildRestaurantSystemPrompt(array $context): string
    {
        $restaurant = $context['restaurant'] ?? [];
        $systemPrompt = "אתה עוזר AI חכם למסעדה '{$restaurant['name']}' במערכת ChefSync.\n\n";
        $systemPrompt .= "תפקידך: לספק תובנות עסקיות, המלצות תפריט, וניתוח ביצועים **רק עבור מסעדה זו**.\n\n";
        $systemPrompt .= "⚠️ חשוב: אל תתייחס לנתונים של מסעדות אחרות - רק למסעדה הזו!\n\n";

        // מידע על המסעדה
        $systemPrompt .= "=== מידע על המסעדה ===\n";
        $systemPrompt .= "שם: {$restaurant['name']}\n";
        $systemPrompt .= "מנוי: " . ($restaurant['subscription_tier'] === 'pro' ? 'Pro 🌟' : 'Free') . "\n";
        $systemPrompt .= "סטטוס: " . ($restaurant['is_approved'] ? 'מאושרת ✅' : 'ממתינה לאישור ⏳') . "\n";
        $systemPrompt .= "פריטי תפריט: {$restaurant['total_menu_items']}\n\n";

        // נתוני הזמנות
        $systemPrompt .= "=== הזמנות ===\n";
        $systemPrompt .= "היום: " . ($context['orders']['today'] ?? 0) . "\n";
        $systemPrompt .= "השבוע: " . ($context['orders']['this_week'] ?? 0) . "\n";
        $systemPrompt .= "החודש: " . ($context['orders']['this_month'] ?? 0) . "\n\n";

        // נתוני הכנסות
        $systemPrompt .= "=== הכנסות ===\n";
        $systemPrompt .= "היום: ₪" . number_format($context['revenue']['today'] ?? 0, 2) . "\n";
        $systemPrompt .= "השבוע: ₪" . number_format($context['revenue']['this_week'] ?? 0, 2) . "\n";
        $systemPrompt .= "החודש: ₪" . number_format($context['revenue']['this_month'] ?? 0, 2) . "\n\n";

        // פריטים פופולריים
        if (!empty($context['top_items'])) {
            $systemPrompt .= "=== פריטי תפריט פופולריים (30 ימים) ===\n";
            foreach ($context['top_items'] as $item) {
                $systemPrompt .= "- {$item['name']}: {$item['orders']} הזמנות\n";
            }
            $systemPrompt .= "\n";
        }

        $systemPrompt .= "השב בעברית, בצורה ברורה ומעשית עם המלצות ספציפיות למסעדה זו.";

        return $systemPrompt;
    }

    /**
     * הרחבת presets למנהל מסעדה
     */
    private function expandRestaurantPreset(string $preset, array $context): string
    {
        $presets = [
            'order_summary' => "תן לי סיכום של הביצועים שלי היום/שבוע/חודש. מה הולך טוב? איפה אפשר להשתפר?",
            'menu_suggestions' => "לפי הפריטים הפופולריים שלי, מה אתה ממליץ להוסיף/להסיר/לקדם בתפריט?",
            'performance_insights' => "נתח את הביצועים העסקיים שלי ותן לי 3 המלצות קונקרטיות לשיפור.",
            'customer_engagement' => "איך אני יכול למשוך יותר לקוחות ולהגדיל את ההזמנות?"
        ];

        return $presets[$preset] ?? $preset;
    }

    /**
     * הצעות פעולה למנהל מסעדה
     */
    public function getRestaurantSuggestedActions(array $context, ?string $preset = null): array
    {
        $actions = [];

        // המלצות לפי preset
        if ($preset === 'menu_suggestions') {
            $actions[] = ['label' => '📋 עריכת תפריט', 'route' => '/admin/menu'];
            $actions[] = ['label' => '📊 ניהול קטגוריות', 'route' => '/admin/categories'];
        } elseif ($preset === 'order_summary') {
            $actions[] = ['label' => '📦 הזמנות פעילות', 'route' => '/admin/orders'];
            $actions[] = ['label' => '📈 דוחות', 'route' => '/admin/reports'];
        } elseif ($preset === 'performance_insights') {
            $actions[] = ['label' => '📊 דשבורד', 'route' => '/admin/dashboard'];
            $actions[] = ['label' => '📈 דוחות', 'route' => '/admin/reports'];
        } elseif ($preset === 'customer_engagement') {
            $actions[] = ['label' => '🎫 קופונים', 'route' => '/admin/coupons'];
            $actions[] = ['label' => '📱 QR Code', 'route' => '/admin/qr-code'];
        }

        // המלצות כלליות (רק אם אין preset או אם יש פחות מ-2 פעולות)
        if (count($actions) < 2) {
            if (($context['orders']['today'] ?? 0) === 0) {
                $actions[] = ['label' => '🎫 צור קופון', 'route' => '/admin/coupons'];
            }
            if (($context['restaurant']['subscription_tier'] ?? 'free') === 'free') {
                $actions[] = ['label' => '⭐ שדרוג ל-Pro', 'route' => '/admin/payment'];
            }
        }

        return array_slice($actions, 0, 3); // מקסימום 3 פעולות
    }

    /**
     * הנחיות ספציפיות לכל preset
     */
    private function getPresetInstructions(?string $preset): string
    {
        if (!$preset) {
            return "";
        }

        switch ($preset) {
            case 'daily_insights':
                return "=== משימה: תובנות יומיות ===\n" .
                    "נתח את הנתונים והצג:\n" .
                    "1. ביצועי היום לעומת ממוצע\n" .
                    "2. מגמות בולטות (חיוביות/שליליות)\n" .
                    "3. המלצה אחת לשיפור\n\n";

            case 'dormant_restaurants':
                return "=== משימה: מסעדות רדומות ===\n" .
                    "נתח את המסעדות ללא הזמנות ב-7 ימים האחרונים:\n" .
                    "1. כמה מסעדות במצב זה?\n" .
                    "2. מה הסיכון העסקי?\n" .
                    "3. הצע 2-3 פעולות ליצירת קשר/השבה\n\n";

            case 'pilot_candidates':
                return "=== משימה: מועמדים לפיילוט ===\n" .
                    "זהה מסעדות עם ביצועים טובים שמתאימות לשדרוג:\n" .
                    "1. מי המועמדים המובילים?\n" .
                    "2. מה ההזדמנות העסקית?\n" .
                    "3. הצע אסטרטגיית גישה (incentive, trial, etc)\n\n";

            case 'sms_draft':
                return "=== משימה: טיוטת הודעת SMS ===\n" .
                    "כתוב טיוטת הודעה למסעדנים (max 150 תווים):\n" .
                    "1. זהה insight מרכזי מהנתונים\n" .
                    "2. כתוב הודעה קצרה, ידידותית, ממוקדת בערך\n" .
                    "3. הוסף call-to-action ברור\n" .
                    "4. ציין בסוף: 'טיוטה - יש לבדוק לפני שליחה'\n\n";

            default:
                return "";
        }
    }

    /**
     * הצעת כפתורי פעולה רלוונטיים
     */
    private function getSuggestedActions(?string $preset, array $context): array
    {
        if (!$preset) {
            return [];
        }

        $actions = [];

        switch ($preset) {
            case 'daily_insights':
                $actions[] = [
                    'label' => '📊 דוח מפורט',
                    'type' => 'link',
                    'value' => '/super-admin/reports',
                ];
                break;

            case 'dormant_restaurants':
                $dormantCount = count($context['dormant_restaurants'] ?? []);
                if ($dormantCount > 0) {
                    $actions[] = [
                        'label' => "💌 הכן הודעת תזכורת ל-{$dormantCount} מסעדות",
                        'type' => 'preset',
                        'value' => 'sms_draft',
                    ];
                }
                break;

            case 'pilot_candidates':
                $candidatesCount = count($context['pilot_candidates'] ?? []);
                if ($candidatesCount > 0) {
                    $actions[] = [
                        'label' => "✨ הכן הצעת שדרוג ל-{$candidatesCount} מועמדים",
                        'type' => 'preset',
                        'value' => 'sms_draft',
                    ];
                }
                break;

            case 'sms_draft':
                $actions[] = [
                    'label' => '📝 ערוך טיוטה',
                    'type' => 'edit',
                    'value' => 'edit_draft',
                ];
                $actions[] = [
                    'label' => '🔄 נסח מחדש',
                    'type' => 'regenerate',
                    'value' => 'regenerate',
                ];
                break;
        }

        return $actions;
    }
}

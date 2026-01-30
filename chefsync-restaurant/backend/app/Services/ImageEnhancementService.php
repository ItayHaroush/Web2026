<?php

namespace App\Services;

use App\Models\AiImageEnhancement;
use App\Models\Restaurant;
use App\Models\MenuItem;
use App\Models\AiCredit;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Intervention\Image\Facades\Image;

/**
 * שירות לשיפור תמונות מזון באמצעות AI
 * זרימה: העלאה → בחירת אופציות → יצירת וריאציות → בחירה → שמירה
 */
class ImageEnhancementService
{
    private Restaurant $restaurant;
    private ?MenuItem $menuItem;

    public function __construct(Restaurant $restaurant, ?MenuItem $menuItem = null)
    {
        $this->restaurant = $restaurant;
        $this->menuItem = $menuItem;
    }

    /**
     * יצירת שיפור תמונה חדש
     * 
     * @param UploadedFile $image התמונה המקורית
     * @param array $options אופציות [category, subType, serving, level, background]
     * @return AiImageEnhancement
     * @throws \Exception
     */
    public function enhance(UploadedFile $image, array $options = []): AiImageEnhancement
    {
        // ולידציה
        $this->validateImage($image);

        // בדיקת קרדיטים
        $credits = AiCredit::getOrCreateForRestaurant($this->restaurant);
        $cost = config('ai.image_enhancement.cost_credits', 3);

        if (!$credits->hasCredits($cost)) {
            throw new \Exception('אין מספיק קרדיטי AI. נותרו: ' . $credits->credits_remaining);
        }

        try {
            // שמירת המקור
            $originalPath = $this->saveOriginal($image);

            // יצירת רשומה
            $enhancement = AiImageEnhancement::create([
                'restaurant_id' => $this->restaurant->id,
                'menu_item_id' => $this->menuItem?->id,
                'original_path' => $originalPath,
                'background' => $options['background'] ?? 'white',
                'angle' => $options['angle'] ?? 'side',
                'status' => 'processing',
                'ai_provider' => 'stability',
                'cost_credits' => $cost,
            ]);

            // בניית Prompt לפי חוקים
            $promptData = $this->buildPrompt($options);

            // קריאה ל-AI (img2img enhancement)
            $variations = $this->generateVariations($originalPath, $promptData);

            // שמירת וריאציות
            $enhancement->update([
                'variations' => $variations,
                'status' => 'ready',
            ]);

            // ניכוי קרדיטים (רק בהצלחה)
            $credits->useCredits($cost);

            Log::info('Image Enhancement Success', [
                'enhancement_id' => $enhancement->id,
                'restaurant_id' => $this->restaurant->id,
                'variations_count' => count($variations),
            ]);

            return $enhancement->fresh();
        } catch (\Exception $e) {
            // עדכון כשלון
            if (isset($enhancement)) {
                $enhancement->update([
                    'status' => 'failed',
                    'error_message' => $e->getMessage(),
                ]);
            }

            Log::error('Image Enhancement Failed', [
                'restaurant_id' => $this->restaurant->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            throw $e;
        }
    }

    /**
     * בחירת וריאציה סופית
     * 
     * @param AiImageEnhancement $enhancement
     * @param int $selectedIndex אינדקס הווריאציה הנבחרת (0-2)
     * @return string Path של התמונה הנבחרת
     */
    public function selectVariation(AiImageEnhancement $enhancement, int $selectedIndex): string
    {
        if (!$enhancement->variations || count($enhancement->variations) === 0) {
            throw new \Exception('אין וריאציות זמינות');
        }

        if ($selectedIndex < 0 || $selectedIndex >= count($enhancement->variations)) {
            throw new \Exception('אינדקס לא תקין');
        }

        // Support both old format (string) and new format (object with 'path')
        $variationData = $enhancement->variations[$selectedIndex];
        $selectedPath = is_array($variationData) && isset($variationData['path'])
            ? $variationData['path']
            : $variationData;

        // עדכון הרשומה
        $enhancement->update([
            'selected_path' => $selectedPath,
            'selected_index' => $selectedIndex,
        ]);

        // מחיקת וריאציות שלא נבחרו
        $this->cleanupVariations($enhancement, $selectedIndex);

        // עדכון המנה (אם משויכת)
        if ($this->menuItem) {
            // ✅ שמירה עם /storage/ prefix כדי ש-resolveAssetUrl() ב-frontend יעבוד
            $this->menuItem->update([
                'image_url' => "/storage/{$selectedPath}",
            ]);
        }

        Log::info('Variation Selected', [
            'enhancement_id' => $enhancement->id,
            'selected_index' => $selectedIndex,
            'menu_item_id' => $this->menuItem?->id,
        ]);

        return $selectedPath;
    }

    /**
     * ולידציה של התמונה
     */
    private function validateImage(UploadedFile $image): void
    {
        $maxSize = config('ai.image_enhancement.max_file_size', 5120); // KB
        $allowedFormats = config('ai.image_enhancement.allowed_formats', ['jpg', 'jpeg', 'png', 'webp']);

        if ($image->getSize() > $maxSize * 1024) {
            throw new \Exception("גודל התמונה חורג מ-{$maxSize}KB");
        }

        $extension = strtolower($image->getClientOriginalExtension());
        if (!in_array($extension, $allowedFormats)) {
            throw new \Exception('פורמט תמונה לא נתמך. השתמש ב-JPG, PNG או WEBP');
        }
    }

    /**
     * שמירת התמונה המקורית
     */
    private function saveOriginal(UploadedFile $image): string
    {
        $filename = 'original_' . time() . '_' . uniqid() . '.' . $image->getClientOriginalExtension();
        $path = $image->storeAs('ai-images/originals', $filename, 'public');
        return $path;
    }

    /**
     * בניית Prompt לפי חוקים סגורים (Rule-Based System) או Preset System
     * 
     * @param array $options [category, presentation, dish_name, description, etc.]
     * @return array ['positive' => string, 'negative' => string, 'strength' => float]
     */
    private function buildPrompt(array $options = []): array
    {
        // נסיון לטעון Preset System (חדש)
        $presets = config('ai.image_presets');

        if ($presets) {
            // ✅ Preset System זמין
            return $this->buildPromptFromPreset($options);
        }

        // ⚠️ Fallback: Rule-Based System (ישן)
        Log::warning('⚠️ image_presets not found, falling back to old prompt_rules');
        return $this->buildPromptFromRules($options);
    }

    /**
     * בניית Prompt מ-Preset System (חדש)
     */
    private function buildPromptFromPreset(array $options): array
    {
        $presets = config('ai.image_presets');
        $baseNegative = config('ai.base_negative', 'blurry, low quality');

        // 1️⃣ בחירת Preset
        $presetKey = $this->selectPreset($options);

        if (!isset($presets[$presetKey])) {
            Log::warning('⚠️ Preset not found', ['key' => $presetKey]);
            $presetKey = 'generic_food';
        }

        if (!isset($presets[$presetKey])) {
            // Fallback אם גם generic לא קיים
            return [
                'positive' => 'professional food photography, clean presentation, natural lighting',
                'negative' => $baseNegative,
                'strength' => 0.65,
            ];
        }

        $preset = $presets[$presetKey];
        Log::info('🎯 Selected Preset', ['key' => $presetKey, 'strength' => $preset['strength']]);

        // 2️⃣ העשרת הפרומפט עם פרטי המנה
        $enhancedPrompt = $this->enrichPromptWithDishDetails($preset['prompt'], $options);

        // 3️⃣ Negative prompt
        $fullNegative = $preset['negative'] . ', ' . $baseNegative;

        if (!empty($options['is_vegan'])) {
            $fullNegative .= ', meat, chicken, fish, seafood, dairy, eggs, cheese';
        } elseif (!empty($options['is_vegetarian'])) {
            $fullNegative .= ', meat, chicken, fish, seafood';
        }

        return [
            'positive' => $enhancedPrompt,
            'negative' => $fullNegative,
            'strength' => $preset['strength'],
        ];
    }

    /**
     * בחירת Preset לפי category + presentation
     */
    private function selectPreset(array $options): string
    {
        if (isset($options['preset'])) {
            return $options['preset'];
        }

        $category = $options['category'] ?? 'generic';
        $presentation = $options['presentation'] ?? 'plate';

        $presetKey = $category . '_' . $presentation;

        $presets = config('ai.image_presets');
        if (!isset($presets[$presetKey])) {
            if (isset($presets[$category . '_plate'])) {
                return $category . '_plate';
            }
            return 'generic_food';
        }

        return $presetKey;
    }

    /**
     * העשרת פרומפט עם שם מנה + מרכיבים + רמת פרמיום
     */
    private function enrichPromptWithDishDetails(string $basePrompt, array $options): string
    {
        $enrichments = [];

        // שם המנה (מתורגם)
        if (!empty($options['dish_name'])) {
            $translated = $this->translateDishName($options['dish_name']);
            if (!empty($translated)) {
                $enrichments[] = $translated;
            }
        }

        // מרכיבים מהתיאור
        if (!empty($options['description'])) {
            $ingredients = $this->extractIngredients($options['description']);
            if (!empty($ingredients)) {
                $enrichments[] = 'with ' . implode(', ', $ingredients);
            }
        }

        // פרמיום לפי מחיר
        if (!empty($options['price']) && $options['price'] > 60) {
            $enrichments[] = 'premium quality, gourmet presentation';
        }

        if (!empty($enrichments)) {
            return implode(', ', $enrichments) . ', ' . $basePrompt;
        }

        return $basePrompt;
    }

    /**
     * תרגום שם מנה
     */
    private function translateDishName(string $hebrewName): string
    {
        $translations = config('ai.dish_translations', []);
        $nameLower = mb_strtolower($hebrewName);
        $result = [];

        foreach ($translations as $he => $en) {
            if (mb_stripos($nameLower, $he) !== false) {
                $result[] = $en;
            }
        }

        return implode(' ', $result);
    }

    /**
     * חילוץ מרכיבים
     */
    private function extractIngredients(string $description): array
    {
        $keywords = config('ai.ingredient_keywords', []);
        $ingredients = [];
        $descLower = mb_strtolower($description);

        foreach ($keywords as $he => $en) {
            if (mb_stripos($descLower, $he) !== false) {
                $ingredients[] = $en;
            }
        }

        return array_slice(array_unique($ingredients), 0, 4);
    }

    /**
     * בניית Prompt מ-Rule-Based System (ישן - fallback)
     */
    private function buildPromptFromRules(array $options): array
    {
        $rules = config('ai.prompt_rules');

        // אם גם prompt_rules לא קיים
        if (!$rules || !isset($rules['base'])) {
            Log::error('❌ No prompt config found! Using emergency fallback');
            return [
                'positive' => 'professional food photography, clean presentation, natural lighting',
                'negative' => 'blurry, low quality, text, watermark',
                'strength' => 0.65,
            ];
        }

        // אתחול
        $positive = [];
        $negative = [];
        // קריאה מ-config במקום קודד קשיח - מאפשר שליטה מרכזית
        $strength = config('ai.image_enhancement.stability.strength', 0.70);

        // 1️⃣ שלד קבוע (BASE - תמיד)
        $positive[] = $rules['base']['positive'];
        $negative[] = $rules['base']['negative'];

        // 2️⃣ קטגוריה (drink vs food)
        $category = $options['category'] ?? 'food';
        if (isset($rules['categories'][$category])) {
            $positive[] = $rules['categories'][$category]['add'];
            $negative[] = $rules['categories'][$category]['negative'];
        }

        // 3️⃣ תת-סוג (subType) - מעדכן גם strength
        $subType = $options['subType'] ?? null;
        if ($subType && isset($rules['subTypes'][$subType])) {
            $positive[] = $rules['subTypes'][$subType]['add'];
            if (isset($rules['subTypes'][$subType]['negative'])) {
                $negative[] = $rules['subTypes'][$subType]['negative'];
            }
            // עדכון strength מהתת-סוג
            if (isset($rules['subTypes'][$subType]['strength'])) {
                $strength = $rules['subTypes'][$subType]['strength'];
            }
        }

        // 4️⃣ צורת הגשה (serving)
        $serving = $options['serving'] ?? null;
        if ($serving && isset($rules['serving'][$serving])) {
            $positive[] = $rules['serving'][$serving]['add'];
            if (isset($rules['serving'][$serving]['negative'])) {
                $negative[] = $rules['serving'][$serving]['negative'];
            }
        }

        // 5️⃣ רמת מסעדה (level)
        $level = $options['level'] ?? 'casual';
        if (isset($rules['levels'][$level])) {
            $positive[] = $rules['levels'][$level]['add'];
        }

        // 6️⃣ רקע (background)
        $background = $options['background'] ?? 'white';
        if (isset($rules['backgrounds'][$background])) {
            $positive[] = $rules['backgrounds'][$background]['add'];
        }

        // הרכבה סופית
        return [
            'positive' => implode(', ', array_filter($positive)),
            'negative' => implode(', ', array_filter($negative)),
            'strength' => $strength,
        ];
    }

    /**
     * יצירת וריאציות באמצעות AI (Stability AI img2img)
     * 
     * @param string $originalPath
     * @param array $promptData ['positive' => string, 'negative' => string, 'strength' => float]
     * @return array מערך של paths
     */
    private function generateVariations(string $originalPath, array $promptData): array
    {
        $provider = config('ai.image_enhancement.provider', 'stability');

        Log::info('🎨 Image Enhancement - Starting', [
            'provider' => $provider,
            'prompt_positive' => substr($promptData['positive'], 0, 100) . '...',
            'strength' => $promptData['strength'],
        ]);

        // בדיקה: אם provider = mock
        if ($provider === 'mock') {
            Log::warning('⚠️ Mock mode active');
            return $this->generateMockVariations($originalPath);
        }

        // ✅ קריאה ל-Stability AI (img2img)
        try {
            Log::info('🚀 Calling Stability AI SD3 (img2img)');
            return $this->generateWithStabilityAI($originalPath, $promptData);
        } catch (\Exception $e) {
            Log::error('❌ Stability AI failed, falling back to mock', [
                'error' => $e->getMessage()
            ]);
            return $this->generateMockVariations($originalPath);
        }
    }

    /**
     * קריאה אמיתית ל-Stability AI (Image-to-Image)
     * יוצר 3 וריאציות שונות
     */
    private function generateWithStabilityAI(string $originalPath, array $promptData): array
    {
        $apiKey = config('ai.image_enhancement.stability.api_key');
        $apiUrl = config('ai.image_enhancement.stability.api_url');
        $strength = $promptData['strength'];

        if (empty($apiKey)) {
            throw new \Exception('STABILITY_API_KEY not configured');
        }

        // טעינת התמונה המקורית
        $fullPath = Storage::disk('public')->path($originalPath);
        if (!file_exists($fullPath)) {
            throw new \Exception("Original image not found: {$fullPath}");
        }

        $variations = [];
        $imageContent = file_get_contents($fullPath);

        // יצירת 3 וריאציות (Stability AI מחזיר תמונה אחת בכל קריאה)
        // כל וריאציה מקבלת seed שונה + strength מעט שונה למגוון ויזואלי
        $strengthVariations = [0.60, 0.70, 0.80]; // וריאציות: מתונה, רגילה, חזקה

        for ($i = 0; $i < 3; $i++) {
            // 🎲 Seed רנדומלי - הפתרון לוריאציות זהות!
            $seed = rand(1000000, 9999999);

            // 🎚️ Strength שונה לכל וריאציה (אופציונלי - מעניק טווח רחב)
            $variationStrength = $strengthVariations[$i];

            // 🎯 CFG Scale - שליטה על עוצמת הפרומפט (7 = balanced)
            $cfgScale = 7;

            Log::info("📤 Stability AI Request #{$i}", [
                'prompt_preview' => substr($promptData['positive'], 0, 100),
                'prompt_full' => $promptData['positive'],
                'strength' => $variationStrength,
                'seed' => $seed,
                'cfg_scale' => $cfgScale,
                'image_size' => strlen($imageContent),
            ]);

            $response = Http::timeout(60)
                ->withHeaders([
                    'Authorization' => 'Bearer ' . $apiKey,
                    'Accept' => 'application/json',
                ])
                ->asMultipart()
                ->attach('image', $imageContent, 'original.jpg')
                ->attach('prompt', $promptData['positive'])
                ->attach('negative_prompt', $promptData['negative'])
                ->attach('mode', 'image-to-image')
                ->attach('strength', (string)$variationStrength)
                ->attach('seed', (string)$seed)
                ->attach('cfg_scale', (string)$cfgScale)
                ->attach('output_format', 'jpeg')
                ->post($apiUrl);

            Log::info("📥 Stability AI Response #{$i}", [
                'status' => $response->status(),
                'body_preview' => substr($response->body(), 0, 200),
            ]);

            if (!$response->successful()) {
                throw new \Exception('Stability AI API error: ' . $response->body());
            }

            $result = $response->json();

            if (!isset($result['image'])) {
                throw new \Exception('No image in Stability AI response');
            }

            // שמירת הוריאציה
            $imageData = base64_decode($result['image']);
            $filename = 'enhanced_' . time() . '_' . uniqid() . "_v{$i}.jpg";
            $savePath = 'ai-images/variations/' . $filename;

            Storage::disk('public')->put($savePath, $imageData);

            Log::info("✅ Stability AI variation #{$i} saved", [
                'path' => $savePath,
                'size' => strlen($imageData),
            ]);

            $variations[] = [
                'url' => asset("storage/{$savePath}"),
                'path' => $savePath,
            ];

            // המתנה קצרה בין קריאות למניעת rate limiting
            if ($i < 2) {
                sleep(1);
            }
        }

        return $variations;
    }

    /**
     * יצירת 3 וריאציות Mock (לפיתוח)
     */
    private function generateMockVariations(string $originalPath): array
    {
        $variations = [];

        for ($i = 0; $i < 3; $i++) {
            $filename = 'enhanced_mock_' . time() . '_' . uniqid() . "_v{$i}.jpg";
            $path = "ai-images/variations/{$filename}";

            // העתקה פשוטה של המקור (mock)
            Storage::disk('public')->copy($originalPath, $path);

            $variations[] = [
                'url' => asset("storage/{$path}"),
                'path' => $path,
            ];
        }

        return $variations;
    }

    /**
     * מחיקת וריאציות שלא נבחרו
     */
    private function cleanupVariations(AiImageEnhancement $enhancement, int $keepIndex): void
    {
        if (!$enhancement->variations) {
            return;
        }

        foreach ($enhancement->variations as $index => $variationData) {
            if ($index !== $keepIndex && isset($variationData['path'])) {
                Storage::disk('public')->delete($variationData['path']);
                Log::info('Deleted unselected variation', ['path' => $variationData['path']]);
            }
        }
    }
}

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

        $selectedPath = $enhancement->variations[$selectedIndex];

        // עדכון הרשומה
        $enhancement->update([
            'selected_path' => $selectedPath,
            'selected_index' => $selectedIndex,
        ]);

        // מחיקת וריאציות שלא נבחרו
        $this->cleanupVariations($enhancement, $selectedIndex);

        // עדכון המנה (אם משויכת)
        if ($this->menuItem) {
            $this->menuItem->update([
                'image_url' => $selectedPath,
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
     * בניית Prompt לפי חוקים סגורים (Rule-Based System)
     * 
     * @param array $options [category, subType, serving, level, background]
     * @return array ['positive' => string, 'negative' => string, 'strength' => float]
     */
    private function buildPrompt(array $options = []): array
    {
        $rules = config('ai.prompt_rules');

        // אתחול
        $positive = [];
        $negative = [];
        $strength = 0.35; // ברירת מחדל

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

        // קריאה ל-API (img2img)
        $response = Http::timeout(60)
            ->withHeaders([
                'Authorization' => 'Bearer ' . $apiKey,
                'Accept' => 'application/json',
            ])
            ->attach('image', file_get_contents($fullPath), 'original.jpg')
            ->post($apiUrl, [
                'prompt' => $promptData['positive'],
                'negative_prompt' => $promptData['negative'],
                'mode' => 'image-to-image',
                'strength' => $strength, // 0-1: כמה לשנות (0.35 = preserve 65%)
                'output_format' => 'jpeg',
            ]);

        if (!$response->successful()) {
            throw new \Exception('Stability AI API error: ' . $response->body());
        }

        $result = $response->json();

        // שמירת התמונה המשופרת
        if (!isset($result['image'])) {
            throw new \Exception('No image in Stability AI response');
        }

        $imageData = base64_decode($result['image']);
        $filename = 'enhanced_' . time() . '_' . uniqid() . '.jpg';
        $savePath = 'ai-images/variations/' . $filename;

        Storage::disk('public')->put($savePath, $imageData);

        Log::info('✅ Stability AI success', [
            'path' => $savePath,
            'size' => strlen($imageData),
        ]);

        return [[
            'url' => Storage::url($savePath),
            'path' => $savePath,
        ]];
    }

    /**
     * יצירת וריאציה Mock (לפיתוח)
     */
    private function generateMockVariations(string $originalPath): array
    {
        $filename = 'enhanced_mock_' . time() . '.jpg';
        $path = "ai-images/variations/{$filename}";

        // העתקה פשוטה של המקור (mock)
        Storage::disk('public')->copy($originalPath, $path);

        return [[
            'url' => Storage::url($path),
            'path' => $path,
        ]];
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

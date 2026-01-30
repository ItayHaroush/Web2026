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
     * @param string $background רקע נבחר (marble/wood/clean)
     * @param string $angle זווית נבחרת (top/side/hands)
     * @return AiImageEnhancement
     * @throws \Exception
     */
    public function enhance(UploadedFile $image, string $background, string $angle): AiImageEnhancement
    {
        // ולידציה
        $this->validateImage($image);
        $this->validateOptions($background, $angle);

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
                'background' => $background,
                'angle' => $angle,
                'status' => 'processing',
                'ai_provider' => config('ai.provider', 'openai'),
                'cost_credits' => $cost,
            ]);

            // בניית Prompt
            $prompt = $this->buildPrompt($background, $angle);

            // קריאה ל-AI (asynchronous ideally)
            $variations = $this->generateVariations($originalPath, $prompt);

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
     * ולידציה של אופציות
     */
    private function validateOptions(string $background, string $angle): void
    {
        $validBackgrounds = array_keys(config('ai.image_enhancement.backgrounds', []));
        $validAngles = array_keys(config('ai.image_enhancement.angles', []));

        if (!in_array($background, $validBackgrounds)) {
            throw new \Exception('רקע לא תקין');
        }

        if (!in_array($angle, $validAngles)) {
            throw new \Exception('זווית לא תקינה');
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
     * בניית Prompt מותאם אישית
     */
    private function buildPrompt(string $background, string $angle): string
    {
        $template = config('ai.image_enhancement.prompt_template');

        $dishName = $this->menuItem?->name ?? 'delicious dish';
        $backgroundPart = config("ai.image_enhancement.backgrounds.{$background}.prompt_part");
        $anglePart = config("ai.image_enhancement.angles.{$angle}.prompt_part");

        $prompt = str_replace(
            ['{dish_name}', '{angle}', '{background}'],
            [$dishName, $anglePart, $backgroundPart],
            $template
        );

        return $prompt;
    }

    /**
     * יצירת וריאציות באמצעות AI
     * 
     * @param string $originalPath
     * @param string $prompt
     * @return array מערך של paths
     */
    private function generateVariations(string $originalPath, string $prompt): array
    {
        $apiKey = config('ai.openai.api_key');
        
        // לוג לדיבאג
        Log::info('🎨 Image Enhancement - Starting', [
            'has_api_key' => !empty($apiKey),
            'api_key_prefix' => $apiKey ? substr($apiKey, 0, 10) . '...' : 'MISSING',
            'env' => config('app.env'),
            'provider' => config('ai.provider'),
        ]);

        // בדיקה: אם אין API key → mock mode
        if (empty($apiKey)) {
            Log::warning('⚠️ Mock mode active - no OpenAI API key configured');
            return $this->generateMockVariations($originalPath);
        }

        // ✅ קריאה אמיתית ל-OpenAI
        try {
            Log::info('🚀 Calling OpenAI DALL-E 3 API');
            return $this->generateWithOpenAI($prompt, $originalPath);
        } catch (\Exception $e) {
            Log::error('❌ OpenAI API failed, falling back to mock', [
                'error' => $e->getMessage()
            ]);
            return $this->generateMockVariations($originalPath);
        }
    }

    /**
     * יצירת וריאציות עם OpenAI DALL-E 3
     */
    private function generateWithOpenAI(string $prompt, string $originalPath): array
    {
        $apiKey = config('ai.openai.api_key');
        $count = config('ai.image_enhancement.variations_count', 3);

        $variations = [];

        // DALL-E 3 מחזיר רק 1 תמונה לקריאה, אז נבצע מספר קריאות
        for ($i = 0; $i < $count; $i++) {
            try {
                Log::info("📤 Calling OpenAI API - variation #{$i}");
                
                $response = Http::timeout(60)->withHeaders([
                    'Authorization' => "Bearer {$apiKey}",
                    'Content-Type' => 'application/json',
                ])->post('https://api.openai.com/v1/images/generations', [
                    'model' => 'dall-e-3',
                    'prompt' => $prompt,
                    'n' => 1,
                    'size' => '1024x1024',
                    'quality' => 'hd',
                    'response_format' => 'url',
                ]);

                if ($response->successful()) {
                    $imageUrl = $response->json('data.0.url');
                    Log::info("✅ OpenAI returned image URL - variation #{$i}");
                    
                    $savedPath = $this->downloadAndSaveImage($imageUrl, $originalPath, $i);
                    $variations[] = $savedPath;
                    
                    Log::info("💾 Image saved - variation #{$i}", ['path' => $savedPath]);
                } else {
                    Log::warning('OpenAI Image Generation Failed', [
                        'variation_index' => $i,
                        'response' => $response->json(),
                        'status' => $response->status(),
                    ]);
                }
            } catch (\Exception $e) {
                Log::error('OpenAI API Error', [
                    'variation_index' => $i,
                    'error' => $e->getMessage()
                ]);
            }
            
            // Delay קטן בין קריאות (rate limiting)
            if ($i < $count - 1) {
                sleep(1);
            }
        }

        if (empty($variations)) {
            throw new \Exception('לא ניתן ליצור וריאציות. נסה שוב מאוחר יותר.');
        }
        
        Log::info('✨ All variations created', ['total' => count($variations)]);

        return $variations;
    }

    /**
     * הורדה ושמירה של תמונה מ-URL
     */
    private function downloadAndSaveImage(string $url, string $originalPath, int $index): string
    {
        $directory = dirname($originalPath);
        $filename = 'variation_' . time() . "_{$index}.jpg";
        $path = "{$directory}/{$filename}";
        
        $contents = file_get_contents($url);
        Storage::disk('public')->put($path, $contents);

        return $path;
    }

    /**
     * יצירת וריאציות Mock (לפיתוח)
     */
    private function generateMockVariations(string $originalPath): array
    {
        $variations = [];
        $count = config('ai.image_enhancement.variations_count', 3);

        for ($i = 0; $i < $count; $i++) {
            $filename = 'variation_mock_' . time() . "_{$i}.jpg";
            $path = "ai-images/variations/{$filename}";

            // העתקה פשוטה של המקור (mock)
            Storage::disk('public')->copy($originalPath, $path);
            $variations[] = $path;
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

        foreach ($enhancement->variations as $index => $path) {
            if ($index !== $keepIndex) {
                Storage::disk('public')->delete($path);
                Log::info('Deleted unselected variation', ['path' => $path]);
            }
        }
    }
}

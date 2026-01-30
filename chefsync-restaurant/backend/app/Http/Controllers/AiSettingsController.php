<?php

namespace App\Http\Controllers;

use App\Models\Restaurant;
use App\Models\AiCredit;
use App\Models\AiUsageLog;
use App\Models\AiImageEnhancement;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Controller לניהול הגדרות AI ופיצ'רים מתקדמים
 */
class AiSettingsController extends Controller
{
    /**
     * קבלת הגדרות AI הנוכחיות
     */
    public function getSettings(Request $request)
    {
        $user = $request->user();
        $restaurant = Restaurant::findOrFail($user->restaurant_id);

        return response()->json([
            'success' => true,
            'data' => [
                'description_generator' => $restaurant->ai_description_enabled ?? true,
                'price_suggestion' => $restaurant->ai_price_enabled ?? true,
                'image_enhancement' => $restaurant->ai_image_enabled ?? true,
            ],
        ]);
    }

    /**
     * הפעלה/כיבוי של פיצ'ר AI
     */
    public function toggleFeature(Request $request)
    {
        $validated = $request->validate([
            'feature' => 'required|in:description_generator,price_suggestion,image_enhancement',
            'enabled' => 'required|boolean',
        ]);

        $user = $request->user();
        $restaurant = Restaurant::findOrFail($user->restaurant_id);

        $columnMap = [
            'description_generator' => 'ai_description_enabled',
            'price_suggestion' => 'ai_price_enabled',
            'image_enhancement' => 'ai_image_enabled',
        ];

        $column = $columnMap[$validated['feature']];
        $restaurant->update([$column => $validated['enabled']]);

        return response()->json([
            'success' => true,
            'message' => 'הגדרות עודכנו בהצלחה',
        ]);
    }

    /**
     * סטטיסטיקות שימוש ב-AI
     */
    public function getStats(Request $request)
    {
        $user = $request->user();
        $restaurant = Restaurant::findOrFail($user->restaurant_id);

        // קרדיטים
        $credits = AiCredit::where('restaurant_id', $restaurant->id)->first();
        $totalCreditsRemaining = $credits ? $credits->credits_balance : 0;

        // שימוש החודש
        $startOfMonth = now()->startOfMonth();
        $usageThisMonth = AiUsageLog::where('restaurant_id', $restaurant->id)
            ->where('created_at', '>=', $startOfMonth)
            ->sum('credits_used');

        // תיאורים שנוצרו
        $descriptionsGenerated = AiUsageLog::where('restaurant_id', $restaurant->id)
            ->where('feature', 'description_generator')
            ->where('created_at', '>=', $startOfMonth)
            ->count();

        // תמונות ששופרו
        $imagesEnhanced = AiImageEnhancement::where('restaurant_id', $restaurant->id)
            ->where('status', 'ready')
            ->where('created_at', '>=', $startOfMonth)
            ->count();

        // הצעות מחיר
        $pricesSuggested = AiUsageLog::where('restaurant_id', $restaurant->id)
            ->where('feature', 'price_suggestion')
            ->where('created_at', '>=', $startOfMonth)
            ->count();

        return response()->json([
            'success' => true,
            'data' => [
                'total_credits_remaining' => $totalCreditsRemaining,
                'total_credits_used' => $usageThisMonth,
                'descriptions_generated' => $descriptionsGenerated,
                'images_enhanced' => $imagesEnhanced,
                'prices_suggested' => $pricesSuggested,
            ],
        ]);
    }
}

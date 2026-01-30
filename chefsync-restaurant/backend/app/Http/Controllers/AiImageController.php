<?php

namespace App\Http\Controllers;

use App\Models\AiImageEnhancement;
use App\Models\Restaurant;
use App\Models\MenuItem;
use App\Services\ImageEnhancementService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * Controller לניהול שיפורי תמונות AI
 * 
 * Endpoints:
 * - POST /admin/ai/enhance-image : העלאה + יצירת וריאציות
 * - POST /admin/ai/select-variation : בחירת וריאציה סופית
 * - GET /admin/ai/enhancements : היסטוריית שיפורים
 */
class AiImageController extends Controller
{
    /**
     * יצירת שיפור תמונה חדש
     * 
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function enhance(Request $request)
    {
        $user = $request->user();
        $restaurant = Restaurant::findOrFail($user->restaurant_id);

        // ולידציה
        $validated = $request->validate([
            'image' => 'required|image|mimes:jpeg,jpg,png,webp|max:5120', // 5MB
            'background' => 'required|in:marble,wood,clean',
            'angle' => 'required|in:top,side,hands',
            'menu_item_id' => 'nullable|exists:menu_items,id',
        ]);

        try {
            // טעינת מנה (אם משויך)
            $menuItem = null;
            if ($request->filled('menu_item_id')) {
                $menuItem = MenuItem::where('restaurant_id', $restaurant->id)
                    ->findOrFail($validated['menu_item_id']);
            }

            // יצירת שיפור
            $service = new ImageEnhancementService($restaurant, $menuItem);
            $enhancement = $service->enhance(
                $request->file('image'),
                $validated['background'],
                $validated['angle']
            );

            return response()->json([
                'success' => true,
                'message' => 'תמונה עובדה בהצלחה! בחר את הווריאציה המועדפת',
                'data' => [
                    'enhancement_id' => $enhancement->id,
                    'variations' => $enhancement->getVariationUrls(),
                    'original_url' => asset("storage/{$enhancement->original_path}"),
                    'status' => $enhancement->status,
                ],
            ]);

        } catch (\Exception $e) {
            Log::error('Image Enhancement Error', [
                'restaurant_id' => $restaurant->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 400);
        }
    }

    /**
     * בחירת וריאציה סופית
     * 
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function selectVariation(Request $request)
    {
        $user = $request->user();
        $restaurant = Restaurant::findOrFail($user->restaurant_id);

        $validated = $request->validate([
            'enhancement_id' => 'required|exists:ai_image_enhancements,id',
            'selected_index' => 'required|integer|min:0|max:2',
        ]);

        try {
            // וידוא שהשיפור שייך למסעדה
            $enhancement = AiImageEnhancement::where('restaurant_id', $restaurant->id)
                ->findOrFail($validated['enhancement_id']);

            if ($enhancement->status !== 'ready') {
                return response()->json([
                    'success' => false,
                    'message' => 'השיפור עדיין מעובד או נכשל',
                ], 400);
            }

            // ביצוע הבחירה
            $menuItem = $enhancement->menuItem;
            $service = new ImageEnhancementService($restaurant, $menuItem);
            $selectedPath = $service->selectVariation($enhancement, $validated['selected_index']);

            return response()->json([
                'success' => true,
                'message' => 'התמונה נבחרה ונשמרה בהצלחה!',
                'data' => [
                    'selected_url' => asset("storage/{$selectedPath}"),
                    'menu_item_updated' => $menuItem !== null,
                ],
            ]);

        } catch (\Exception $e) {
            Log::error('Variation Selection Error', [
                'restaurant_id' => $restaurant->id,
                'enhancement_id' => $validated['enhancement_id'],
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 400);
        }
    }

    /**
     * קבלת היסטוריית שיפורים
     * 
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function getEnhancements(Request $request)
    {
        $user = $request->user();
        $restaurant = Restaurant::findOrFail($user->restaurant_id);

        $enhancements = AiImageEnhancement::where('restaurant_id', $restaurant->id)
            ->with('menuItem:id,name')
            ->orderBy('created_at', 'desc')
            ->limit(20)
            ->get()
            ->map(function ($enhancement) {
                return [
                    'id' => $enhancement->id,
                    'menu_item_name' => $enhancement->menuItem?->name,
                    'background' => $enhancement->background,
                    'angle' => $enhancement->angle,
                    'status' => $enhancement->status,
                    'selected_url' => $enhancement->getSelectedUrl(),
                    'created_at' => $enhancement->created_at->format('d/m/Y H:i'),
                ];
            });

        return response()->json([
            'success' => true,
            'data' => $enhancements,
        ]);
    }

    /**
     * מחיקת שיפור (ביטול)
     * 
     * @param Request $request
     * @param int $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function delete(Request $request, $id)
    {
        $user = $request->user();
        $restaurant = Restaurant::findOrFail($user->restaurant_id);

        $enhancement = AiImageEnhancement::where('restaurant_id', $restaurant->id)
            ->findOrFail($id);

        // מחיקת קבצים
        if ($enhancement->original_path) {
            \Storage::disk('public')->delete($enhancement->original_path);
        }

        if ($enhancement->variations) {
            foreach ($enhancement->variations as $path) {
                \Storage::disk('public')->delete($path);
            }
        }

        $enhancement->delete();

        return response()->json([
            'success' => true,
            'message' => 'השיפור נמחק בהצלחה',
        ]);
    }
}


<?php

namespace App\Http\Controllers;

use App\Models\DisplayScreen;
use App\Models\MenuItem;
use App\Models\Restaurant;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * בקר מסכי תצוגה - ניהול ותצוגה ציבורית
 */
class DisplayScreenController extends Controller
{
    private const ALL_PRESETS = ['classic', 'minimal', 'menuboard', 'modern', 'dark', 'workers', 'grill', 'family', 'pizzeria', 'homecooking'];
    private const BASIC_PRESETS = ['classic', 'minimal', 'menuboard'];

    // ============================================
    // Admin Endpoints (auth:sanctum + tenant)
    // ============================================

    /**
     * רשימת מסכים + מגבלות Tier
     * GET /admin/display-screens
     */
    public function index(Request $request)
    {
        $user = $request->user();
        $restaurant = Restaurant::withoutGlobalScopes()->find($user->restaurant_id);
        $tier = $restaurant->tier ?? 'basic';

        $screens = DisplayScreen::where('restaurant_id', $user->restaurant_id)
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(function ($screen) {
                return array_merge($screen->toArray(), [
                    'is_connected' => $screen->is_connected,
                    'view_url' => url("/screen/{$screen->token}"),
                ]);
            });

        return response()->json([
            'success' => true,
            'data' => [
                'screens' => $screens,
                'tier' => $tier,
                'limits' => [
                    'max_screens' => $tier === 'pro' ? 5 : 1,
                    'carousel_allowed' => $tier === 'pro',
                    'branding_required' => $tier !== 'pro',
                    'allowed_presets' => $tier === 'pro' ? self::ALL_PRESETS : self::BASIC_PRESETS,
                    'promotions_allowed' => $tier === 'pro',
                    'badges_allowed' => $tier === 'pro',
                    'logo_overlay_allowed' => $tier === 'pro',
                ],
            ],
        ]);
    }

    /**
     * יצירת מסך חדש
     * POST /admin/display-screens
     */
    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'display_type' => 'required|in:static,rotating',
            'design_preset' => 'nullable|string|max:50',
            'content_mode' => 'nullable|in:manual,auto_available',
            'refresh_interval' => 'nullable|integer|min:10|max:300',
            'rotation_speed' => 'nullable|integer|min:3|max:30',
            'design_options' => 'nullable|array',
            'design_options.logo_overlay' => 'nullable|array',
            'design_options.logo_overlay.enabled' => 'nullable|boolean',
            'design_options.logo_overlay.position' => 'nullable|in:top-left,top-right',
            'design_options.logo_overlay.opacity' => 'nullable|integer|min:5|max:10',
            'design_options.promotion' => 'nullable|array',
            'design_options.promotion.enabled' => 'nullable|boolean',
            'design_options.promotion.text' => 'nullable|string|max:100',
            'design_options.promotion.icon' => 'nullable|string|max:10',
            'design_options.promotion.display_mode' => 'nullable|in:tag,bar',
        ]);

        $user = $request->user();
        $restaurant = Restaurant::withoutGlobalScopes()->find($user->restaurant_id);
        $tier = $restaurant->tier ?? 'basic';

        // בדיקת מגבלת מסכים
        $maxScreens = $tier === 'pro' ? 5 : 1;
        $currentCount = DisplayScreen::where('restaurant_id', $user->restaurant_id)->count();
        if ($currentCount >= $maxScreens) {
            return response()->json([
                'success' => false,
                'message' => "הגעתם למגבלת המסכים ({$maxScreens}). שדרגו לתוכנית Pro לעוד מסכים.",
            ], 403);
        }

        // בייסיק: רק סטטי
        if ($tier === 'basic' && $request->display_type === 'rotating') {
            return response()->json([
                'success' => false,
                'message' => 'תצוגת קרוסלה זמינה רק בתוכנית Pro.',
            ], 403);
        }

        // בדיקת פריסטים לפי tier
        $preset = $request->input('design_preset', 'classic');
        $allowedPresets = $tier === 'pro' ? self::ALL_PRESETS : self::BASIC_PRESETS;
        if (!in_array($preset, $allowedPresets)) {
            $preset = 'classic';
        }

        // design_options - הסר פיצ'רי Pro מבייסיק
        $designOptions = $request->input('design_options', null);
        if ($tier === 'basic' && $designOptions) {
            unset($designOptions['logo_overlay'], $designOptions['promotion']);
            $designOptions = empty($designOptions) ? null : $designOptions;
        }

        $screen = DisplayScreen::create([
            'tenant_id' => $restaurant->tenant_id,
            'restaurant_id' => $restaurant->id,
            'name' => $request->name,
            'display_type' => $request->display_type,
            'design_preset' => $preset,
            'design_options' => $designOptions,
            'content_mode' => $request->input('content_mode', 'auto_available'),
            'refresh_interval' => $request->input('refresh_interval', 30),
            'rotation_speed' => $request->input('rotation_speed', 5),
            'show_branding' => $tier !== 'pro',
            'is_active' => true,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'מסך התצוגה נוצר בהצלחה!',
            'data' => array_merge($screen->toArray(), [
                'is_connected' => false,
                'view_url' => url("/screen/{$screen->token}"),
            ]),
        ], 201);
    }

    /**
     * עדכון הגדרות מסך
     * PUT /admin/display-screens/{id}
     */
    public function update(Request $request, $id)
    {
        $request->validate([
            'name' => 'sometimes|string|max:255',
            'display_type' => 'sometimes|in:static,rotating',
            'design_preset' => 'sometimes|string|max:50',
            'content_mode' => 'sometimes|in:manual,auto_available',
            'refresh_interval' => 'sometimes|integer|min:10|max:300',
            'rotation_speed' => 'sometimes|integer|min:3|max:30',
            'design_options' => 'sometimes|nullable|array',
            'design_options.logo_overlay' => 'nullable|array',
            'design_options.logo_overlay.enabled' => 'nullable|boolean',
            'design_options.logo_overlay.position' => 'nullable|in:top-left,top-right',
            'design_options.logo_overlay.opacity' => 'nullable|integer|min:5|max:10',
            'design_options.promotion' => 'nullable|array',
            'design_options.promotion.enabled' => 'nullable|boolean',
            'design_options.promotion.text' => 'nullable|string|max:100',
            'design_options.promotion.icon' => 'nullable|string|max:10',
            'design_options.promotion.display_mode' => 'nullable|in:tag,bar',
        ]);

        $user = $request->user();
        $screen = DisplayScreen::where('restaurant_id', $user->restaurant_id)->findOrFail($id);
        $restaurant = Restaurant::withoutGlobalScopes()->find($user->restaurant_id);
        $tier = $restaurant->tier ?? 'basic';

        // בייסיק: רק סטטי
        if ($tier === 'basic' && $request->input('display_type') === 'rotating') {
            return response()->json([
                'success' => false,
                'message' => 'תצוגת קרוסלה זמינה רק בתוכנית Pro.',
            ], 403);
        }

        // בייסיק: רק פריסטים בסיסיים
        if ($request->has('design_preset')) {
            $allowedPresets = $tier === 'pro' ? self::ALL_PRESETS : self::BASIC_PRESETS;
            if (!in_array($request->design_preset, $allowedPresets)) {
                $request->merge(['design_preset' => 'classic']);
            }
        }

        $updateData = $request->only([
            'name', 'display_type', 'design_preset', 'content_mode',
            'refresh_interval', 'rotation_speed', 'design_options',
        ]);

        // design_options - הסר פיצ'רי Pro מבייסיק
        if ($tier === 'basic' && isset($updateData['design_options'])) {
            unset($updateData['design_options']['logo_overlay'], $updateData['design_options']['promotion']);
            if (empty($updateData['design_options'])) {
                $updateData['design_options'] = null;
            }
        }

        // כפה ברנדינג בבייסיק
        $updateData['show_branding'] = $tier !== 'pro';

        $screen->update($updateData);

        return response()->json([
            'success' => true,
            'message' => 'המסך עודכן בהצלחה!',
            'data' => array_merge($screen->fresh()->toArray(), [
                'is_connected' => $screen->is_connected,
                'view_url' => url("/screen/{$screen->token}"),
            ]),
        ]);
    }

    /**
     * מחיקת מסך
     * DELETE /admin/display-screens/{id}
     */
    public function destroy(Request $request, $id)
    {
        $user = $request->user();
        $screen = DisplayScreen::where('restaurant_id', $user->restaurant_id)->findOrFail($id);
        $screen->delete();

        return response()->json([
            'success' => true,
            'message' => 'המסך נמחק בהצלחה.',
        ]);
    }

    /**
     * הפעלה/השבתה של מסך
     * POST /admin/display-screens/{id}/toggle
     */
    public function toggle(Request $request, $id)
    {
        $user = $request->user();
        $screen = DisplayScreen::where('restaurant_id', $user->restaurant_id)->findOrFail($id);
        $screen->update(['is_active' => !$screen->is_active]);

        return response()->json([
            'success' => true,
            'message' => $screen->is_active ? 'המסך הופעל.' : 'המסך הושבת.',
            'data' => ['is_active' => $screen->is_active],
        ]);
    }

    /**
     * חידוש קישור (טוקן חדש)
     * POST /admin/display-screens/{id}/regenerate-token
     */
    public function regenerateToken(Request $request, $id)
    {
        $user = $request->user();
        $screen = DisplayScreen::where('restaurant_id', $user->restaurant_id)->findOrFail($id);
        $screen->update(['token' => (string) Str::uuid()]);

        return response()->json([
            'success' => true,
            'message' => 'הקישור חודש בהצלחה!',
            'data' => [
                'token' => $screen->token,
                'view_url' => url("/screen/{$screen->token}"),
            ],
        ]);
    }

    /**
     * עדכון בחירת פריטים ידנית + סדר + badges
     * POST /admin/display-screens/{id}/items
     */
    public function updateItems(Request $request, $id)
    {
        $request->validate([
            'items' => 'required|array',
            'items.*.menu_item_id' => 'required|integer|exists:menu_items,id',
            'items.*.sort_order' => 'required|integer',
            'items.*.badge' => 'nullable|array',
            'items.*.badge.*' => 'in:spicy,recommended,new,value',
        ]);

        $user = $request->user();
        $screen = DisplayScreen::where('restaurant_id', $user->restaurant_id)->findOrFail($id);
        $restaurant = Restaurant::withoutGlobalScopes()->find($user->restaurant_id);
        $tier = $restaurant->tier ?? 'basic';

        $syncData = [];
        foreach ($request->items as $item) {
            $pivotData = ['sort_order' => $item['sort_order']];
            if (!empty($item['badge']) && $tier === 'pro') {
                $pivotData['badge'] = json_encode($item['badge']);
            }
            $syncData[$item['menu_item_id']] = $pivotData;
        }
        $screen->menuItems()->sync($syncData);

        return response()->json([
            'success' => true,
            'message' => 'הפריטים עודכנו בהצלחה!',
        ]);
    }

    /**
     * קבלת הפריטים הנוכחיים של מסך (לטעינת ממשק העריכה)
     * GET /admin/display-screens/{id}/items
     */
    public function getItems(Request $request, $id)
    {
        $user = $request->user();
        $screen = DisplayScreen::where('restaurant_id', $user->restaurant_id)->findOrFail($id);

        $items = $screen->menuItems()
            ->select('menu_items.id', 'menu_items.name', 'menu_items.price', 'menu_items.image_url', 'menu_items.is_available', 'menu_items.category_id')
            ->with('category:id,name')
            ->get()
            ->map(fn($item) => [
                'menu_item_id' => $item->id,
                'name' => $item->name,
                'price' => (float) $item->price,
                'image_url' => $item->image_url,
                'is_available' => $item->is_available,
                'category' => $item->category?->name,
                'sort_order' => $item->pivot->sort_order,
                'badge' => json_decode($item->pivot->badge, true) ?? [],
            ]);

        return response()->json([
            'success' => true,
            'data' => $items,
        ]);
    }

    // ============================================
    // Public Viewer Endpoint (ללא אימות)
    // ============================================

    /**
     * תוכן מסך תצוגה - ציבורי (לטאבלט/טלוויזיה)
     * GET /api/screen/{token}
     */
    public function viewerContent($token)
    {
        $screen = DisplayScreen::withoutGlobalScopes()
            ->where('token', $token)
            ->where('is_active', true)
            ->first();

        if (!$screen) {
            return response()->json([
                'success' => false,
                'message' => 'מסך לא נמצא או לא פעיל',
            ], 404);
        }

        // עדכון last_seen_at למעקב סטטוס
        $screen->update(['last_seen_at' => now()]);

        // מידע על המסעדה
        $restaurant = Restaurant::withoutGlobalScopes()->find($screen->restaurant_id);

        // טעינת פריטים לפי מצב תוכן
        if ($screen->content_mode === 'manual') {
            $items = $screen->menuItems()
                ->withoutGlobalScopes()
                ->where('menu_items.is_available', true)
                ->with('category:id,name')
                ->get()
                ->map(fn($item) => $this->formatItemForViewer($item, true));
        } else {
            // auto_available - כל הפריטים הזמינים
            $items = MenuItem::withoutGlobalScopes()
                ->where('restaurant_id', $screen->restaurant_id)
                ->where('is_available', true)
                ->with('category:id,name')
                ->orderBy('category_id')
                ->orderBy('name')
                ->get()
                ->map(fn($item) => $this->formatItemForViewer($item, false));
        }

        return response()->json([
            'success' => true,
            'data' => [
                'screen' => [
                    'name' => $screen->name,
                    'display_type' => $screen->display_type,
                    'design_preset' => $screen->design_preset,
                    'design_options' => $screen->design_options,
                    'refresh_interval' => $screen->refresh_interval,
                    'rotation_speed' => $screen->rotation_speed,
                    'show_branding' => $screen->show_branding,
                ],
                'restaurant' => [
                    'name' => $restaurant->name ?? '',
                    'logo_url' => $restaurant->logo_url ?? null,
                ],
                'items' => $items,
            ],
        ]);
    }

    private function formatItemForViewer($item, bool $hasPivot = false): array
    {
        $data = [
            'id' => $item->id,
            'name' => $item->name,
            'description' => $item->description,
            'price' => (float) $item->price,
            'image_url' => $item->image_url,
            'category' => $item->category?->name,
            'badge' => [],
        ];

        if ($hasPivot && $item->pivot) {
            $data['badge'] = json_decode($item->pivot->badge, true) ?? [];
        }

        return $data;
    }
}

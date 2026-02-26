<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\MenuItem;
use App\Models\Category;
use App\Models\Order;
use App\Models\Restaurant;
use App\Models\City;
use App\Models\RestaurantAddon;
use App\Models\RestaurantAddonGroup;
use App\Models\RestaurantVariant;
use App\Models\CategoryBasePrice;
use App\Models\MenuItemVariant;
use App\Models\MenuItemAddonGroup;
use App\Models\MenuItemAddon;
use App\Models\PriceRule;
use App\Models\DeliveryZone;
use App\Models\CashMovement;
use App\Models\CashRegisterShift;
use App\Services\BasePriceService;
use App\Services\HypPaymentService;
use App\Models\RestaurantPayment;
use App\Models\RestaurantSubscription;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class AdminController extends Controller
{
    /**
     * Resolve restaurant ID - supports super admin impersonation via X-Tenant-ID
     */
    private function resolveRestaurantId(Request $request): ?int
    {
        $user = $request->user();

        if ($user->restaurant_id) {
            return $user->restaurant_id;
        }

        // Super admin impersonation: resolve from tenant_id
        if ($user->is_super_admin) {
            $tenantId = app()->has('tenant_id') ? app('tenant_id') : $request->header('X-Tenant-ID');
            if ($tenantId) {
                $restaurant = Restaurant::where('tenant_id', $tenantId)->first();
                return $restaurant?->id;
            }
        }

        return null;
    }

    /**
     * Resolve restaurant model - supports super admin impersonation via X-Tenant-ID
     */
    private function resolveRestaurant(Request $request): ?Restaurant
    {
        $user = $request->user();

        if ($user->restaurant_id) {
            return $user->restaurant;
        }

        if ($user->is_super_admin) {
            $tenantId = app()->has('tenant_id') ? app('tenant_id') : $request->header('X-Tenant-ID');
            if ($tenantId) {
                return Restaurant::where('tenant_id', $tenantId)->first();
            }
        }

        return null;
    }

    /**
     * דשבורד - סטטיסטיקות
     */
    public function dashboard(Request $request)
    {
        $user = $request->user();
        $restaurantId = $this->resolveRestaurantId($request);

        $stats = [
            'orders_today' => Order::where('restaurant_id', $restaurantId)
                ->visibleToRestaurant()
                ->where('is_test', false)  // ← מתעלם מהזמנות test
                ->whereDate('created_at', today())
                ->count(),
            'orders_pending' => Order::where('restaurant_id', $restaurantId)
                ->visibleToRestaurant()
                ->where('is_test', false)  // ← מתעלם מהזמנות test
                ->whereIn('status', ['pending', 'received', 'preparing'])
                ->count(),
            'menu_items' => MenuItem::where('restaurant_id', $restaurantId)->count(),
            'categories' => Category::where('restaurant_id', $restaurantId)->count(),
            'employees' => User::where('restaurant_id', $restaurantId)->count(),
        ];

        // רק בעלים ומנהלים רואים הכנסות (סופר אדמין בהתחזות רואה הכל)
        if ($user->isOwner() || $user->isManager() || $user->is_super_admin) {
            $stats['revenue_today'] = Order::where('restaurant_id', $restaurantId)
                ->visibleToRestaurant()
                ->where('is_test', false)  // ← מתעלם מהזמנות test
                ->whereDate('created_at', today())
                ->where('status', '!=', 'cancelled')
                ->sum('total_amount');

            // חישוב שבוע מיום ראשון בשעה 08:00 עד יום ראשון הבא
            $weekStart = now()->startOfWeek(\Carbon\Carbon::SUNDAY)->setTime(8, 0, 0);
            // אם עדיין לא הגענו לשעה 8 ביום ראשון, קח שבוע קודם
            if (now()->dayOfWeek === \Carbon\Carbon::SUNDAY && now()->hour < 8) {
                $weekStart->subWeek();
            }
            $weekEnd = $weekStart->copy()->addWeek();

            $stats['revenue_week'] = Order::where('restaurant_id', $restaurantId)
                ->visibleToRestaurant()
                ->where('is_test', false)  // ← מתעלם מהזמנות test
                ->whereBetween('created_at', [$weekStart, $weekEnd])
                ->where('status', '!=', 'cancelled')
                ->sum('total_amount');
        }

        // הזמנות אחרונות
        $recentOrders = Order::where('restaurant_id', $restaurantId)
            ->visibleToRestaurant()
            ->where('is_test', false)  // ← מתעלם מהזמנות test
            ->with('items.menuItem.category')
            ->orderBy('created_at', 'desc')
            ->take(10)
            ->get();

        return response()->json([
            'success' => true,
            'stats' => $stats,
            'recent_orders' => $recentOrders,
        ]);
    }

    // =============================================
    // ניהול קטגוריות
    // =============================================

    public function getCategories(Request $request)
    {
        $user = $request->user();
        $categories = Category::where('restaurant_id', $this->resolveRestaurantId($request))
            ->withCount('items')
            ->orderBy('sort_order')
            ->get();

        return response()->json([
            'success' => true,
            'categories' => $categories,
        ]);
    }

    public function storeCategory(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'icon' => 'nullable|string|max:50',
            'dish_type' => 'nullable|string|in:plate,sandwich,both',
            'dine_in_adjustment' => 'nullable|numeric',
        ]);

        $user = $request->user();
        $restaurant = $this->resolveRestaurant($request);

        if (!$restaurant) {
            return response()->json([
                'success' => false,
                'message' => 'לא נמצאה מסעדה למשתמש זה',
            ], 400);
        }

        $maxOrder = Category::where('restaurant_id', $this->resolveRestaurantId($request))->max('sort_order') ?? 0;

        // ✅ וודא tenant_id + restaurant_id
        $category = Category::create([
            'tenant_id' => $restaurant->tenant_id,  // ← חובה!
            'restaurant_id' => $this->resolveRestaurantId($request),
            'name' => $request->name,
            'description' => $request->description,
            'icon' => $request->icon ?? '🍽️',
            'sort_order' => $maxOrder + 1,
            'is_active' => true,
            'dish_type' => $request->input('dish_type', 'both'),
            'dine_in_adjustment' => $request->input('dine_in_adjustment'),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'הקטגוריה נוצרה בהצלחה!',
            'category' => $category,
        ], 201);
    }

    public function updateCategory(Request $request, $id)
    {
        $user = $request->user();
        $category = Category::where('restaurant_id', $this->resolveRestaurantId($request))
            ->findOrFail($id);

        $request->validate([
            'name' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'icon' => 'nullable|string|max:50',
            'is_active' => 'sometimes|boolean',
            'sort_order' => 'sometimes|integer',
            'dish_type' => 'sometimes|string|in:plate,sandwich,both',
            'dine_in_adjustment' => 'nullable|numeric',
        ]);

        $category->update($request->only(['name', 'description', 'icon', 'is_active', 'sort_order', 'dish_type', 'dine_in_adjustment']));

        // הפעלה אוטומטית של תמחור ישיבה כשמגדירים התאמה בקטגוריה
        $dineInVal = $request->input('dine_in_adjustment');
        if ($dineInVal !== null && $dineInVal !== '' && (float) $dineInVal != 0) {
            $restaurant = $this->resolveRestaurant($request);
            if ($restaurant && !$restaurant->enable_dine_in_pricing) {
                $restaurant->update(['enable_dine_in_pricing' => true]);
            }
        }

        return response()->json([
            'success' => true,
            'message' => 'הקטגוריה עודכנה בהצלחה!',
            'category' => $category,
        ]);
    }

    public function deleteCategory(Request $request, $id)
    {
        $user = $request->user();
        $category = Category::where('restaurant_id', $this->resolveRestaurantId($request))
            ->findOrFail($id);

        // בדיקה אם יש פריטים בקטגוריה
        if ($category->items()->count() > 0) {
            return response()->json([
                'success' => false,
                'message' => 'לא ניתן למחוק קטגוריה שיש בה פריטים',
            ], 400);
        }

        $category->delete();

        return response()->json([
            'success' => true,
            'message' => 'הקטגוריה נמחקה בהצלחה!',
        ]);
    }

    /**
     * עדכון סדר הצגת קטגוריות
     */
    public function reorderCategories(Request $request)
    {
        $request->validate([
            'categories' => 'required|array',
            'categories.*.id' => 'required|integer|exists:categories,id',
            'categories.*.sort_order' => 'required|integer',
        ]);

        $user = $request->user();
        $restaurantId = $this->resolveRestaurantId($request);

        try {
            foreach ($request->categories as $categoryData) {
                Category::where('id', $categoryData['id'])
                    ->where('restaurant_id', $restaurantId)
                    ->update(['sort_order' => $categoryData['sort_order']]);
            }

            return response()->json([
                'success' => true,
                'message' => 'סדר הקטגוריות עודכן בהצלחה!',
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'שגיאה בעדכון סדר הקטגוריות',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * החלפת מצב פעיל/לא פעיל של קטגוריה
     */
    public function toggleCategoryActive(Request $request, $id)
    {
        $user = $request->user();
        $category = Category::where('restaurant_id', $this->resolveRestaurantId($request))
            ->findOrFail($id);

        $category->is_active = !$category->is_active;
        $category->save();

        return response()->json([
            'success' => true,
            'message' => $category->is_active ? 'הקטגוריה הופעלה!' : 'הקטגוריה הוסתרה מהתפריט',
            'category' => $category,
        ]);
    }

    public function duplicateCategory(Request $request, $id)
    {
        $user = $request->user();

        if (!$user->isManager() && !$user->is_super_admin) {
            return response()->json([
                'success' => false,
                'message' => 'אין לך הרשאה להעתיק קטגוריות',
            ], 403);
        }

        $restaurant = $this->resolveRestaurant($request);
        if (!$restaurant) {
            return response()->json([
                'success' => false,
                'message' => 'לא נמצאה מסעדה למשתמש',
            ], 404);
        }

        $originalCategory = Category::where('restaurant_id', $restaurant->id)
            ->with([
                'items.variants',
                'items.addonGroups.addons',
                'basePrices',
            ])
            ->findOrFail($id);

        $maxSortOrder = Category::where('restaurant_id', $restaurant->id)->max('sort_order') ?? 0;

        $newCategory = Category::create([
            'restaurant_id' => $restaurant->id,
            'tenant_id'     => $restaurant->tenant_id,
            'name'          => $originalCategory->name . ' (עותק)',
            'description'   => $originalCategory->description,
            'icon'          => $originalCategory->icon,
            'sort_order'    => $maxSortOrder + 1,
            'is_active'     => $originalCategory->is_active,
            'dish_type'     => $originalCategory->dish_type,
            'dine_in_adjustment' => $originalCategory->dine_in_adjustment,
        ]);

        // העתקת תמחור בסיס לקטגוריה
        foreach ($originalCategory->basePrices as $basePrice) {
            CategoryBasePrice::create([
                'category_id'          => $newCategory->id,
                'restaurant_variant_id' => $basePrice->restaurant_variant_id,
                'tenant_id'            => $restaurant->tenant_id,
                'price_delta'          => $basePrice->price_delta,
            ]);
        }

        // העתקת כל פריטי התפריט עם וריאנטים ותוספות
        foreach ($originalCategory->items as $originalItem) {
            // העתקת קובץ תמונה אם קיים
            $newImageUrl = null;
            $rawUrl = $originalItem->getRawOriginal('image_url');
            if ($rawUrl) {
                // חילוץ הנתיב היחסי - תמיכה גם ב-URL מלא וגם בנתיב יחסי
                $storagePath = $rawUrl;
                // אם זה URL מלא, חלץ רק את חלק הנתיב
                if (str_starts_with($storagePath, 'http://') || str_starts_with($storagePath, 'https://')) {
                    $storagePath = parse_url($storagePath, PHP_URL_PATH) ?: $rawUrl;
                }
                $oldPath = str_replace('/storage/', 'public/', $storagePath);
                if (Storage::exists($oldPath)) {
                    $extension = pathinfo($oldPath, PATHINFO_EXTENSION);
                    $newFilename = Str::uuid() . '.' . $extension;
                    $newPath = 'public/menu-items/' . $newFilename;
                    Storage::copy($oldPath, $newPath);
                    $newImageUrl = Storage::url($newPath);
                } else {
                    // אם הקובץ הפיזי לא נמצא, שמור את אותו URL מקורי
                    $newImageUrl = $rawUrl;
                }
            }

            $newItem = MenuItem::create([
                'restaurant_id'      => $restaurant->id,
                'category_id'        => $newCategory->id,
                'tenant_id'          => $restaurant->tenant_id,
                'name'               => $originalItem->name,
                'description'        => $originalItem->description,
                'allergen_tags'      => $originalItem->allergen_tags,
                'price'              => $originalItem->price,
                'image_url'          => $newImageUrl,
                'is_available'       => $originalItem->is_available,
                'use_variants'       => $originalItem->use_variants,
                'use_addons'         => $originalItem->use_addons,
                'addons_group_scope' => $originalItem->addons_group_scope,
                'max_addons'         => $originalItem->max_addons,
                'dine_in_adjustment' => $originalItem->dine_in_adjustment,
            ]);

            // העתקת וריאנטים ברמת פריט
            foreach ($originalItem->variants as $variant) {
                MenuItemVariant::create([
                    'menu_item_id' => $newItem->id,
                    'tenant_id'    => $restaurant->tenant_id,
                    'name'         => $variant->name,
                    'price_delta'  => $variant->price_delta,
                    'is_default'   => $variant->is_default,
                    'is_active'    => $variant->is_active,
                    'sort_order'   => $variant->sort_order,
                ]);
            }

            // העתקת קבוצות תוספות ברמת פריט
            foreach ($originalItem->addonGroups as $originalGroup) {
                $newGroup = MenuItemAddonGroup::create([
                    'menu_item_id'   => $newItem->id,
                    'tenant_id'      => $restaurant->tenant_id,
                    'name'           => $originalGroup->name,
                    'selection_type' => $originalGroup->selection_type,
                    'min_selections' => $originalGroup->min_selections,
                    'max_selections' => $originalGroup->max_selections,
                    'is_required'    => $originalGroup->is_required,
                    'is_active'      => $originalGroup->is_active,
                    'sort_order'     => $originalGroup->sort_order,
                ]);

                // העתקת תוספות בודדות בקבוצה
                foreach ($originalGroup->addons as $addon) {
                    MenuItemAddon::create([
                        'addon_group_id' => $newGroup->id,
                        'menu_item_id'   => $newItem->id,
                        'tenant_id'      => $restaurant->tenant_id,
                        'name'           => $addon->name,
                        'price_delta'    => $addon->price_delta,
                        'is_default'     => $addon->is_default,
                        'is_active'      => $addon->is_active,
                        'sort_order'     => $addon->sort_order,
                    ]);
                }
            }
        }

        $newCategory->loadCount('items');

        return response()->json([
            'success'  => true,
            'message'  => 'הקטגוריה הועתקה בהצלחה!',
            'category' => $newCategory,
        ], 201);
    }

    // =============================================
    // ניהול פריטי תפריט
    // =============================================

    public function getMenuItems(Request $request)
    {
        $user = $request->user();
        $restaurantId = $this->resolveRestaurantId($request);

        Log::info('getMenuItems called', [
            'user_id' => $user->id,
            'restaurant_id' => $restaurantId,
            'user_name' => $user->name,
        ]);

        $query = MenuItem::where('restaurant_id', $restaurantId)
            ->where('is_active', true)
            ->with('category');

        if ($request->has('category_id')) {
            $query->where('category_id', $request->category_id);
        }

        $items = $query->orderBy('category_id')->get();

        Log::info('Found items', [
            'count' => $items->count(),
            'items' => $items->map(fn($item) => [
                'id' => $item->id,
                'name' => $item->name,
                'category_id' => $item->category_id,
                'restaurant_id' => $item->restaurant_id,
            ])->toArray(),
        ]);

        return response()->json([
            'success' => true,
            'items' => $items,
        ]);
    }

    public function storeMenuItem(Request $request)
    {
        $request->validate([
            'category_id' => 'required|exists:categories,id',
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'price' => 'required|numeric|min:0',
            'image' => 'nullable|image|mimes:jpeg,png,jpg,webp|max:2048',
            'use_variants' => 'sometimes|boolean',
            'use_addons' => 'sometimes|boolean',
            'addons_group_scope' => 'nullable|string',  // משנה לקבל JSON string
            'max_addons' => 'nullable|integer|min:1|max:99',
            'dine_in_adjustment' => 'nullable|numeric',
            'addon_selection_weight' => 'nullable|integer|min:1|max:10',  // משקל בחירה כשמוצג כתוספת מקושרת (null=ברירת מחדל קבוצה)
        ]);

        $user = $request->user();

        // וידוא שהקטגוריה שייכת למסעדה
        $category = Category::where('restaurant_id', $this->resolveRestaurantId($request))
            ->findOrFail($request->category_id);

        // ✅ חישוב sort_order עם tenant_id
        $maxOrder = MenuItem::where('category_id', $request->category_id)
            ->where('tenant_id', $this->resolveRestaurant($request)->tenant_id)
            ->max('sort_order') ?? 0;

        $imageUrl = null;
        if ($request->hasFile('image')) {
            $imageUrl = $this->uploadImage($request->file('image'), 'menu-items');
        }

        $useVariants = $request->boolean('use_variants');
        $useAddons = $request->boolean('use_addons');
        $maxAddons = $useAddons && $request->filled('max_addons')
            ? (int) $request->input('max_addons')
            : null;

        // טיפול ב-addons_group_scope - תמיכה ב-JSON array או ערכים ישנים
        $addonsGroupScope = null;
        if ($useAddons && $request->filled('addons_group_scope')) {
            $scopeInput = $request->input('addons_group_scope');
            // אם זה JSON מתחיל ב-[ אז נשמור אותו כמו שהוא
            // אם זה ערך ישן (salads/hot/both) נשמור אותו
            $addonsGroupScope = $scopeInput;
        }

        // ✅ וודא tenant_id + restaurant_id
        $item = MenuItem::create([
            'tenant_id' => $this->resolveRestaurant($request)->tenant_id,  // ← חובה!
            'restaurant_id' => $this->resolveRestaurantId($request),
            'category_id' => $request->category_id,
            'name' => $request->name,
            'description' => $request->description,
            'price' => $request->price,
            'image_url' => $imageUrl,
            'sort_order' => $maxOrder + 1,
            'is_available' => true,
            'use_variants' => $useVariants,
            'use_addons' => $useAddons,
            'addons_group_scope' => $addonsGroupScope,
            'max_addons' => $maxAddons,
            'dine_in_adjustment' => $request->input('dine_in_adjustment'),
            'addon_selection_weight' => $request->filled('addon_selection_weight') ? max(1, min(10, (int) $request->addon_selection_weight)) : null,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'הפריט נוסף בהצלחה!',
            'item' => $item->load('category'),
        ], 201);
    }

    public function updateMenuItem(Request $request, $id)
    {
        $user = $request->user();
        $item = MenuItem::where('restaurant_id', $this->resolveRestaurantId($request))
            ->findOrFail($id);

        $request->validate([
            'category_id' => 'sometimes|exists:categories,id',
            'name' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'price' => 'sometimes|numeric|min:0',
            'is_available' => 'sometimes|boolean',
            'image' => 'nullable|image|mimes:jpeg,png,jpg,webp|max:2048',
            'use_variants' => 'sometimes|boolean',
            'use_addons' => 'sometimes|boolean',
            'addons_group_scope' => 'nullable|string',  // משנה לקבל JSON string
            'max_addons' => 'nullable|integer|min:1|max:99',
            'dine_in_adjustment' => 'nullable|numeric',
            'addon_selection_weight' => 'nullable|integer|min:1|max:10',
        ]);

        if ($request->hasFile('image')) {
            // מחיקת תמונה קודמת
            if ($item->image_url) {
                $this->deleteImage($item->image_url);
            }
            $item->image_url = $this->uploadImage($request->file('image'), 'menu-items');
        }

        $payload = $request->only(['category_id', 'name', 'description', 'price', 'is_available', 'sort_order']);

        if ($request->has('use_variants')) {
            $payload['use_variants'] = $request->boolean('use_variants');
        }

        if ($request->has('use_addons')) {
            $useAddons = $request->boolean('use_addons');
            $payload['use_addons'] = $useAddons;
            $payload['max_addons'] = $useAddons
                ? ($request->filled('max_addons') ? (int) $request->input('max_addons') : null)
                : null;

            // תמיכה ב-JSON array או ערכים ישנים
            if ($useAddons && $request->filled('addons_group_scope')) {
                $payload['addons_group_scope'] = $request->input('addons_group_scope');
            } else {
                $payload['addons_group_scope'] = null;
            }
        } elseif ($request->has('max_addons')) {
            $payload['max_addons'] = $request->filled('max_addons')
                ? (int) $request->input('max_addons')
                : null;
        } elseif ($request->has('addons_group_scope')) {
            $payload['addons_group_scope'] = $request->input('addons_group_scope') ?: null;
        }

        if ($request->has('dine_in_adjustment')) {
            $value = $request->input('dine_in_adjustment');
            $payload['dine_in_adjustment'] = ($value === '' || $value === null) ? null : (float) $value;
        }

        if ($request->has('addon_selection_weight')) {
            $v = $request->input('addon_selection_weight');
            $payload['addon_selection_weight'] = ($v === '' || $v === null) ? null : max(1, min(10, (int) $v));
        }

        $item->update($payload);

        // הפעלה אוטומטית של תמחור ישיבה כשמגדירים התאמה
        if (isset($payload['dine_in_adjustment']) && $payload['dine_in_adjustment'] !== null && (float) $payload['dine_in_adjustment'] != 0) {
            $restaurant = $this->resolveRestaurant($request);
            if ($restaurant && !$restaurant->enable_dine_in_pricing) {
                $restaurant->update(['enable_dine_in_pricing' => true]);
            }
        }

        return response()->json([
            'success' => true,
            'message' => 'הפריט עודכן בהצלחה!',
            'item' => $item->load('category'),
        ]);
    }

    public function deleteMenuItem(Request $request, $id)
    {
        $user = $request->user();
        $item = MenuItem::where('restaurant_id', $this->resolveRestaurantId($request))
            ->findOrFail($id);

        $hasOrders = $item->orderItems()->exists();

        if ($hasOrders) {
            $item->update(['is_active' => false, 'is_available' => false]);

            return response()->json([
                'success' => true,
                'message' => 'הפריט הועבר לארכיון (לא ניתן למחוק פריט שהופיע בהזמנות)',
                'archived' => true,
            ]);
        }

        $imageUrl = $item->getRawOriginal('image_url');

        $item->delete();

        if ($imageUrl) {
            $this->deleteImage($imageUrl);
        }

        return response()->json([
            'success' => true,
            'message' => 'הפריט נמחק בהצלחה!',
            'archived' => false,
        ]);
    }

    public function getArchivedMenuItems(Request $request)
    {
        $items = MenuItem::where('restaurant_id', $this->resolveRestaurantId($request))
            ->where('is_active', false)
            ->with('category')
            ->orderBy('updated_at', 'desc')
            ->get();

        return response()->json([
            'success' => true,
            'items' => $items,
        ]);
    }

    public function restoreMenuItem(Request $request, $id)
    {
        $item = MenuItem::where('restaurant_id', $this->resolveRestaurantId($request))
            ->where('is_active', false)
            ->findOrFail($id);

        $item->update(['is_active' => true, 'is_available' => true]);

        return response()->json([
            'success' => true,
            'message' => 'הפריט שוחזר בהצלחה!',
            'item' => $item->load('category'),
        ]);
    }

    // =============================================
    // ניהול סלטים קבועים (Add-ons ברמת מסעדה)
    // =============================================

    public function getSalads(Request $request)
    {
        $user = $request->user();

        if (!$user->isManager() && !$user->is_super_admin) {
            return response()->json([
                'success' => false,
                'message' => 'אין לך הרשאה לצפות בסלטים',
            ], 403);
        }

        $restaurant = $this->resolveRestaurant($request);
        if (!$restaurant) {
            return response()->json([
                'success' => false,
                'message' => 'לא נמצאה מסעדה למשתמש',
            ], 404);
        }

        $groups = RestaurantAddonGroup::where('restaurant_id', $restaurant->id)
            ->orderBy('sort_order')
            ->get();
        $salads = RestaurantAddon::where('restaurant_id', $restaurant->id)
            ->orderBy('sort_order')
            ->get();

        return response()->json([
            'success' => true,
            'salads' => $salads,
            'groups' => $groups,
        ]);
    }

    public function storeSalad(Request $request)
    {
        $user = $request->user();

        if (!$user->isManager() && !$user->is_super_admin) {
            return response()->json([
                'success' => false,
                'message' => 'אין לך הרשאה להוסיף סלטים',
            ], 403);
        }

        $request->validate([
            'name' => 'required|string|max:255',
            'price_delta' => 'nullable|numeric|min:0|max:999.99',
            'selection_weight' => 'nullable|integer|min:1|max:10',
            'is_active' => 'sometimes|boolean',
            'category_ids' => 'nullable|array',
            'category_ids.*' => 'integer',
            'group_id' => 'nullable|integer',
        ]);

        $restaurant = $this->resolveRestaurant($request);
        if (!$restaurant) {
            return response()->json([
                'success' => false,
                'message' => 'לא נמצאה מסעדה למשתמש',
            ], 404);
        }

        $groupId = $request->input('group_id');
        $group = $groupId
            ? RestaurantAddonGroup::where('restaurant_id', $restaurant->id)->findOrFail($groupId)
            : RestaurantAddonGroup::where('restaurant_id', $restaurant->id)->orderBy('sort_order')->firstOrFail();
        $maxOrder = RestaurantAddon::where('addon_group_id', $group->id)->max('sort_order') ?? 0;
        $categoryIds = collect($request->input('category_ids', []))
            ->filter(fn($id) => is_numeric($id))
            ->map(fn($id) => (int) $id)
            ->values();

        if ($categoryIds->isNotEmpty()) {
            $allowedCategoryIds = Category::where('restaurant_id', $restaurant->id)
                ->whereIn('id', $categoryIds)
                ->pluck('id')
                ->map(fn($id) => (int) $id)
                ->values();
            $categoryIds = $allowedCategoryIds;
        }

        $salad = RestaurantAddon::create([
            'addon_group_id' => $group->id,
            'restaurant_id' => $restaurant->id,
            'tenant_id' => $restaurant->tenant_id,
            'name' => $request->input('name'),
            'price_delta' => $request->input('price_delta', 0),
            'selection_weight' => $request->input('selection_weight', 1),
            'is_active' => $request->boolean('is_active', true),
            'category_ids' => $categoryIds->isEmpty() ? null : $categoryIds->toArray(),
            'sort_order' => $maxOrder + 1,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'הסלט נוסף בהצלחה!',
            'salad' => $salad,
        ], 201);
    }

    public function updateSalad(Request $request, $id)
    {
        $user = $request->user();

        if (!$user->isManager() && !$user->is_super_admin) {
            return response()->json([
                'success' => false,
                'message' => 'אין לך הרשאה לעדכן סלטים',
            ], 403);
        }

        $request->validate([
            'name' => 'sometimes|string|max:255',
            'price_delta' => 'sometimes|numeric|min:0|max:999.99',
            'selection_weight' => 'sometimes|integer|min:1|max:10',
            'is_active' => 'sometimes|boolean',
            'sort_order' => 'sometimes|integer|min:0',
            'category_ids' => 'nullable|array',
            'category_ids.*' => 'integer',
            'group_id' => 'nullable|integer',
        ]);

        $restaurant = $this->resolveRestaurant($request);
        if (!$restaurant) {
            return response()->json([
                'success' => false,
                'message' => 'לא נמצאה מסעדה למשתמש',
            ], 404);
        }

        $salad = RestaurantAddon::where('restaurant_id', $restaurant->id)
            ->findOrFail($id);

        $payload = $request->only(['name', 'price_delta', 'selection_weight', 'is_active', 'sort_order']);
        if ($request->has('category_ids')) {
            $categoryIds = collect($request->input('category_ids', []))
                ->filter(fn($id) => is_numeric($id))
                ->map(fn($id) => (int) $id)
                ->values();

            if ($categoryIds->isNotEmpty()) {
                $categoryIds = Category::where('restaurant_id', $restaurant->id)
                    ->whereIn('id', $categoryIds)
                    ->pluck('id')
                    ->map(fn($id) => (int) $id)
                    ->values();
            }

            $payload['category_ids'] = $categoryIds->isEmpty() ? null : $categoryIds->toArray();
        }
        if ($request->filled('group_id')) {
            $group = RestaurantAddonGroup::where('restaurant_id', $restaurant->id)
                ->findOrFail((int) $request->input('group_id'));
            $payload['addon_group_id'] = $group->id;
        }

        $salad->update($payload);

        return response()->json([
            'success' => true,
            'message' => 'הסלט עודכן בהצלחה!',
            'salad' => $salad,
        ]);
    }

    public function deleteSalad(Request $request, $id)
    {
        $user = $request->user();

        if (!$user->isManager() && !$user->is_super_admin) {
            return response()->json([
                'success' => false,
                'message' => 'אין לך הרשאה למחוק סלטים',
            ], 403);
        }

        $restaurant = $this->resolveRestaurant($request);
        if (!$restaurant) {
            return response()->json([
                'success' => false,
                'message' => 'לא נמצאה מסעדה למשתמש',
            ], 404);
        }

        $salad = RestaurantAddon::where('restaurant_id', $restaurant->id)
            ->findOrFail($id);

        $salad->delete();

        return response()->json([
            'success' => true,
            'message' => 'הסלט נמחק בהצלחה!',
        ]);
    }

    // =============================================
    // ניהול אזורי משלוח
    // =============================================

    public function getDeliveryZones(Request $request)
    {
        $user = $request->user();

        if (!$user->isManager() && !$user->is_super_admin) {
            return response()->json([
                'success' => false,
                'message' => 'אין לך הרשאה לצפות באזורי משלוח',
            ], 403);
        }

        $restaurant = $this->resolveRestaurant($request);
        if (!$restaurant) {
            return response()->json([
                'success' => false,
                'message' => 'לא נמצאה מסעדה למשתמש',
            ], 404);
        }

        $zones = DeliveryZone::where('restaurant_id', $restaurant->id)
            ->orderBy('sort_order')
            ->get();

        return response()->json([
            'success' => true,
            'zones' => $zones,
        ]);
    }

    public function storeDeliveryZone(Request $request)
    {
        $user = $request->user();

        if (!$user->isManager() && !$user->is_super_admin) {
            return response()->json([
                'success' => false,
                'message' => 'אין לך הרשאה להוסיף אזורי משלוח',
            ], 403);
        }

        $request->validate([
            'name' => 'required|string|max:255',
            'city_id' => 'nullable|exists:cities,id',
            'city_radius' => 'nullable|numeric|min:0.5|max:50',
            'polygon' => 'nullable|array|min:3',
            'polygon.*.lat' => 'required_with:polygon|numeric|between:-90,90',
            'polygon.*.lng' => 'required_with:polygon|numeric|between:-180,180',
            'pricing_type' => 'required|string|in:fixed,per_km,tiered',
            'fixed_fee' => 'nullable|numeric|min:0|max:999.99',
            'per_km_fee' => 'nullable|numeric|min:0|max:999.99',
            'tiered_fees' => 'nullable|array',
            'preview_image' => 'nullable|string',
            'is_active' => 'sometimes|boolean',
            'sort_order' => 'sometimes|integer|min:0',
        ]);

        // אימות שיש לפחות city_id או polygon
        if (!$request->filled('city_id') && !$request->filled('polygon')) {
            return response()->json([
                'success' => false,
                'message' => 'חובה לבחור עיר או לצייר פוליגון',
            ], 422);
        }

        $restaurant = $this->resolveRestaurant($request);
        if (!$restaurant) {
            return response()->json([
                'success' => false,
                'message' => 'לא נמצאה מסעדה למשתמש',
            ], 404);
        }

        $pricingType = $request->input('pricing_type');
        if ($pricingType === 'fixed' && !$request->filled('fixed_fee')) {
            return response()->json([
                'success' => false,
                'message' => 'חובה להזין מחיר קבוע',
            ], 422);
        }
        if ($pricingType === 'per_km' && !$request->filled('per_km_fee')) {
            return response()->json([
                'success' => false,
                'message' => 'חובה להזין מחיר לק"מ',
            ], 422);
        }
        if ($pricingType === 'tiered') {
            $tiers = $request->input('tiered_fees', []);
            if (!is_array($tiers) || empty($tiers)) {
                return response()->json([
                    'success' => false,
                    'message' => 'חובה להזין מדרגות מחיר',
                ], 422);
            }
            foreach ($tiers as $tier) {
                if (!is_array($tier) || !isset($tier['upto_km'], $tier['fee'])) {
                    return response()->json([
                        'success' => false,
                        'message' => 'מדרגות מחיר לא תקינות',
                    ], 422);
                }
            }
        }

        $zone = DeliveryZone::create([
            'restaurant_id' => $restaurant->id,
            'tenant_id' => $restaurant->tenant_id,
            'city_id' => $request->input('city_id'),
            'city_radius' => $request->input('city_radius'),
            'name' => $request->input('name'),
            'polygon' => $request->input('polygon'),
            'pricing_type' => $pricingType,
            'fixed_fee' => $request->input('fixed_fee', 0),
            'per_km_fee' => $request->input('per_km_fee'),
            'tiered_fees' => $request->input('tiered_fees'),
            'is_active' => $request->boolean('is_active', true),
            'sort_order' => (int) $request->input('sort_order', 0),
            'preview_image' => $request->input('preview_image'),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'אזור משלוח נוסף בהצלחה',
            'zone' => $zone,
        ], 201);
    }

    public function updateDeliveryZone(Request $request, $id)
    {
        $user = $request->user();

        if (!$user->isManager() && !$user->is_super_admin) {
            return response()->json([
                'success' => false,
                'message' => 'אין לך הרשאה לעדכן אזורי משלוח',
            ], 403);
        }

        $request->validate([
            'name' => 'sometimes|string|max:255',
            'city_id' => 'nullable|exists:cities,id',
            'city_radius' => 'nullable|numeric|min:0.5|max:50',
            'polygon' => 'nullable|sometimes|array|min:3',
            'polygon.*.lat' => 'required_with:polygon|numeric|between:-90,90',
            'polygon.*.lng' => 'required_with:polygon|numeric|between:-180,180',
            'pricing_type' => 'sometimes|string|in:fixed,per_km,tiered',
            'fixed_fee' => 'nullable|numeric|min:0|max:999.99',
            'per_km_fee' => 'nullable|numeric|min:0|max:999.99',
            'tiered_fees' => 'nullable|array',
            'is_active' => 'sometimes|boolean',
            'sort_order' => 'sometimes|integer|min:0',
            'preview_image' => 'nullable|string',
        ]);

        $restaurant = $this->resolveRestaurant($request);
        if (!$restaurant) {
            return response()->json([
                'success' => false,
                'message' => 'לא נמצאה מסעדה למשתמש',
            ], 404);
        }

        $zone = DeliveryZone::where('restaurant_id', $restaurant->id)->findOrFail($id);

        $pricingType = $request->input('pricing_type', $zone->pricing_type);
        if ($pricingType === 'fixed' && $request->has('fixed_fee') && $request->input('fixed_fee') === null) {
            return response()->json([
                'success' => false,
                'message' => 'חובה להזין מחיר קבוע',
            ], 422);
        }
        if ($pricingType === 'per_km' && $request->has('per_km_fee') && $request->input('per_km_fee') === null) {
            return response()->json([
                'success' => false,
                'message' => 'חובה להזין מחיר לק"מ',
            ], 422);
        }
        if ($pricingType === 'tiered' && $request->has('tiered_fees')) {
            $tiers = $request->input('tiered_fees', []);
            if (!is_array($tiers) || empty($tiers)) {
                return response()->json([
                    'success' => false,
                    'message' => 'חובה להזין מדרגות מחיר',
                ], 422);
            }
        }

        $payload = $request->only([
            'name',
            'city_id',
            'city_radius',
            'polygon',
            'pricing_type',
            'fixed_fee',
            'per_km_fee',
            'tiered_fees',
            'is_active',
            'sort_order',
            'preview_image',
        ]);

        $zone->update($payload);

        return response()->json([
            'success' => true,
            'message' => 'אזור משלוח עודכן בהצלחה',
            'zone' => $zone,
        ]);
    }

    public function deleteDeliveryZone(Request $request, $id)
    {
        $user = $request->user();

        if (!$user->isManager() && !$user->is_super_admin) {
            return response()->json([
                'success' => false,
                'message' => 'אין לך הרשאה למחוק אזורי משלוח',
            ], 403);
        }

        $restaurant = $this->resolveRestaurant($request);
        if (!$restaurant) {
            return response()->json([
                'success' => false,
                'message' => 'לא נמצאה מסעדה למשתמש',
            ], 404);
        }

        $zone = DeliveryZone::where('restaurant_id', $restaurant->id)->findOrFail($id);
        $zone->delete();

        return response()->json([
            'success' => true,
            'message' => 'אזור משלוח נמחק בהצלחה',
        ]);
    }

    // =============================================
    // ניהול בסיסים (וריאציות גלובליות)
    // =============================================

    public function getBases(Request $request)
    {
        $user = $request->user();

        if (!$user->isManager() && !$user->is_super_admin) {
            return response()->json([
                'success' => false,
                'message' => 'אין לך הרשאה לצפות בבסיסים',
            ], 403);
        }

        $restaurant = $this->resolveRestaurant($request);
        if (!$restaurant) {
            return response()->json([
                'success' => false,
                'message' => 'לא נמצאה מסעדה למשתמש',
            ], 404);
        }

        $bases = RestaurantVariant::where('restaurant_id', $restaurant->id)
            ->orderBy('sort_order')
            ->get();

        return response()->json([
            'success' => true,
            'bases' => $bases,
        ]);
    }

    public function storeBase(Request $request)
    {
        $user = $request->user();

        if (!$user->isManager() && !$user->is_super_admin) {
            return response()->json([
                'success' => false,
                'message' => 'אין לך הרשאה להוסיף בסיסים',
            ], 403);
        }

        $request->validate([
            'name' => 'required|string|max:255',
            'is_active' => 'sometimes|boolean',
            'is_default' => 'sometimes|boolean',
        ]);

        $restaurant = $this->resolveRestaurant($request);
        if (!$restaurant) {
            return response()->json([
                'success' => false,
                'message' => 'לא נמצאה מסעדה למשתמש',
            ], 404);
        }

        $isDefault = $request->boolean('is_default', false);
        if ($isDefault) {
            RestaurantVariant::where('restaurant_id', $restaurant->id)->update(['is_default' => false]);
        }

        $maxOrder = RestaurantVariant::where('restaurant_id', $restaurant->id)->max('sort_order') ?? 0;

        $base = RestaurantVariant::create([
            'restaurant_id' => $restaurant->id,
            'tenant_id' => $restaurant->tenant_id,
            'name' => $request->input('name'),
            'price_delta' => 0,
            'is_active' => $request->boolean('is_active', true),
            'is_default' => $isDefault,
            'sort_order' => $maxOrder + 1,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'הבסיס נוסף בהצלחה!',
            'base' => $base,
        ], 201);
    }

    public function updateBase(Request $request, $id)
    {
        $user = $request->user();

        if (!$user->isManager() && !$user->is_super_admin) {
            return response()->json([
                'success' => false,
                'message' => 'אין לך הרשאה לעדכן בסיסים',
            ], 403);
        }

        $request->validate([
            'name' => 'sometimes|string|max:255',
            'is_active' => 'sometimes|boolean',
            'is_default' => 'sometimes|boolean',
            'sort_order' => 'sometimes|integer|min:0',
        ]);

        $restaurant = $this->resolveRestaurant($request);
        if (!$restaurant) {
            return response()->json([
                'success' => false,
                'message' => 'לא נמצאה מסעדה למשתמש',
            ], 404);
        }

        $base = RestaurantVariant::where('restaurant_id', $restaurant->id)
            ->findOrFail($id);

        $payload = $request->only(['name', 'is_active', 'is_default', 'sort_order']);

        if ($request->has('is_default') && $request->boolean('is_default')) {
            RestaurantVariant::where('restaurant_id', $restaurant->id)
                ->where('id', '!=', $base->id)
                ->update(['is_default' => false]);
        }

        $base->update($payload);

        return response()->json([
            'success' => true,
            'message' => 'הבסיס עודכן בהצלחה!',
            'base' => $base,
        ]);
    }

    public function deleteBase(Request $request, $id)
    {
        $user = $request->user();

        if (!$user->isManager() && !$user->is_super_admin) {
            return response()->json([
                'success' => false,
                'message' => 'אין לך הרשאה למחוק בסיסים',
            ], 403);
        }

        $restaurant = $this->resolveRestaurant($request);
        if (!$restaurant) {
            return response()->json([
                'success' => false,
                'message' => 'לא נמצאה מסעדה למשתמש',
            ], 404);
        }

        $base = RestaurantVariant::where('restaurant_id', $restaurant->id)
            ->findOrFail($id);

        $base->delete();

        return response()->json([
            'success' => true,
            'message' => 'הבסיס נמחק בהצלחה!',
        ]);
    }

    // =============================================
    // ניהול מחירי בסיס לפי קטגוריה
    // =============================================

    public function getCategoryBasePrices(Request $request)
    {
        $user = $request->user();

        if (!$user->isManager() && !$user->is_super_admin) {
            return response()->json([
                'success' => false,
                'message' => 'אין לך הרשאה לצפות במחירי בסיסים',
            ], 403);
        }

        $restaurant = $this->resolveRestaurant($request);
        if (!$restaurant) {
            return response()->json([
                'success' => false,
                'message' => 'לא נמצאה מסעדה למשתמש',
            ], 404);
        }

        $prices = PriceRule::where('tenant_id', $restaurant->tenant_id)
            ->where('target_type', 'base')
            ->where('scope_type', 'category')
            ->get()
            ->map(function ($rule) {
                return [
                    'id' => $rule->id,
                    'category_id' => $rule->scope_id,
                    'restaurant_variant_id' => $rule->target_id,
                    'price_delta' => (float) $rule->price_delta,
                    'tenant_id' => $rule->tenant_id,
                    'created_at' => $rule->created_at,
                    'updated_at' => $rule->updated_at,
                ];
            });

        return response()->json([
            'success' => true,
            'category_base_prices' => $prices,
        ]);
    }

    public function saveCategoryBasePrices(Request $request)
    {
        $user = $request->user();

        if (!$user->isManager() && !$user->is_super_admin) {
            return response()->json([
                'success' => false,
                'message' => 'אין לך הרשאה לעדכן מחירי בסיסים',
            ], 403);
        }

        $request->validate([
            'prices' => 'present|array',
            'prices.*.category_id' => 'required|integer|exists:categories,id',
            'prices.*.restaurant_variant_id' => 'required|integer|exists:restaurant_variants,id',
            'prices.*.price_delta' => 'required|numeric|min:0|max:999.99',
            'category_ids' => 'sometimes|array',
            'category_ids.*' => 'integer',
        ]);

        $restaurant = $this->resolveRestaurant($request);
        if (!$restaurant) {
            return response()->json([
                'success' => false,
                'message' => 'לא נמצאה מסעדה למשתמש',
            ], 404);
        }

        // קבל את כל הקטגוריות שצריך לנקות (מה-category_ids או ממערך prices)
        $allCategoryIds = collect($request->input('category_ids', []))
            ->merge(collect($request->input('prices', []))->pluck('category_id'))
            ->unique();
        $variantIds = collect($request->input('prices', []))->pluck('restaurant_variant_id')->unique();

        // וודא שהקטגוריות שייכות למסעדה
        $validCategoryIds = Category::where('restaurant_id', $restaurant->id)
            ->whereIn('id', $allCategoryIds)
            ->pluck('id');

        // וודא שהבסיסים שייכים למסעדה
        $validVariantIds = $variantIds->isNotEmpty()
            ? RestaurantVariant::where('restaurant_id', $restaurant->id)
            ->whereIn('id', $variantIds)
            ->pluck('id')
            : collect();

        // מחק כללי מחיר קיימים ברמת קטגוריה עבור כל הקטגוריות
        if ($validCategoryIds->isNotEmpty()) {
            PriceRule::where('tenant_id', $restaurant->tenant_id)
                ->where('target_type', 'base')
                ->where('scope_type', 'category')
                ->whereIn('scope_id', $validCategoryIds)
                ->delete();
        }

        // הכנס כללי מחיר חדשים (רק ערכים שונים מ-0)
        $count = 0;
        foreach ($request->input('prices', []) as $priceData) {
            if (!$validCategoryIds->contains($priceData['category_id'])) continue;
            if (!$validVariantIds->contains($priceData['restaurant_variant_id'])) continue;
            if ((float) $priceData['price_delta'] == 0) continue;

            PriceRule::create([
                'tenant_id' => $restaurant->tenant_id,
                'target_type' => 'base',
                'target_id' => $priceData['restaurant_variant_id'],
                'scope_type' => 'category',
                'scope_id' => $priceData['category_id'],
                'price_delta' => $priceData['price_delta'],
            ]);
            $count++;
        }

        return response()->json([
            'success' => true,
            'message' => 'מחירי הבסיסים עודכנו בהצלחה!',
            'count' => $count,
        ]);
    }

    // =============================================
    // מחירי בסיס ברמת פריט (item-level)
    // =============================================

    public function getItemBasePrices(Request $request, $itemId)
    {
        $user = $request->user();

        if (!$user->isManager() && !$user->is_super_admin) {
            return response()->json([
                'success' => false,
                'message' => 'אין לך הרשאה לצפות במחירי בסיסים',
            ], 403);
        }

        $restaurant = $this->resolveRestaurant($request);
        if (!$restaurant) {
            return response()->json([
                'success' => false,
                'message' => 'לא נמצאה מסעדה למשתמש',
            ], 404);
        }

        $menuItem = MenuItem::where('id', $itemId)
            ->whereHas('category', function ($q) use ($restaurant) {
                $q->where('restaurant_id', $restaurant->id);
            })
            ->firstOrFail();

        $bases = RestaurantVariant::where('restaurant_id', $restaurant->id)
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->get();

        $priceService = new BasePriceService();
        $categoryPrices = $priceService->getCategoryPrices($menuItem->category_id);
        $itemAdjustments = $priceService->getItemAdjustments($menuItem->id);
        $calculatedPrices = $priceService->calculateBasePricesForItem($menuItem->id, $menuItem->category_id, $bases);

        $result = $bases->map(function ($base) use ($categoryPrices, $itemAdjustments, $calculatedPrices) {
            return [
                'base_id' => $base->id,
                'base_name' => $base->name,
                'category_price' => $categoryPrices[$base->id] ?? 0,
                'item_adjustment' => $itemAdjustments[$base->id] ?? 0,
                'final_price' => $calculatedPrices[$base->id] ?? 0,
            ];
        });

        return response()->json([
            'success' => true,
            'item_id' => (int) $itemId,
            'category_id' => $menuItem->category_id,
            'bases' => $result,
        ]);
    }

    public function saveItemBasePrices(Request $request, $itemId)
    {
        $user = $request->user();

        if (!$user->isManager() && !$user->is_super_admin) {
            return response()->json([
                'success' => false,
                'message' => 'אין לך הרשאה לעדכן מחירי בסיסים',
            ], 403);
        }

        $request->validate([
            'adjustments' => 'required|array',
            'adjustments.*.base_id' => 'required|integer|exists:restaurant_variants,id',
            'adjustments.*.price_delta' => 'required|numeric|min:-999.99|max:999.99',
        ]);

        $restaurant = $this->resolveRestaurant($request);
        if (!$restaurant) {
            return response()->json([
                'success' => false,
                'message' => 'לא נמצאה מסעדה למשתמש',
            ], 404);
        }

        $menuItem = MenuItem::where('id', $itemId)
            ->whereHas('category', function ($q) use ($restaurant) {
                $q->where('restaurant_id', $restaurant->id);
            })
            ->firstOrFail();

        $validBaseIds = RestaurantVariant::where('restaurant_id', $restaurant->id)
            ->pluck('id');

        // מחק כללי מחיר קיימים ברמת פריט
        PriceRule::where('tenant_id', $restaurant->tenant_id)
            ->where('target_type', 'base')
            ->where('scope_type', 'item')
            ->where('scope_id', $menuItem->id)
            ->delete();

        // הכנס כללי מחיר חדשים (רק אם delta != 0)
        $count = 0;
        foreach ($request->input('adjustments') as $adj) {
            if (!$validBaseIds->contains($adj['base_id'])) continue;
            if ((float) $adj['price_delta'] == 0) continue;

            PriceRule::create([
                'tenant_id' => $restaurant->tenant_id,
                'target_type' => 'base',
                'target_id' => $adj['base_id'],
                'scope_type' => 'item',
                'scope_id' => $menuItem->id,
                'price_delta' => $adj['price_delta'],
            ]);
            $count++;
        }

        return response()->json([
            'success' => true,
            'message' => 'התאמות מחיר ברמת הפריט עודכנו בהצלחה!',
            'count' => $count,
        ]);
    }

    // =============================================
    // ניהול קבוצות תוספות (Add-on Groups)
    // =============================================

    public function storeAddonGroup(Request $request)
    {
        $user = $request->user();

        if (!$user->isManager() && !$user->is_super_admin) {
            return response()->json([
                'success' => false,
                'message' => 'אין לך הרשאה ליצור קבוצות תוספות',
            ], 403);
        }

        $request->validate([
            'name' => 'required|string|max:255',
            'min_selections' => 'sometimes|integer|min:0|max:99',
            'max_selections' => 'nullable|integer|min:0|max:99',
            'is_active' => 'sometimes|boolean',
            'source_type' => 'sometimes|in:manual,category',
            'source_category_id' => 'nullable|integer|exists:categories,id',
            'source_include_prices' => 'sometimes|boolean',
            'source_selection_weight' => 'sometimes|nullable|integer|min:1|max:10',
        ]);

        $restaurant = $this->resolveRestaurant($request);
        if (!$restaurant) {
            return response()->json([
                'success' => false,
                'message' => 'לא נמצאה מסעדה למשתמש',
            ], 404);
        }

        // אם source_type=category, וודא שהקטגוריה שייכת למסעדה
        $sourceType = $request->input('source_type', 'manual');
        $sourceCategoryId = null;
        $sourceIncludePrices = $request->boolean('source_include_prices', true);
        $sourceSelectionWeight = max(1, min(10, (int) ($request->input('source_selection_weight', 1) ?: 1)));
        if ($sourceType === 'category') {
            $sourceCategoryId = $request->input('source_category_id');
            if ($sourceCategoryId) {
                Category::where('restaurant_id', $restaurant->id)->findOrFail($sourceCategoryId);
            }
        }

        $maxSortOrder = RestaurantAddonGroup::where('restaurant_id', $restaurant->id)->max('sort_order') ?? 0;

        $maxValue = $request->input('max_selections');
        $maxSelections = ($maxValue === 0 || $maxValue === '0' || $maxValue === null || $maxValue === '') ? null : (int) $maxValue;
        $minSelections = (int) ($request->input('min_selections', 0));

        if ($maxSelections !== null && $minSelections > $maxSelections) {
            return response()->json([
                'success' => false,
                'message' => 'מינימום בחירות לא יכול להיות גדול ממקסימום בחירות',
            ], 422);
        }

        $group = RestaurantAddonGroup::create([
            'restaurant_id' => $restaurant->id,
            'tenant_id' => $restaurant->tenant_id,
            'name' => $request->input('name'),
            'selection_type' => 'multiple',
            'min_selections' => $minSelections,
            'max_selections' => $maxSelections,
            'is_required' => $minSelections > 0,
            'is_active' => $request->boolean('is_active', true),
            'sort_order' => $maxSortOrder + 1,
            'placement' => $request->input('placement', 'inside'),
            'source_type' => $sourceType,
            'source_category_id' => $sourceCategoryId,
            'source_include_prices' => $sourceIncludePrices,
            'source_selection_weight' => $sourceSelectionWeight,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'הקבוצה נוצרה בהצלחה!',
            'group' => $group,
        ], 201);
    }

    public function updateAddonGroup(Request $request, $id)
    {
        $user = $request->user();

        if (!$user->isManager() && !$user->is_super_admin) {
            return response()->json([
                'success' => false,
                'message' => 'אין לך הרשאה לעדכן קבוצות תוספות',
            ], 403);
        }

        $request->validate([
            'name' => 'sometimes|string|max:255',
            'sort_order' => 'sometimes|integer|min:0',
            'is_active' => 'sometimes|boolean',
            'min_selections' => 'sometimes|integer|min:0|max:99',
            'max_selections' => 'nullable|integer|min:0|max:99',
            'placement' => 'sometimes|in:inside,side',
            'source_type' => 'sometimes|in:manual,category',
            'source_category_id' => 'nullable|integer|exists:categories,id',
            'source_include_prices' => 'sometimes|boolean',
            'source_selection_weight' => 'sometimes|nullable|integer|min:1|max:10',
        ]);

        $restaurant = $this->resolveRestaurant($request);
        if (!$restaurant) {
            return response()->json([
                'success' => false,
                'message' => 'לא נמצאה מסעדה למשתמש',
            ], 404);
        }

        $group = RestaurantAddonGroup::where('restaurant_id', $restaurant->id)
            ->findOrFail($id);

        $payload = $request->only(['name', 'sort_order', 'is_active', 'min_selections', 'max_selections', 'placement']);

        // טיפול ב-source_type / source_category_id
        if ($request->has('source_type')) {
            $payload['source_type'] = $request->input('source_type');
            if ($payload['source_type'] === 'category') {
                $sourceCategoryId = $request->input('source_category_id');
                if ($sourceCategoryId) {
                    Category::where('restaurant_id', $restaurant->id)->findOrFail($sourceCategoryId);
                }
                $payload['source_category_id'] = $sourceCategoryId;
            } else {
                $payload['source_category_id'] = null;
            }
        }

        if ($request->has('source_include_prices')) {
            $payload['source_include_prices'] = $request->boolean('source_include_prices');
        }

        if ($request->has('source_selection_weight')) {
            $payload['source_selection_weight'] = max(1, min(10, (int) ($request->input('source_selection_weight') ?: 1)));
        }

        // טיפול ב-max_selections = 0 (ללא הגבלה - יהפך ל-null)
        if ($request->has('max_selections')) {
            $maxValue = $request->input('max_selections');
            $payload['max_selections'] = ($maxValue === 0 || $maxValue === '0' || $maxValue === null || $maxValue === '') ? null : (int) $maxValue;
        }

        // וולידציה: אם max_selections מוגדר (לא null), min_selections חייב להיות <= max_selections
        if (isset($payload['max_selections']) && $payload['max_selections'] !== null) {
            $minVal = $payload['min_selections'] ?? $group->min_selections ?? 0;
            if ($minVal > $payload['max_selections']) {
                return response()->json([
                    'success' => false,
                    'message' => 'מינימום בחירות לא יכול להיות גדול ממקסימום בחירות',
                ], 422);
            }
        }

        if ($request->has('min_selections')) {
            $payload['is_required'] = (int) $request->input('min_selections') > 0;
        }

        $group->update($payload);

        return response()->json([
            'success' => true,
            'message' => 'הקבוצה עודכנה בהצלחה!',
            'group' => $group,
        ]);
    }

    public function deleteAddonGroup(Request $request, $id)
    {
        $user = $request->user();

        if (!$user->isManager() && !$user->is_super_admin) {
            return response()->json([
                'success' => false,
                'message' => 'אין לך הרשאה למחוק קבוצות תוספות',
            ], 403);
        }

        $restaurant = $this->resolveRestaurant($request);
        if (!$restaurant) {
            return response()->json([
                'success' => false,
                'message' => 'לא נמצאה מסעדה למשתמש',
            ], 404);
        }

        $group = RestaurantAddonGroup::where('restaurant_id', $restaurant->id)
            ->findOrFail($id);

        // מחק את כל הפריטים בקבוצה (cascade ברמת DB, אבל נעשה גם ברמת אפליקציה)
        $itemsCount = RestaurantAddon::where('addon_group_id', $id)->count();
        RestaurantAddon::where('addon_group_id', $id)->delete();

        $group->delete();

        return response()->json([
            'success' => true,
            'message' => $itemsCount > 0
                ? "הקבוצה ו-{$itemsCount} הפריטים שבה נמחקו בהצלחה!"
                : 'הקבוצה נמחקה בהצלחה!',
        ]);
    }

    public function duplicateAddonGroup(Request $request, $id)
    {
        $user = $request->user();

        if (!$user->isManager() && !$user->is_super_admin) {
            return response()->json([
                'success' => false,
                'message' => 'אין לך הרשאה להעתיק קבוצות תוספות',
            ], 403);
        }

        $restaurant = $this->resolveRestaurant($request);
        if (!$restaurant) {
            return response()->json([
                'success' => false,
                'message' => 'לא נמצאה מסעדה למשתמש',
            ], 404);
        }

        $originalGroup = RestaurantAddonGroup::where('restaurant_id', $restaurant->id)
            ->findOrFail($id);

        // מצא sort_order מקסימלי
        $maxSortOrder = RestaurantAddonGroup::where('restaurant_id', $restaurant->id)->max('sort_order') ?? 0;

        // צור קבוצה חדשה
        $newGroup = RestaurantAddonGroup::create([
            'restaurant_id' => $restaurant->id,
            'tenant_id' => $restaurant->tenant_id,
            'name' => $originalGroup->name . ' (עותק)',
            'selection_type' => $originalGroup->selection_type,
            'min_selections' => $originalGroup->min_selections,
            'max_selections' => $originalGroup->max_selections,
            'is_required' => $originalGroup->is_required,
            'is_active' => $originalGroup->is_active,
            'sort_order' => $maxSortOrder + 1,
            'source_type' => $originalGroup->source_type ?? 'manual',
            'source_category_id' => $originalGroup->source_category_id,
            'source_include_prices' => $originalGroup->source_include_prices ?? true,
            'source_selection_weight' => $originalGroup->source_selection_weight ?? 1,
        ]);

        // העתק את כל הפריטים
        $originalAddons = RestaurantAddon::where('addon_group_id', $id)->get();

        foreach ($originalAddons as $addon) {
            RestaurantAddon::create([
                'restaurant_id' => $restaurant->id,
                'tenant_id' => $restaurant->tenant_id,
                'addon_group_id' => $newGroup->id,
                'name' => $addon->name,
                'price' => $addon->price,
                'category_ids' => $addon->category_ids,
                'is_active' => $addon->is_active,
                'sort_order' => $addon->sort_order,
            ]);
        }

        return response()->json([
            'success' => true,
            'message' => 'הקבוצה הועתקה בהצלחה!',
            'group' => $newGroup,
        ], 201);
    }

    // =============================================
    // ניהול מסעדה
    // =============================================

    public function getRestaurant(Request $request)
    {
        $user = $request->user();
        $restaurantId = $this->resolveRestaurantId($request);
        $restaurant = Restaurant::findOrFail($restaurantId);

        // ספירת הזמנות פעילות לצורך חיווי בפעמון
        $activeOrdersCount = \App\Models\Order::where('restaurant_id', $restaurant->id)
            ->visibleToRestaurant()
            ->whereIn('status', [
                \App\Models\Order::STATUS_PENDING,
                \App\Models\Order::STATUS_RECEIVED,
                \App\Models\Order::STATUS_PREPARING,
                \App\Models\Order::STATUS_READY,
                \App\Models\Order::STATUS_DELIVERING
            ])
            ->count();

        $restaurant->active_orders_count = $activeOrdersCount;

        $graceDays = (int) \App\Models\SystemSetting::get('grace_period_days', 3);
        $daysLeftInGrace = 0;
        if ($restaurant->payment_failed_at) {
            $graceEndsAt = $restaurant->payment_failed_at->copy()->addDays($graceDays);
            $daysLeftInGrace = max(0, (int) $graceEndsAt->diffInDays(now(), false));
        }
        $restaurant->payment_failure_grace_days_left = $daysLeftInGrace;
        $restaurant->is_in_grace_period = $restaurant->isInGracePeriod();

        return response()->json([
            'success' => true,
            'restaurant' => $restaurant,
        ]);
    }

    public function updateRestaurant(Request $request)
    {
        $user = $request->user();

        if (!$user->isOwner() && !$user->is_super_admin) {
            return response()->json([
                'success' => false,
                'message' => 'רק בעל המסעדה יכול לעדכן פרטים',
            ], 403);
        }

        $restaurant = $this->resolveRestaurant($request);
        $isApproved = (bool) $restaurant->is_approved;

        // 🔍 DEBUG - מה מגיע מהפרונט בדיוק
        $rawBody = $request->getContent();
        Log::info('Raw Request Body', [
            'content_length' => strlen($rawBody),
            'content_type' => $request->header('content-type'),
            'raw_body' => substr($rawBody, 0, 500), // חתוך ל-500 chars
            'method' => $request->method(),
        ]);

        Log::info('Update Restaurant Request', [
            'all_data' => $request->all(),
            'has_name' => $request->has('name'),
            'filled_name' => $request->filled('name'),
            'name_value' => $request->input('name'),
        ]);

        // ✅ ולידציה - name חובה אם נשלח (sometimes = רק אם קיים בבקשה)
        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string',
            'cuisine_type' => 'nullable|string|max:255',
            'phone' => 'sometimes|string|max:20',
            'address' => 'sometimes|string|max:255',
            'city' => 'sometimes|string|max:255',
            'restaurant_type' => 'nullable|string|in:pizza,shawarma,burger,bistro,catering,general',
            'share_incentive_text' => 'nullable|string|max:1000',
            'delivery_time_minutes' => 'nullable|integer|min:1|max:240',
            'delivery_time_note' => 'nullable|string|max:255',
            'pickup_time_minutes' => 'nullable|integer|min:1|max:240',
            'pickup_time_note' => 'nullable|string|max:255',
            'kosher_type' => 'nullable|string|in:none,kosher,mehadrin,badatz',
            'kosher_certificate' => 'nullable|string|max:255',
            'kosher_notes' => 'nullable|string|max:1000',
            'common_allergens' => 'nullable|string',
            'allergen_notes' => 'nullable|string|max:1000',
            'is_open' => 'sometimes',
            'is_override_status' => 'sometimes',
            'operating_days' => 'nullable|string',
            'operating_hours' => 'nullable|string',
            'logo' => 'nullable|image|mimes:jpeg,png,jpg,webp|max:2048',
            'enable_dine_in_pricing' => 'sometimes|boolean',
        ]);

        if ($request->hasFile('logo')) {
            if ($restaurant->logo_url) {
                $this->deleteImage($restaurant->logo_url);
            }
            $restaurant->logo_url = $this->uploadImage($request->file('logo'), 'logos');
        }

        // המר את is_open לבוליאן (כולל false מפורש)
        $hasExplicitIsOpen = $request->has('is_open');
        $isOpen = null;
        if ($hasExplicitIsOpen) {
            $rawIsOpen = $request->input('is_open');
            if ($rawIsOpen === '1' || $rawIsOpen === 1 || $rawIsOpen === true) {
                $isOpen = true;
            } elseif ($rawIsOpen === '0' || $rawIsOpen === 0 || $rawIsOpen === false) {
                $isOpen = false;
            } else {
                $isOpen = (bool) $rawIsOpen;
            }
        }

        // האם נשלח דגל כפייה מפורש (כדי לאפשר גם ביטול כפייה)
        $hasExplicitOverrideFlag = $request->has('is_override_status') || $request->has('is_override');
        $overrideFlag = null;
        if ($hasExplicitOverrideFlag) {
            $rawOverride = $request->has('is_override_status')
                ? $request->input('is_override_status')
                : $request->input('is_override');

            if ($rawOverride === '1' || $rawOverride === 1 || $rawOverride === true || $rawOverride === 'true') {
                $overrideFlag = true;
            } elseif ($rawOverride === '0' || $rawOverride === 0 || $rawOverride === false || $rawOverride === 'false') {
                $overrideFlag = false;
            } else {
                $overrideFlag = (bool) $rawOverride;
            }
        }

        // ✅ שלוף רק שדות שבאמת נשלחו ולא ריקים/null
        $updateData = [];

        // שדות חובה - רק אם נשלחו וממולאים
        if ($request->filled('name')) {
            $updateData['name'] = $validated['name'];
        }

        // שדות אופציונליים - רק אם יש להם ערך
        if ($request->filled('phone')) {
            $updateData['phone'] = $validated['phone'];
        }

        // description, address יכולים להיות ריקים (null/clear)
        if ($request->has('description')) {
            $updateData['description'] = $request->input('description');
        }
        if ($request->has('address')) {
            $updateData['address'] = $request->input('address');
        }

        if ($request->has('restaurant_type')) {
            $updateData['restaurant_type'] = $request->input('restaurant_type');
        }

        if ($request->has('cuisine_type')) {
            $updateData['cuisine_type'] = $request->input('cuisine_type');
        }

        if ($request->has('share_incentive_text')) {
            $updateData['share_incentive_text'] = $request->input('share_incentive_text');
        }

        if ($request->has('delivery_time_minutes')) {
            $value = $request->input('delivery_time_minutes');
            $updateData['delivery_time_minutes'] = $value === '' ? null : (int) $value;
        }

        if ($request->has('delivery_time_note')) {
            $updateData['delivery_time_note'] = $request->input('delivery_time_note');
        }

        if ($request->has('pickup_time_minutes')) {
            $value = $request->input('pickup_time_minutes');
            $updateData['pickup_time_minutes'] = $value === '' ? null : (int) $value;
        }

        if ($request->has('pickup_time_note')) {
            $updateData['pickup_time_note'] = $request->input('pickup_time_note');
        }

        if ($request->has('kosher_type')) {
            $updateData['kosher_type'] = $request->input('kosher_type');
        }

        if ($request->has('kosher_certificate')) {
            $updateData['kosher_certificate'] = $request->input('kosher_certificate');
        }

        if ($request->has('kosher_notes')) {
            $updateData['kosher_notes'] = $request->input('kosher_notes');
        }

        if ($request->has('allergen_notes')) {
            $updateData['allergen_notes'] = $request->input('allergen_notes');
        }

        if ($request->has('enable_dine_in_pricing')) {
            $updateData['enable_dine_in_pricing'] = $request->boolean('enable_dine_in_pricing');
        }

        if ($request->has('common_allergens')) {
            $rawAllergens = $request->input('common_allergens');
            if ($rawAllergens === '' || $rawAllergens === null) {
                $updateData['common_allergens'] = null;
            } else {
                $decoded = json_decode($rawAllergens, true);
                $updateData['common_allergens'] = is_array($decoded) ? $decoded : $rawAllergens;
            }
        }

        if ($request->filled('city')) {
            $updateData['city'] = $validated['city'];
        }

        // ביטול כפייה מפורש: החזר למצב auto (גם אם לא נשלח is_open)
        if ($hasExplicitOverrideFlag && $overrideFlag === false) {
            $updateData['is_override_status'] = false;
        }

        // אם נשלח is_open, כפייה ידנית גוברת על חישוב
        if ($hasExplicitIsOpen) {
            $updateData['is_open'] = $isOpen;
            $updateData['is_override_status'] = true;
            Log::debug('🔒 Override status to: ' . ($isOpen ? 'true' : 'false'));
        } elseif ($restaurant->is_override_status && !($hasExplicitOverrideFlag && $overrideFlag === false)) {
            // שמור כפייה קיימת גם אם לא נשלח is_open בבקשה
            $updateData['is_override_status'] = true;
            $updateData['is_open'] = $restaurant->is_open;
            Log::debug('🔒 Preserve existing override: ' . ($restaurant->is_open ? 'true' : 'false'));
        }

        // עבוד עם JSON strings מ-FormData
        if ($request->has('operating_days') && !empty($request->input('operating_days'))) {
            try {
                $operatingDays = json_decode($request->input('operating_days'), true);
                if (is_array($operatingDays)) {
                    $updateData['operating_days'] = $operatingDays;
                }
            } catch (\Exception $e) {
                // אם לא ניתן לפרסר, השאר את הערך הקודם
            }
        }

        if ($request->has('operating_hours') && !empty($request->input('operating_hours'))) {
            try {
                $operatingHours = json_decode($request->input('operating_hours'), true);
                if (is_array($operatingHours)) {
                    // תמיכה לאחור: מבנה ישן עם open/close בלבד
                    if (isset($operatingHours['open']) && isset($operatingHours['close'])) {
                        $operatingHours = [
                            'default' => [
                                'open' => $operatingHours['open'],
                                'close' => $operatingHours['close'],
                            ],
                            'special_days' => [],
                        ];
                    }

                    $hasDefault = isset($operatingHours['default']['open']) && isset($operatingHours['default']['close']);
                    $hasSpecial = isset($operatingHours['special_days']) && is_array($operatingHours['special_days']);
                    $hasPerDay = isset($operatingHours['days']) && is_array($operatingHours['days']);

                    if ($hasDefault || $hasSpecial || $hasPerDay) {
                        // דחיית special days לא חוקיים (ללא תאריכים)
                        if ($hasSpecial) {
                            $validSpecial = [];
                            foreach ($operatingHours['special_days'] as $date => $special) {
                                if (!is_array($special)) {
                                    continue;
                                }
                                $validSpecial[$date] = [
                                    'open' => $special['open'] ?? null,
                                    'close' => $special['close'] ?? null,
                                    'closed' => (bool) ($special['closed'] ?? false),
                                ];
                            }
                            $operatingHours['special_days'] = $validSpecial;
                        }

                        // ניקוי per-day overrides
                        if ($hasPerDay) {
                            $validDays = [];
                            foreach ($operatingHours['days'] as $dayName => $dayCfg) {
                                if (!is_array($dayCfg)) {
                                    continue;
                                }
                                $validDays[$dayName] = [
                                    'open' => $dayCfg['open'] ?? null,
                                    'close' => $dayCfg['close'] ?? null,
                                    'closed' => (bool) ($dayCfg['closed'] ?? false),
                                ];
                            }
                            $operatingHours['days'] = $validDays;
                        }

                        $updateData['operating_hours'] = $operatingHours;
                    }
                }
            } catch (\Exception $e) {
                // אם לא ניתן לפרסר, השאר את הערך הקודם
            }
        }

        // אם בוטלה כפייה (is_override_status = false) ואין is_open מפורש - חשב מחדש תמיד
        $shouldRecalculateAfterClear = ($hasExplicitOverrideFlag && $overrideFlag === false && !$hasExplicitIsOpen);
        if ($shouldRecalculateAfterClear) {
            $operatingDays = $updateData['operating_days'] ?? $restaurant->operating_days ?? [];
            $operatingHours = $updateData['operating_hours'] ?? $restaurant->operating_hours ?? [];

            $calculated = $this->isRestaurantOpen($operatingDays, $operatingHours);
            $updateData['is_open'] = $calculated;
            Log::debug('🔓 Override cleared. Recalculated status: ' . ($calculated ? 'true' : 'false'));
        }

        // חשב סטטוס פתיחה אוטומטי רק אם אין כפייה ידנית (חדשה או קיימת)
        $shouldAutoCalculate = !$hasExplicitIsOpen && !($updateData['is_override_status'] ?? false);
        if ($shouldAutoCalculate && (isset($updateData['operating_days']) || isset($updateData['operating_hours']))) {
            $operatingDays = $updateData['operating_days'] ?? $restaurant->operating_days ?? [];
            $operatingHours = $updateData['operating_hours'] ?? $restaurant->operating_hours ?? [];

            $calculated = $this->isRestaurantOpen($operatingDays, $operatingHours);
            $updateData['is_open'] = $calculated;
            Log::debug('📅 Calculated status: ' . ($calculated ? 'true' : 'false'));
        }

        // אין פתיחה/כפייה לפני אישור סופר אדמין
        if (!$isApproved) {
            $updateData['is_open'] = false;
            $updateData['is_override_status'] = false;
        }

        Log::info('Final Update Data', [
            'updateData' => $updateData,
            'isEmpty' => empty($updateData),
        ]);

        // 🛡️ הגנה אחרונה - סנן null מכל השדות הקריטיים
        $updateData = array_filter($updateData, function ($value, $key) {
            // אפשר null רק לשדות שיכולים להיות ריקים
            $nullableFields = [
                'description',
                'cuisine_type',
                'address',
                'logo_url',
                'share_incentive_text',
                'delivery_time_minutes',
                'delivery_time_note',
                'pickup_time_minutes',
                'pickup_time_note',
                'kosher_type',
                'kosher_certificate',
                'kosher_notes',
                'common_allergens',
                'allergen_notes',
            ];
            if (in_array($key, $nullableFields)) {
                return true; // שמור גם null
            }
            // שאר השדות - אל תשמור null
            return $value !== null;
        }, ARRAY_FILTER_USE_BOTH);

        // אם נשלחה עיר, נרמול לשם העברי לפי טבלת הערים
        if (!empty($updateData['city'])) {
            $inputCity = $updateData['city'];
            $cityModel = City::where('hebrew_name', $inputCity)
                ->orWhere('name', $inputCity)
                ->first();
            if ($cityModel) {
                $updateData['city'] = $cityModel->hebrew_name ?: $inputCity;
            }
        }

        $restaurant->update($updateData);
        $restaurant->refresh(); // ✅ טען את הנתונים המעודכנים מה-DB

        Log::info('Restaurant after update:', [
            'id' => $restaurant->id,
            'name' => $restaurant->name,
            'updated_fields' => $updateData,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'פרטי המסעדה עודכנו בהצלחה!',
            'restaurant' => $restaurant->load(['categories', 'menuItems']), // ✅ טען יחסים
        ]);
    }

    public function clearRestaurantOverride(Request $request)
    {
        $user = $request->user();

        if (!$user->isOwner() && !$user->is_super_admin) {
            return response()->json([
                'success' => false,
                'message' => 'רק בעל המסעדה יכול לבטל כפייה',
            ], 403);
        }

        $restaurant = $this->resolveRestaurant($request);

        $calculated = $this->isRestaurantOpen($restaurant->operating_days ?? [], $restaurant->operating_hours ?? []);

        $restaurant->update([
            'is_override_status' => false,
            'is_open' => $calculated,
        ]);
        $restaurant->refresh();

        return response()->json([
            'success' => true,
            'message' => 'כפייה בוטלה וחזרנו לחישוב אוטומטי',
            'restaurant' => $restaurant->load(['categories', 'menuItems']),
        ]);
    }

    // =============================================
    // ניהול עובדים
    // =============================================

    public function getEmployees(Request $request)
    {
        $user = $request->user();

        if (!$user->isManager() && !$user->is_super_admin) {
            return response()->json([
                'success' => false,
                'message' => 'אין לך הרשאה לצפות בעובדים',
            ], 403);
        }

        $employees = User::where('restaurant_id', $this->resolveRestaurantId($request))
            ->orderBy('role')
            ->orderBy('name')
            ->get(['id', 'name', 'email', 'phone', 'role', 'is_active', 'created_at', 'hourly_rate', 'pos_pin_hash'])
            ->map(function ($emp) {
                $emp->has_pin = !is_null($emp->pos_pin_hash);
                unset($emp->pos_pin_hash);
                return $emp;
            });

        return response()->json([
            'success' => true,
            'employees' => $employees,
        ]);
    }

    public function updateEmployee(Request $request, $id)
    {
        $currentUser = $request->user();

        if (!$currentUser->isManager()) {
            return response()->json([
                'success' => false,
                'message' => 'אין לך הרשאה לעדכן עובדים',
            ], 403);
        }

        $employee = User::where('restaurant_id', $currentUser->restaurant_id)
            ->findOrFail($id);

        // בעל מסעדה לא יכול לעדכן את עצמו דרך זה
        if ($employee->id === $currentUser->id) {
            return response()->json([
                'success' => false,
                'message' => 'לא ניתן לעדכן את עצמך דרך ממשק זה',
            ], 400);
        }

        // אסור לשנות תפקיד של owner
        if ($employee->role === 'owner') {
            return response()->json([
                'success' => false,
                'message' => 'לא ניתן לשנות פרטי בעל המסעדה דרך ממשק זה',
            ], 403);
        }

        $request->validate([
            'name' => 'sometimes|string|max:255',
            'phone' => 'nullable|string|max:20',
            'role' => 'sometimes|in:manager,employee,delivery',
            'is_active' => 'sometimes|boolean',
            'password' => 'nullable|string|min:6|confirmed',
            'hourly_rate' => 'nullable|numeric|min:0|max:9999',
        ]);

        $updateData = $request->only(['name', 'phone', 'role', 'is_active', 'hourly_rate']);

        // עדכון סיסמה רק אם סופק שדה password
        if ($request->filled('password')) {
            $updateData['password'] = bcrypt($request->password);
        }

        $employee->update($updateData);

        return response()->json([
            'success' => true,
            'message' => 'העובד עודכן בהצלחה!',
            'employee' => $employee,
        ]);
    }

    public function deleteEmployee(Request $request, $id)
    {
        $currentUser = $request->user();

        if (!$currentUser->isOwner()) {
            return response()->json([
                'success' => false,
                'message' => 'רק בעל המסעדה יכול למחוק עובדים',
            ], 403);
        }

        $employee = User::where('restaurant_id', $currentUser->restaurant_id)
            ->findOrFail($id);

        if ($employee->id === $currentUser->id) {
            return response()->json([
                'success' => false,
                'message' => 'לא ניתן למחוק את עצמך',
            ], 400);
        }

        $employee->delete();

        return response()->json([
            'success' => true,
            'message' => 'העובד נמחק בהצלחה!',
        ]);
    }

    // =============================================
    // ניהול הזמנות
    // =============================================

    public function getOrders(Request $request)
    {
        $user = $request->user();
        $query = Order::where('restaurant_id', $this->resolveRestaurantId($request))
            ->visibleToRestaurant()
            ->with('items.menuItem.category');

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        if ($request->has('date')) {
            $query->whereDate('created_at', $request->date);
        }

        $orders = $query->orderBy('created_at', 'desc')
            ->paginate($request->get('per_page', 20));

        return response()->json([
            'success' => true,
            'orders' => $orders,
        ]);
    }

    public function updateOrderStatus(Request $request, $id)
    {
        $user = $request->user();
        $order = Order::where('restaurant_id', $this->resolveRestaurantId($request))
            ->findOrFail($id);

        // הזמנה באשראי שממתינה לאישור תשלום — לא ניתן לעדכן סטטוס עד שאושרה
        if ($order->payment_method === 'credit_card' && $order->payment_status === Order::PAYMENT_PENDING) {
            return response()->json([
                'success' => false,
                'message' => 'ההזמנה ממתינה לאישור תשלום באשראי. ניתן לעדכן סטטוס רק לאחר אישור התשלום.',
            ], 422);
        }

        $request->validate([
            'status' => 'required|in:pending,received,preparing,ready,delivering,delivered,cancelled',
        ]);

        // ולידציה: בדיקה שהמעבר מותר לפי transition map
        if (!$order->canTransitionTo($request->status)) {
            return response()->json([
                'success' => false,
                'message' => 'מעבר סטטוס לא מותר. ' .
                    ($order->delivery_method === 'pickup' && $request->status === 'delivering'
                        ? 'הזמנות איסוף עצמי אינן דורשות סטטוס "במשלוח"'
                        : 'מעבר זה אינו אפשרי במצב הנוכחי'),
                'current_status' => $order->status,
                'attempted_status' => $request->status,
                'allowed_statuses' => Order::getAllowedNextStatuses($order->status, $order->delivery_method),
            ], 422);
        }

        $order->status = $request->status;
        $order->updated_by_name = $user->name;
        $order->updated_by_user_id = $user->id;

        // כשהזמנה נמסרה - סמן תשלום כשולם אוטומטית (מזומן נגבה בעת מסירה)
        if ($request->status === 'delivered' && $order->payment_status === 'pending') {
            $order->payment_status = 'paid';
            if ($order->payment_method === 'cash') {
                $order->paid_at = now();
            }
        }

        // רישום תנועת מזומן במשמרת פתוחה (גם להזמנות שלא נוצרו מהקופה)
        if ($request->status === 'delivered' && $order->payment_method === 'cash') {
            $openShift = CashRegisterShift::where('restaurant_id', $order->restaurant_id)
                ->whereNull('closed_at')
                ->first();
            if ($openShift) {
                $existingMovement = CashMovement::where('shift_id', $openShift->id)
                    ->where('order_id', $order->id)
                    ->where('type', 'payment')
                    ->exists();
                if (!$existingMovement) {
                    CashMovement::create([
                        'shift_id' => $openShift->id,
                        'order_id' => $order->id,
                        'user_id' => $user->id,
                        'type' => 'payment',
                        'payment_method' => 'cash',
                        'amount' => (float) $order->total_amount,
                        'description' => "הזמנה #{$order->id}",
                    ]);
                }
            }
        }

        // כשהזמנה מבוטלת - בטל המתנה לתשלום
        if ($request->status === 'cancelled' && $order->payment_status === 'pending') {
            $order->payment_status = 'cancelled';
        }

        $order->save();

        // הפעלת הדפסה למטבח כשהזמנה מאושרת
        if ($request->status === 'preparing') {
            try {
                app(\App\Services\PrintService::class)->printOrder($order);
            } catch (\Exception $e) {
                Log::error('Print failed: ' . $e->getMessage());
            }
        }

        return response()->json([
            'success' => true,
            'message' => 'סטטוס ההזמנה עודכן!',
            'order' => $order->load('items.menuItem.category'),
        ]);
    }

    public function updateOrderEta(Request $request, $id)
    {
        $user = $request->user();
        $order = Order::where('restaurant_id', $this->resolveRestaurantId($request))
            ->findOrFail($id);

        $validated = $request->validate([
            'eta_minutes' => 'required|integer|min:1|max:240',
            'eta_note' => 'nullable|string|max:255',
        ]);

        $order->eta_minutes = $validated['eta_minutes'];
        if ($request->has('eta_note')) {
            $order->eta_note = $validated['eta_note'];
        }
        $order->eta_updated_at = now();
        $order->save();

        return response()->json([
            'success' => true,
            'message' => 'זמן ההזמנה עודכן בהצלחה',
            'order' => $order->load('items.menuItem'),
        ]);
    }

    // =============================================
    // מנוי וחיוב
    // =============================================

    public function subscriptionStatus(Request $request)
    {
        $restaurant = $request->user()->restaurant;

        if (!$restaurant) {
            return response()->json([
                'success' => false,
                'message' => 'לא נמצאה מסעדה למשתמש',
            ], 404);
        }

        $subscription = $restaurant->subscription;

        $tierFeatures = config("tier_features.{$restaurant->tier}", config('tier_features.basic', []));

        return response()->json([
            'success' => true,
            'data' => [
                'tier' => $restaurant->tier,
                'subscription_status' => $restaurant->subscription_status,
                'trial_ends_at' => $restaurant->trial_ends_at,
                'subscription_ends_at' => $restaurant->subscription_ends_at,
                'subscription_plan' => $restaurant->subscription_plan,
                'has_access' => $restaurant->hasAccess(),
                'days_left_in_trial' => $restaurant->getDaysLeftInTrial(),
                'days_left_in_subscription' => $restaurant->getDaysLeftInSubscription(),
                'outstanding_amount' => $subscription?->outstanding_amount,
                'next_charge_at' => $subscription?->next_charge_at,
                'last_paid_at' => $subscription?->last_paid_at,
                'features' => $tierFeatures,
            ],
        ]);
    }

    /**
     * בדיקת תשלום שאבד (redirect מ-HYP לא חזר)
     * נקרא כשמסעדן מגיע ל-paywall — בודק מול HYP אם יש עסקה מוצלחת שלא טופלה
     */
    public function checkPendingPayment(Request $request)
    {
        $restaurant = $request->user()->restaurant;

        if (!$restaurant) {
            return response()->json(['success' => false, 'recovered' => false], 404);
        }

        if ($restaurant->subscription_status === 'active' && $restaurant->hasAccess()) {
            return response()->json(['success' => true, 'recovered' => false, 'reason' => 'already_active']);
        }

        $hypService = app(HypPaymentService::class);
        if (!$hypService->isConfigured()) {
            return response()->json(['success' => true, 'recovered' => false, 'reason' => 'hyp_not_configured']);
        }

        try {
            $fromDate = now()->subDays(7)->format('d/m/Y');
            $toDate = now()->format('d/m/Y');
            $result = $hypService->getTransList($fromDate, $toDate);

            if (!$result['success'] || empty($result['transactions'])) {
                return response()->json(['success' => true, 'recovered' => false, 'reason' => 'no_transactions']);
            }

            $orderPrefix = "sub_{$restaurant->id}";

            foreach ($result['transactions'] as $tx) {
                $txOrder = $tx['Order'] ?? '';
                $txId = $tx['Id'] ?? '';
                $txCCode = (int) ($tx['CCode'] ?? -1);

                if ($txCCode !== 0 || !str_starts_with($txOrder, $orderPrefix)) {
                    continue;
                }

                $existingPayment = RestaurantPayment::where('restaurant_id', $restaurant->id)
                    ->where('reference', $txId)
                    ->where('status', 'paid')
                    ->first();

                if ($existingPayment) {
                    continue;
                }

                Log::info('[RECOVERY] Found unprocessed HYP subscription payment', [
                    'restaurant_id'  => $restaurant->id,
                    'transaction_id' => $txId,
                    'amount'         => $tx['Amount'] ?? '',
                    'order'          => $txOrder,
                ]);

                $sessionData = \Illuminate\Support\Facades\Cache::pull("hyp_session:{$restaurant->id}");
                $tier = $sessionData['tier'] ?? ($restaurant->tier ?? 'basic');
                $planType = $sessionData['plan_type'] ?? 'monthly';

                $prices = SuperAdminSettingsController::getPricingArray();
                $planAmount = $prices[$tier][$planType === 'yearly' ? 'yearly' : 'monthly'];

                $periodStart = now()->startOfDay();
                $periodEnd = $planType === 'yearly' ? $periodStart->copy()->addYear() : $periodStart->copy()->addMonth();
                $monthlyFee = $planType === 'yearly' ? round($planAmount / 12, 2) : $planAmount;

                RestaurantSubscription::updateOrCreate(
                    ['restaurant_id' => $restaurant->id],
                    [
                        'plan_type'      => $planType,
                        'monthly_fee'    => $monthlyFee,
                        'billing_day'    => now()->day > 28 ? 28 : now()->day,
                        'currency'       => 'ILS',
                        'status'         => 'active',
                        'outstanding_amount' => 0,
                        'next_charge_at' => $periodEnd,
                        'last_paid_at'   => now(),
                    ]
                );

                RestaurantPayment::create([
                    'restaurant_id' => $restaurant->id,
                    'amount'        => $planAmount,
                    'currency'      => 'ILS',
                    'period_start'  => $periodStart,
                    'period_end'    => $periodEnd,
                    'paid_at'       => now(),
                    'method'        => 'hyp_credit_card',
                    'reference'     => $txId,
                    'status'        => 'paid',
                ]);

                $tokenResult = $hypService->getToken($txId);
                if ($tokenResult['success']) {
                    $restaurant->update([
                        'hyp_card_token'  => $tokenResult['token'],
                        'hyp_card_expiry' => $tokenResult['tmonth'] . $tokenResult['tyear'],
                        'hyp_card_last4'  => $tokenResult['l4digit'],
                    ]);
                }

                $restaurant->update([
                    'subscription_status'   => 'active',
                    'subscription_plan'     => $planType,
                    'tier'                  => $tier,
                    'ai_credits_monthly'    => $prices[$tier]['ai_credits'] ?? 0,
                    'subscription_ends_at'  => $periodEnd,
                    'last_payment_at'       => now(),
                    'next_payment_at'       => $periodEnd,
                    'payment_failed_at'     => null,
                    'payment_failure_count' => 0,
                ]);

                Log::info('[RECOVERY] Subscription recovered from HYP transaction', [
                    'restaurant_id'  => $restaurant->id,
                    'tier'           => $tier,
                    'plan_type'      => $planType,
                    'transaction_id' => $txId,
                ]);

                return response()->json([
                    'success'   => true,
                    'recovered' => true,
                    'tier'      => $tier,
                    'plan_type' => $planType,
                ]);
            }

            return response()->json(['success' => true, 'recovered' => false, 'reason' => 'no_matching_transactions']);
        } catch (\Exception $e) {
            Log::error('[RECOVERY] Failed to check HYP transactions', [
                'restaurant_id' => $restaurant->id,
                'error'         => $e->getMessage(),
            ]);
            return response()->json(['success' => true, 'recovered' => false, 'reason' => 'error']);
        }
    }

    public function activateSubscription(Request $request)
    {
        $restaurant = $request->user()->restaurant;

        if (!$restaurant) {
            return response()->json([
                'success' => false,
                'message' => 'לא נמצאה מסעדה למשתמש',
            ], 404);
        }

        $validated = $request->validate([
            'plan_type' => 'required|in:monthly,yearly',
            'tier' => 'required|in:basic,pro',
        ]);

        $planType = $validated['plan_type'];
        $tier = $validated['tier'];
        $previousTier = $restaurant->tier;
        $isDowngrade = ($previousTier === 'pro' && $tier === 'basic');

        $prices = SuperAdminSettingsController::getPricingArray();

        $chargeAmount = $prices[$tier][$planType === 'yearly' ? 'yearly' : 'monthly'];
        $monthlyFeeForTracking = $planType === 'yearly'
            ? round($chargeAmount / 12, 2)
            : $chargeAmount;

        $periodStart = $restaurant->trial_ends_at && now()->lt($restaurant->trial_ends_at)
            ? $restaurant->trial_ends_at->copy()->startOfDay()
            : now()->startOfDay();

        $periodEnd = $planType === 'yearly'
            ? $periodStart->copy()->addYear()
            : $periodStart->copy()->addMonth();

        if ($isDowngrade) {
            Log::info('Subscription downgrade', [
                'restaurant_id' => $restaurant->id,
                'from'          => $previousTier,
                'to'            => $tier,
            ]);
        }

        $subscription = RestaurantSubscription::updateOrCreate(
            ['restaurant_id' => $restaurant->id],
            [
                'plan_type' => $planType,
                'monthly_fee' => $monthlyFeeForTracking,
                'billing_day' => now()->day > 28 ? 28 : now()->day,
                'currency' => 'ILS',
                'status' => 'active',
                'outstanding_amount' => 0,
                'next_charge_at' => $periodEnd,
                'last_paid_at' => now(),
            ]
        );

        $payment = RestaurantPayment::create([
            'restaurant_id' => $restaurant->id,
            'amount' => $chargeAmount,
            'currency' => 'ILS',
            'period_start' => $periodStart,
            'period_end' => $periodEnd,
            'paid_at' => now(),
            'method' => 'manual',
            'reference' => 'subscription_activation',
            'status' => 'paid',
        ]);

        $restaurant->update([
            'subscription_status'   => 'active',
            'subscription_plan'     => $planType,
            'tier'                  => $tier,
            'ai_credits_monthly'    => $prices[$tier]['ai_credits'] ?? 0,
            'subscription_ends_at'  => $periodEnd,
            'last_payment_at'       => now(),
            'next_payment_at'       => $periodEnd,
            'payment_failed_at'     => null,
            'payment_failure_count' => 0,
        ]);

        // AI Credits
        if ($tier === 'pro' && ($prices[$tier]['ai_credits'] ?? 0) > 0) {
            \App\Models\AiCredit::updateOrCreate(
                ['restaurant_id' => $restaurant->id],
                [
                    'tenant_id'           => $restaurant->tenant_id,
                    'tier'                => $tier,
                    'monthly_limit'       => $prices[$tier]['ai_credits'],
                    'credits_remaining'   => $prices[$tier]['ai_credits'],
                    'credits_used'        => 0,
                    'billing_cycle_start' => now()->startOfMonth(),
                    'billing_cycle_end'   => now()->endOfMonth(),
                ]
            );
        } elseif ($tier === 'basic') {
            $aiCredit = \App\Models\AiCredit::where('restaurant_id', $restaurant->id)->first();
            if ($aiCredit) {
                $aiCredit->update([
                    'tier'              => 'basic',
                    'monthly_limit'     => 0,
                    'credits_remaining' => 0,
                ]);
            }
        }

        return response()->json([
            'success'      => true,
            'message'      => $isDowngrade ? 'התוכנית עודכנה ל-Basic' : 'המנוי הופעל בהצלחה',
            'subscription' => $subscription,
            'restaurant'   => $restaurant->fresh(),
            'payment'      => $payment,
            'downgraded'   => $isDowngrade,
        ]);
    }

    /**
     * יצירת session תשלום עבור מנוי (B2B)
     * אם HYP מוגדר -> מחזיר URL לדף תשלום
     * אם לא -> מחזיר hyp_ready: false (frontend ממשיך עם V page)
     */
    public function createPaymentSession(Request $request)
    {
        $validated = $request->validate([
            'plan_type' => 'required|in:monthly,yearly',
            'tier' => 'required|in:basic,pro',
        ]);

        $restaurant = $request->user()->restaurant;

        if (!$restaurant) {
            return response()->json([
                'success' => false,
                'message' => 'לא נמצאה מסעדה למשתמש',
            ], 404);
        }

        $hypService = app(HypPaymentService::class);

        if (!$hypService->isConfigured()) {
            return response()->json([
                'success' => true,
                'hyp_ready' => false,
                'message' => 'HYP לא מוגדר — השתמש בדף V',
            ]);
        }

        $prices = SuperAdminSettingsController::getPricingArray();

        $tier = $validated['tier'];
        $planType = $validated['plan_type'];
        $planAmount = $prices[$tier][$planType === 'yearly' ? 'yearly' : 'monthly'];

        // דמי הקמה — נגבים רק לאחר אישור בדף הגדרות תשלום (בחירת אשראי + אישור דמי הקמה)
        // לא לכלול בתשלום ראשון של מנוי — הדמי הקמה מתווספים ל-outstanding כשמאשרים בהגדרות
        $setupFee = 0;
        $includesSetupFee = false;

        $totalAmount = $planAmount;
        $owner = $request->user();

        \Illuminate\Support\Facades\Cache::put(
            "hyp_session:{$restaurant->id}",
            [
                'tier'               => $tier,
                'plan_type'          => $planType,
                'amount'             => $totalAmount,
                'plan_amount'        => $planAmount,
                'includes_setup_fee' => $includesSetupFee,
                'setup_fee_amount'   => $setupFee,
                'client_name'        => $owner->name ?? '',
                'email'              => $owner->email ?? '',
                'phone'              => $restaurant->phone ?? '',
            ],
            now()->addMinutes(15)
        );

        $backendUrl = rtrim(config('app.url', 'http://localhost:8000'), '/');
        $redirectUrl = "{$backendUrl}/pay/hyp/subscription/{$restaurant->id}";

        return response()->json([
            'success'            => true,
            'hyp_ready'          => true,
            'payment_url'        => $redirectUrl,
            'plan_amount'        => $planAmount,
            'setup_fee'          => $setupFee,
            'includes_setup_fee' => $includesSetupFee,
            'total_amount'       => $totalAmount,
        ]);
    }

    /**
     * מידע על החשבון — חבילה נוכחית, חיובים, שדרוג/שדרוג לאחור
     */
    public function billingInfo(Request $request)
    {
        $restaurant = $request->user()->restaurant;

        if (!$restaurant) {
            return response()->json([
                'success' => false,
                'message' => 'לא נמצאה מסעדה למשתמש',
            ], 404);
        }

        $subscription = $restaurant->subscription;
        $prices = SuperAdminSettingsController::getPricingArray();
        $currentTier = $restaurant->tier ?? 'basic';
        $currentPlan = $restaurant->subscription_plan ?? 'monthly';

        $setupFeeCharged = (bool) $restaurant->hyp_setup_fee_charged;
        $setupFee = !$setupFeeCharged ? (($currentTier === 'pro') ? 100 : 200) : 0;

        $recentPayments = RestaurantPayment::where('restaurant_id', $restaurant->id)
            ->orderByDesc('paid_at')
            ->limit(10)
            ->get(['amount', 'currency', 'paid_at', 'method', 'reference', 'status']);

        return response()->json([
            'success' => true,
            'data' => [
                'current_tier'          => $currentTier,
                'current_plan'          => $currentPlan,
                'subscription_status'   => $restaurant->subscription_status,
                'subscription_ends_at'  => $restaurant->subscription_ends_at,
                'next_payment_at'       => $restaurant->next_payment_at,
                'last_payment_at'       => $restaurant->last_payment_at,
                'trial_ends_at'         => $restaurant->trial_ends_at,
                'has_access'            => $restaurant->hasAccess(),
                'days_left_in_trial'    => $restaurant->getDaysLeftInTrial(),
                'setup_fee_charged'     => $setupFeeCharged,
                'pending_setup_fee'     => $setupFee,
                'outstanding_amount'    => $subscription?->outstanding_amount ?? 0,
                'pricing'               => $prices,
                'recent_payments'       => $recentPayments,
                'has_card_on_file'      => !empty($restaurant->hyp_card_token),
                'card_last4'            => $restaurant->hyp_card_last4,
            ],
        ]);
    }

    // =============================================
    // העלאת תמונות
    // =============================================

    private function uploadImage($file, $folder)
    {
        $filename = Str::uuid() . '.' . $file->getClientOriginalExtension();
        $path = $file->storeAs("public/{$folder}", $filename);
        return Storage::url($path);
    }

    private function deleteImage($url)
    {
        $path = str_replace('/storage/', 'public/', $url);
        if (Storage::exists($path)) {
            Storage::delete($path);
        }
    }

    /**
     * חשב אם המסעדה פתוחה בהתאם לימי פתיחה ושעות פתיחה
     */
    private function isRestaurantOpen($operatingDays = [], $operatingHours = [])
    {
        // אם אין מידע על ימי פתיחה ושעות, נחזיר true כברירת מחדל
        if (empty($operatingDays) && empty($operatingHours)) {
            return true;
        }

        $now = \Carbon\Carbon::now('Asia/Jerusalem');
        $todayDate = $now->toDateString();
        $hebrewDays = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
        $currentDayName = $hebrewDays[$now->dayOfWeek];

        $defaultHours = $operatingHours['default'] ?? $operatingHours;
        $specialDays = $operatingHours['special_days'] ?? [];
        $perDayOverrides = $operatingHours['days'] ?? [];

        // 1) יום מיוחד לפי תאריך גובר על הכל
        if (!empty($specialDays[$todayDate])) {
            $special = $specialDays[$todayDate];
            if (!empty($special['closed'])) {
                return false;
            }
            $open = $special['open'] ?? ($defaultHours['open'] ?? '00:00');
            $close = $special['close'] ?? ($defaultHours['close'] ?? '23:59');
        }
        // 2) override שבועי ליום בשבוע (אם לא היה יום מיוחד)
        elseif (!empty($perDayOverrides[$currentDayName])) {
            $dayCfg = $perDayOverrides[$currentDayName];
            if (!empty($dayCfg['closed'])) {
                return false;
            }
            $open = $dayCfg['open'] ?? ($defaultHours['open'] ?? '00:00');
            $close = $dayCfg['close'] ?? ($defaultHours['close'] ?? '23:59');
        }
        // 3) ברירת מחדל: ימים + שעות כלליים
        else {
            // בדוק אם היום הנוכחי הוא יום פתיחה
            if (!empty($operatingDays) && !($operatingDays[$currentDayName] ?? false)) {
                return false;
            }

            if (empty($defaultHours)) {
                return true;
            }

            $open = $defaultHours['open'] ?? '00:00';
            $close = $defaultHours['close'] ?? '23:59';
        }

        // בדוק אם השעה הנוכחית בתוך שעות הפתיחה
        $currentTime = $now->format('H:i');

        // אם שעת הסגירה קטנה משעת הפתיחה (פתוח בין לילה), צריך טיפול מיוחד
        if ($close < $open) {
            // פתוח מ-open עד חצות, ומחצות עד close
            return $currentTime >= $open || $currentTime <= $close;
        }

        // טיפול רגיל
        return $currentTime >= $open && $currentTime <= $close;
    }

    /**
     * איפוס כל התאמות מחיר לישיבה
     */
    public function resetDineInAdjustments(Request $request)
    {
        $user = $request->user();

        if (!$user->isOwner() && !$user->is_super_admin) {
            return response()->json([
                'success' => false,
                'message' => 'רק בעל המסעדה יכול לבצע פעולה זו',
            ], 403);
        }

        $restaurantId = $this->resolveRestaurantId($request);
        $restaurant = Restaurant::findOrFail($restaurantId);

        Category::where('restaurant_id', $restaurantId)->update(['dine_in_adjustment' => null]);
        MenuItem::where('restaurant_id', $restaurantId)->update(['dine_in_adjustment' => null]);
        $restaurant->update(['enable_dine_in_pricing' => false]);

        return response()->json([
            'success' => true,
            'message' => 'כל ההתאמות לישיבה אופסו בהצלחה',
        ]);
    }

    /**
     * סימון הזמנה כשולמה ידנית
     * מוגבל ל-Owner / SuperAdmin בלבד
     */
    public function markOrderPaid(Request $request, $id)
    {
        $user = $request->user();

        if (!$user->isOwner() && !$user->isSuperAdmin()) {
            return response()->json([
                'success' => false,
                'message' => 'רק בעל מסעדה או סופר-אדמין יכולים לסמן הזמנה כשולמה',
            ], 403);
        }

        $order = Order::where('restaurant_id', $this->resolveRestaurantId($request))
            ->findOrFail($id);

        if ($order->payment_status === Order::PAYMENT_PAID) {
            return response()->json([
                'success' => false,
                'message' => 'ההזמנה כבר סומנה כשולמה',
            ], 422);
        }

        $order->payment_status = Order::PAYMENT_PAID;
        $order->marked_paid_by = $user->name;
        $order->marked_paid_at = now();
        $order->save();

        Log::info('Order marked as paid manually', [
            'order_id' => $order->id,
            'marked_by' => $user->name,
            'user_id' => $user->id,
            'restaurant_id' => $order->restaurant_id,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'ההזמנה סומנה כשולמה',
            'order' => $order->load('items.menuItem.category'),
        ]);
    }
}

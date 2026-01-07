<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\MenuItem;
use App\Models\Category;
use App\Models\Order;
use App\Models\Restaurant;
use App\Models\City;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class AdminController extends Controller
{
    /**
     * דשבורד - סטטיסטיקות
     */
    public function dashboard(Request $request)
    {
        $user = $request->user();
        $restaurantId = $user->restaurant_id;

        $stats = [
            'orders_today' => Order::where('restaurant_id', $restaurantId)
                ->whereDate('created_at', today())
                ->count(),
            'orders_pending' => Order::where('restaurant_id', $restaurantId)
                ->whereIn('status', ['pending', 'received', 'preparing'])
                ->count(),
            'menu_items' => MenuItem::where('restaurant_id', $restaurantId)->count(),
            'categories' => Category::where('restaurant_id', $restaurantId)->count(),
            'employees' => User::where('restaurant_id', $restaurantId)->count(),
        ];

        // רק בעלים ומנהלים רואים הכנסות
        if ($user->isOwner() || $user->isManager()) {
            $stats['revenue_today'] = Order::where('restaurant_id', $restaurantId)
                ->whereDate('created_at', today())
                ->where('status', '!=', 'cancelled')
                ->sum('total_amount');
            $stats['revenue_week'] = Order::where('restaurant_id', $restaurantId)
                ->whereBetween('created_at', [now()->startOfWeek(), now()->endOfWeek()])
                ->where('status', '!=', 'cancelled')
                ->sum('total_amount');
        }

        // הזמנות אחרונות
        $recentOrders = Order::where('restaurant_id', $restaurantId)
            ->with('items.menuItem')
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
        $categories = Category::where('restaurant_id', $user->restaurant_id)
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
        ]);

        $user = $request->user();
        $restaurant = $user->restaurant;

        if (!$restaurant) {
            return response()->json([
                'success' => false,
                'message' => 'לא נמצאה מסעדה למשתמש זה',
            ], 400);
        }

        $maxOrder = Category::where('restaurant_id', $user->restaurant_id)->max('sort_order') ?? 0;

        // ✅ וודא tenant_id + restaurant_id
        $category = Category::create([
            'tenant_id' => $restaurant->tenant_id,  // ← חובה!
            'restaurant_id' => $user->restaurant_id,
            'name' => $request->name,
            'description' => $request->description,
            'icon' => $request->icon ?? '🍽️',
            'sort_order' => $maxOrder + 1,
            'is_active' => true,
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
        $category = Category::where('restaurant_id', $user->restaurant_id)
            ->findOrFail($id);

        $request->validate([
            'name' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'icon' => 'nullable|string|max:50',
            'is_active' => 'sometimes|boolean',
            'sort_order' => 'sometimes|integer',
        ]);

        $category->update($request->only(['name', 'description', 'icon', 'is_active', 'sort_order']));

        return response()->json([
            'success' => true,
            'message' => 'הקטגוריה עודכנה בהצלחה!',
            'category' => $category,
        ]);
    }

    public function deleteCategory(Request $request, $id)
    {
        $user = $request->user();
        $category = Category::where('restaurant_id', $user->restaurant_id)
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

    // =============================================
    // ניהול פריטי תפריט
    // =============================================

    public function getMenuItems(Request $request)
    {
        $user = $request->user();
        $restaurantId = $user->restaurant_id;

        Log::info('getMenuItems called', [
            'user_id' => $user->id,
            'restaurant_id' => $restaurantId,
            'user_name' => $user->name,
        ]);

        $query = MenuItem::where('restaurant_id', $restaurantId)
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
        ]);

        $user = $request->user();

        // וידוא שהקטגוריה שייכת למסעדה
        $category = Category::where('restaurant_id', $user->restaurant_id)
            ->findOrFail($request->category_id);

        $maxOrder = MenuItem::where('category_id', $request->category_id)->max('sort_order') ?? 0;

        $imageUrl = null;
        if ($request->hasFile('image')) {
            $imageUrl = $this->uploadImage($request->file('image'), 'menu-items');
        }

        $item = MenuItem::create([
            'restaurant_id' => $user->restaurant_id,
            'category_id' => $request->category_id,
            'name' => $request->name,
            'description' => $request->description,
            'price' => $request->price,
            'image_url' => $imageUrl,
            'sort_order' => $maxOrder + 1,
            'is_available' => true,
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
        $item = MenuItem::where('restaurant_id', $user->restaurant_id)
            ->findOrFail($id);

        $request->validate([
            'category_id' => 'sometimes|exists:categories,id',
            'name' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'price' => 'sometimes|numeric|min:0',
            'is_available' => 'sometimes|boolean',
            'image' => 'nullable|image|mimes:jpeg,png,jpg,webp|max:2048',
        ]);

        if ($request->hasFile('image')) {
            // מחיקת תמונה קודמת
            if ($item->image_url) {
                $this->deleteImage($item->image_url);
            }
            $item->image_url = $this->uploadImage($request->file('image'), 'menu-items');
        }

        $item->update($request->only(['category_id', 'name', 'description', 'price', 'is_available', 'sort_order']));

        return response()->json([
            'success' => true,
            'message' => 'הפריט עודכן בהצלחה!',
            'item' => $item->load('category'),
        ]);
    }

    public function deleteMenuItem(Request $request, $id)
    {
        $user = $request->user();
        $item = MenuItem::where('restaurant_id', $user->restaurant_id)
            ->findOrFail($id);

        // מחיקת תמונה
        if ($item->image_url) {
            $this->deleteImage($item->image_url);
        }

        $item->delete();

        return response()->json([
            'success' => true,
            'message' => 'הפריט נמחק בהצלחה!',
        ]);
    }

    // =============================================
    // ניהול מסעדה
    // =============================================

    public function getRestaurant(Request $request)
    {
        $user = $request->user();
        $restaurant = Restaurant::findOrFail($user->restaurant_id);

        return response()->json([
            'success' => true,
            'restaurant' => $restaurant,
        ]);
    }

    public function updateRestaurant(Request $request)
    {
        $user = $request->user();

        if (!$user->isOwner()) {
            return response()->json([
                'success' => false,
                'message' => 'רק בעל המסעדה יכול לעדכן פרטים',
            ], 403);
        }

        $restaurant = Restaurant::findOrFail($user->restaurant_id);

        // 🔍 DEBUG - מה מגיע מהפרונט
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
            'phone' => 'sometimes|string|max:20',
            'address' => 'sometimes|string|max:255',
            'city' => 'sometimes|string|max:255',
            'is_open' => 'sometimes',
            'operating_days' => 'nullable|string',
            'operating_hours' => 'nullable|string',
            'logo' => 'nullable|image|mimes:jpeg,png,jpg,webp|max:2048',
        ]);

        if ($request->hasFile('logo')) {
            if ($restaurant->logo_url) {
                $this->deleteImage($restaurant->logo_url);
            }
            $restaurant->logo_url = $this->uploadImage($request->file('logo'), 'logos');
        }

        // המר את is_open לבוליאן
        $isOpen = $request->input('is_open');
        if ($isOpen !== null && $isOpen !== '') {
            // תמיד המר ל-boolean
            if ($isOpen === '1' || $isOpen === 1 || $isOpen === true) {
                $isOpen = true;
            } elseif ($isOpen === '0' || $isOpen === 0 || $isOpen === false) {
                $isOpen = false;
            } else {
                $isOpen = (bool) $isOpen;
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

        if ($request->filled('city')) {
            $updateData['city'] = $validated['city'];
        }

        // אם נשלח is_open, השתמש בערך שנשלח (כפיית ידנית)
        $hasExplicitIsOpen = $request->has('is_open') && $request->filled('is_open');
        if ($hasExplicitIsOpen) {
            $updateData['is_open'] = $isOpen;
            $updateData['is_override_status'] = true;
            Log::debug('🔒 Override status to: ' . ($isOpen ? 'true' : 'false'));
        } else {
            $updateData['is_override_status'] = false;
            Log::debug('📅 Will calculate status from operating hours/days');
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
                if (is_array($operatingHours) && isset($operatingHours['open']) && isset($operatingHours['close'])) {
                    $updateData['operating_hours'] = $operatingHours;
                }
            } catch (\Exception $e) {
                // אם לא ניתן לפרסר, השאר את הערך הקודם
            }
        }

        // חשב סטטוס פתיחה אוטומטי בהתאם לימים ושעות רק אם לא כפינו ידנית
        if (!$hasExplicitIsOpen && (isset($updateData['operating_days']) || isset($updateData['operating_hours']))) {
            $operatingDays = $updateData['operating_days'] ?? $restaurant->operating_days ?? [];
            $operatingHours = $updateData['operating_hours'] ?? $restaurant->operating_hours ?? [];

            $calculated = $this->isRestaurantOpen($operatingDays, $operatingHours);
            $updateData['is_open'] = $calculated;
            Log::debug('📅 Calculated status: ' . ($calculated ? 'true' : 'false'));
        }

        Log::info('Final Update Data', [
            'updateData' => $updateData,
            'isEmpty' => empty($updateData),
        ]);

        // 🛡️ הגנה אחרונה - סנן null מכל השדות הקריטיים
        $updateData = array_filter($updateData, function ($value, $key) {
            // אפשר null רק לשדות שיכולים להיות ריקים
            $nullableFields = ['description', 'address', 'logo_url'];
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

    // =============================================
    // ניהול עובדים
    // =============================================

    public function getEmployees(Request $request)
    {
        $user = $request->user();

        if (!$user->isManager()) {
            return response()->json([
                'success' => false,
                'message' => 'אין לך הרשאה לצפות בעובדים',
            ], 403);
        }

        $employees = User::where('restaurant_id', $user->restaurant_id)
            ->orderBy('role')
            ->orderBy('name')
            ->get(['id', 'name', 'email', 'phone', 'role', 'is_active', 'created_at']);

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

        // מנהל לא יכול לשנות בעל מסעדה
        if ($employee->role === 'owner' && !$currentUser->isOwner()) {
            return response()->json([
                'success' => false,
                'message' => 'אין לך הרשאה לעדכן בעל מסעדה',
            ], 403);
        }

        $request->validate([
            'name' => 'sometimes|string|max:255',
            'phone' => 'nullable|string|max:20',
            'role' => 'sometimes|in:manager,employee,delivery',
            'is_active' => 'sometimes|boolean',
        ]);

        $employee->update($request->only(['name', 'phone', 'role', 'is_active']));

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
        $query = Order::where('restaurant_id', $user->restaurant_id)
            ->with('items.menuItem');

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
        $order = Order::where('restaurant_id', $user->restaurant_id)
            ->findOrFail($id);

        $request->validate([
            'status' => 'required|in:pending,received,preparing,ready,delivering,delivered,cancelled',
        ]);

        $order->status = $request->status;
        $order->updated_by_name = $user->name;
        $order->updated_by_user_id = $user->id;
        $order->save();

        return response()->json([
            'success' => true,
            'message' => 'סטטוס ההזמנה עודכן!',
            'order' => $order->load('items.menuItem'),
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
        $hebrewDays = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
        $currentDayName = $hebrewDays[$now->dayOfWeek];

        // בדוק אם היום הנוכחי הוא יום פתיחה
        if (!empty($operatingDays) && !($operatingDays[$currentDayName] ?? false)) {
            return false;
        }

        // אם אין שעות מוגדרות, המסעדה פתוחה ביום זה
        if (empty($operatingHours)) {
            return true;
        }

        // בדוק אם השעה הנוכחית בתוך שעות הפתיחה
        $currentTime = $now->format('H:i');
        $open = $operatingHours['open'] ?? '00:00';
        $close = $operatingHours['close'] ?? '23:59';

        // אם שעת הסגירה קטנה משעת הפתיחה (פתוח בין לילה), צריך טיפול מיוחד
        if ($close < $open) {
            // פתוח מ-open עד חצות, ומחצות עד close
            return $currentTime >= $open || $currentTime <= $close;
        }

        // טיפול רגיל
        return $currentTime >= $open && $currentTime <= $close;
    }
}

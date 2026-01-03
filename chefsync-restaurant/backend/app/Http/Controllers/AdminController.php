<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\MenuItem;
use App\Models\Category;
use App\Models\Order;
use App\Models\Restaurant;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
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
                ->whereIn('status', ['pending', 'preparing'])
                ->count(),
            'revenue_today' => Order::where('restaurant_id', $restaurantId)
                ->whereDate('created_at', today())
                ->where('status', '!=', 'cancelled')
                ->sum('total'),
            'revenue_week' => Order::where('restaurant_id', $restaurantId)
                ->whereBetween('created_at', [now()->startOfWeek(), now()->endOfWeek()])
                ->where('status', '!=', 'cancelled')
                ->sum('total'),
            'menu_items' => MenuItem::where('restaurant_id', $restaurantId)->count(),
            'categories' => Category::where('restaurant_id', $restaurantId)->count(),
            'employees' => User::where('restaurant_id', $restaurantId)->count(),
        ];

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
        $maxOrder = Category::where('restaurant_id', $user->restaurant_id)->max('sort_order') ?? 0;

        $category = Category::create([
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
        $query = MenuItem::where('restaurant_id', $user->restaurant_id)
            ->with('category');

        if ($request->has('category_id')) {
            $query->where('category_id', $request->category_id);
        }

        $items = $query->orderBy('category_id')->orderBy('sort_order')->get();

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

        $request->validate([
            'name' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'phone' => 'sometimes|string|max:20',
            'address' => 'sometimes|string|max:255',
            'is_open' => 'sometimes|boolean',
            'logo' => 'nullable|image|mimes:jpeg,png,jpg,webp|max:2048',
        ]);

        if ($request->hasFile('logo')) {
            if ($restaurant->logo_url) {
                $this->deleteImage($restaurant->logo_url);
            }
            $restaurant->logo_url = $this->uploadImage($request->file('logo'), 'logos');
        }

        $restaurant->update($request->only(['name', 'description', 'phone', 'address', 'is_open']));

        return response()->json([
            'success' => true,
            'message' => 'פרטי המסעדה עודכנו בהצלחה!',
            'restaurant' => $restaurant,
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
            'status' => 'required|in:pending,preparing,ready,delivering,delivered,cancelled',
        ]);

        $order->status = $request->status;
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
}

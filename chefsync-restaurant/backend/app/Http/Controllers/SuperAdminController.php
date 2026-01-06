<?php

namespace App\Http\Controllers;

use App\Models\Restaurant;
use App\Models\User;
use App\Models\Order;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;

/**
 * SuperAdminController - ניהול מערכת כללי
 * 
 * דורש הרשאת super_admin
 */
class SuperAdminController extends Controller
{
    /**
     * דשבורד Super Admin - סטטיסטיקות כלליות
     */
    public function dashboard(Request $request)
    {
        $user = $request->user();

        // סטטיסטיקות כלליות
        $stats = [
            'total_restaurants' => Restaurant::count(),
            'active_restaurants' => Restaurant::where('is_open', true)->count(),
            'total_orders' => Order::count(),
            'total_revenue' => Order::whereIn('status', ['delivered', 'ready'])->sum('total_amount'),
            'orders_today' => Order::whereDate('created_at', today())->count(),
            'revenue_today' => Order::whereDate('created_at', today())
                ->whereIn('status', ['delivered', 'ready'])
                ->sum('total_amount'),
        ];

        // מסעדות לפי סטטוס
        $restaurantsByStatus = [
            'active' => Restaurant::where('is_open', true)->count(),
            'inactive' => Restaurant::where('is_open', false)->count(),
        ];

        // הזמנות לפי סטטוס
        $ordersByStatus = Order::select('status', DB::raw('count(*) as count'))
            ->groupBy('status')
            ->pluck('count', 'status');

        return response()->json([
            'success' => true,
            'data' => [
                'stats' => $stats,
                'restaurants_by_status' => $restaurantsByStatus,
                'orders_by_status' => $ordersByStatus,
            ],
        ]);
    }

    /**
     * רשימת כל המסעדות
     */
    public function listRestaurants(Request $request)
    {
        $query = Restaurant::withCount(['orders', 'categories', 'menuItems']);

        // סינון לפי סטטוס
        if ($request->has('status')) {
            if ($request->status === 'active') {
                $query->where('is_open', true);
            } elseif ($request->status === 'inactive') {
                $query->where('is_open', false);
            }
        }

        // חיפוש
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('tenant_id', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%");
            });
        }

        $restaurants = $query->orderBy('created_at', 'desc')->paginate(20);

        // הוספת נתוני הכנסות לכל מסעדה
        $restaurants->getCollection()->transform(function ($restaurant) {
            $restaurant->total_revenue = Order::where('restaurant_id', $restaurant->id)
                ->whereIn('status', ['delivered', 'ready'])
                ->sum('total_amount');
            $restaurant->orders_count = Order::where('restaurant_id', $restaurant->id)->count();
            return $restaurant;
        });

        return response()->json([
            'success' => true,
            'restaurants' => $restaurants,
        ]);
    }

    /**
     * פרטי מסעדה ספציפית
     */
    public function getRestaurant($id)
    {
        $restaurant = Restaurant::withCount(['orders', 'categories', 'menuItems'])->findOrFail($id);

        // נתוני הכנסות
        $restaurant->total_revenue = Order::where('restaurant_id', $restaurant->id)
            ->whereIn('status', ['delivered', 'ready'])
            ->sum('total_amount');

        // משתמשים של המסעדה
        $restaurant->users = User::where('restaurant_id', $restaurant->id)
            ->select('id', 'name', 'email', 'phone', 'role', 'is_active')
            ->get();

        return response()->json([
            'success' => true,
            'restaurant' => $restaurant,
        ]);
    }

    /**
     * יצירת מסעדה חדשה
     */
    public function createRestaurant(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'tenant_id' => 'required|string|max:255|unique:restaurants,tenant_id|regex:/^[a-z0-9-]+$/',
            'phone' => 'required|string|max:20',
            'address' => 'nullable|string',
            'description' => 'nullable|string',
            'logo_url' => 'nullable|url',

            // פרטי בעל המסעדה
            'owner_name' => 'required|string|max:255',
            'owner_email' => 'required|email|unique:users,email',
            'owner_phone' => 'required|string|max:20',
            'owner_password' => 'nullable|string|min:6',
        ]);

        DB::beginTransaction();
        try {
            // יצירת המסעדה
            $restaurant = Restaurant::create([
                'tenant_id' => $validated['tenant_id'],
                'name' => $validated['name'],
                'slug' => Str::slug($validated['name']),
                'phone' => $validated['phone'],
                'address' => $validated['address'] ?? null,
                'description' => $validated['description'] ?? null,
                'logo_url' => $validated['logo_url'] ?? null,
                'is_open' => false, // כברירת מחדל סגור עד שיסיימו הגדרה
            ]);

            // יצירת משתמש בעלים
            $password = $validated['owner_password'] ?? Str::random(10);
            $owner = User::create([
                'restaurant_id' => $restaurant->id,
                'name' => $validated['owner_name'],
                'email' => $validated['owner_email'],
                'phone' => $validated['owner_phone'],
                'password' => Hash::make($password),
                'role' => 'owner',
                'is_active' => true,
            ]);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'מסעדה נוצרה בהצלחה!',
                'restaurant' => $restaurant,
                'owner' => [
                    'id' => $owner->id,
                    'name' => $owner->name,
                    'email' => $owner->email,
                    'temporary_password' => $validated['owner_password'] ?? $password,
                ],
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            \Log::error('Restaurant creation error: ' . $e->getMessage(), [
                'exception' => $e,
                'validated_data' => $validated,
            ]);
            return response()->json([
                'success' => false,
                'message' => 'שגיאה ביצירת המסעדה: ' . $e->getMessage(),
                'error_detail' => env('APP_DEBUG') ? $e->getMessage() : null,
            ], 500);
        }
    }

    /**
     * עדכון מסעדה
     */
    public function updateRestaurant(Request $request, $id)
    {
        $restaurant = Restaurant::findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'tenant_id' => 'sometimes|string|max:255|unique:restaurants,tenant_id,' . $id . '|regex:/^[a-z0-9-]+$/',
            'phone' => 'sometimes|string|max:20',
            'address' => 'nullable|string',
            'description' => 'nullable|string',
            'logo_url' => 'nullable|url',
            'is_open' => 'sometimes|boolean',
        ]);

        $restaurant->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'המסעדה עודכנה בהצלחה!',
            'restaurant' => $restaurant,
        ]);
    }

    /**
     * מחיקת מסעדה (soft delete או hard delete)
     */
    public function deleteRestaurant($id)
    {
        $restaurant = Restaurant::findOrFail($id);

        // בדיקה אם יש הזמנות פעילות
        $activeOrders = Order::where('restaurant_id', $id)
            ->whereIn('status', ['pending', 'received', 'preparing', 'ready', 'delivering'])
            ->count();

        if ($activeOrders > 0) {
            return response()->json([
                'success' => false,
                'message' => 'לא ניתן למחוק מסעדה עם הזמנות פעילות',
            ], 400);
        }

        $restaurant->delete();

        return response()->json([
            'success' => true,
            'message' => 'המסעדה נמחקה בהצלחה!',
        ]);
    }

    /**
     * החלפת סטטוס מסעדה (פעיל/לא פעיל)
     */
    public function toggleRestaurantStatus($id)
    {
        $restaurant = Restaurant::findOrFail($id);
        $restaurant->is_open = !$restaurant->is_open;
        $restaurant->save();

        return response()->json([
            'success' => true,
            'message' => 'סטטוס המסעדה עודכן!',
            'restaurant' => $restaurant,
        ]);
    }

    /**
     * סטטיסטיקות מסעדה ספציפית
     */
    public function getRestaurantStats($id)
    {
        $restaurant = Restaurant::findOrFail($id);

        $stats = [
            'total_orders' => Order::where('restaurant_id', $id)->count(),
            'total_revenue' => Order::where('restaurant_id', $id)
                ->whereIn('status', ['delivered', 'ready'])
                ->sum('total_amount'),
            'orders_today' => Order::where('restaurant_id', $id)
                ->whereDate('created_at', today())
                ->count(),
            'revenue_today' => Order::where('restaurant_id', $id)
                ->whereDate('created_at', today())
                ->whereIn('status', ['delivered', 'ready'])
                ->sum('total_amount'),
            'orders_by_status' => Order::where('restaurant_id', $id)
                ->select('status', DB::raw('count(*) as count'))
                ->groupBy('status')
                ->pluck('count', 'status'),
            'menu_items_count' => $restaurant->menuItems()->count(),
            'categories_count' => $restaurant->categories()->count(),
        ];

        return response()->json([
            'success' => true,
            'stats' => $stats,
        ]);
    }
}

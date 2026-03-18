<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use App\Models\CustomerFavorite;
use App\Models\Order;
use App\Models\MenuItem;
use App\Models\Restaurant;
use Illuminate\Http\Request;

class CustomerController extends Controller
{
    /**
     * היסטוריית הזמנות הלקוח (כל המסעדות)
     */
    public function orderHistory(Request $request)
    {
        $customer = $request->customer;

        $orders = Order::withoutGlobalScope('tenant')
            ->where(function ($q) use ($customer) {
                $q->where('customer_id', $customer->id);
                if (!empty($customer->phone)) {
                    $q->orWhere('customer_phone', $customer->phone);
                }
            })
            ->with(['items' => function ($q) {
                $q->with('menuItem:id,name,image_url');
            }])
            ->orderByDesc('created_at')
            ->paginate(20);

        // מצרף שם מסעדה לכל הזמנה
        $restaurantIds = $orders->pluck('restaurant_id')->unique();
        $restaurants = Restaurant::withoutGlobalScope('tenant')
            ->whereIn('id', $restaurantIds)
            ->get(['id', 'name', 'tenant_id', 'logo_url'])
            ->keyBy('id');

        $items = $orders->getCollection()->map(function ($order) use ($restaurants) {
            $restaurant = $restaurants[$order->restaurant_id] ?? null;
            return [
                'id' => $order->id,
                'restaurant_name' => $restaurant?->name,
                'restaurant_tenant_id' => $restaurant?->tenant_id,
                'restaurant_logo_url' => $restaurant?->logo_url,
                'status' => $order->status,
                'cancellation_reason' => $order->cancellation_reason,
                'total_amount' => $order->total_amount,
                'delivery_method' => $order->delivery_method,
                'created_at' => $order->created_at->toIso8601String(),
                'items' => $order->items->map(fn($item) => [
                    'name' => $item->menuItem?->name ?? $item->category_name,
                    'quantity' => $item->quantity,
                    'price_at_order' => $item->price_at_order,
                    'image_url' => $item->menuItem?->image_url,
                    'menu_item_id' => $item->menu_item_id,
                    'variant_name' => $item->variant_name,
                    'is_gift' => $item->is_gift,
                ]),
            ];
        });

        return response()->json([
            'success' => true,
            'data' => $items,
            'meta' => [
                'current_page' => $orders->currentPage(),
                'last_page' => $orders->lastPage(),
                'total' => $orders->total(),
            ],
        ]);
    }

    /**
     * מועדפים — רשימת פריטים
     */
    public function getFavorites(Request $request)
    {
        $customer = $request->customer;
        $tenantId = app()->has('tenant_id') ? app('tenant_id') : null;

        $query = CustomerFavorite::where('customer_id', $customer->id)
            ->with(['menuItem:id,name,price,image_url,category_id', 'restaurant:id,name,tenant_id']);

        if ($tenantId) {
            $restaurant = Restaurant::where('tenant_id', $tenantId)->first();
            if ($restaurant) {
                $query->where('restaurant_id', $restaurant->id);
            }
        }

        $favorites = $query->get()->map(fn($fav) => [
            'id' => $fav->id,
            'menu_item_id' => $fav->menu_item_id,
            'name' => $fav->menuItem?->name,
            'price' => $fav->menuItem?->price,
            'image_url' => $fav->menuItem?->image_url,
            'restaurant_name' => $fav->restaurant?->name,
            'restaurant_tenant_id' => $fav->restaurant?->tenant_id,
        ]);

        return response()->json([
            'success' => true,
            'data' => $favorites,
        ]);
    }

    /**
     * הוסף מועדף
     */
    public function addFavorite(Request $request)
    {
        $request->validate([
            'menu_item_id' => 'required|integer|exists:menu_items,id',
        ]);

        $customer = $request->customer;
        $menuItem = MenuItem::findOrFail($request->menu_item_id);

        CustomerFavorite::firstOrCreate([
            'customer_id' => $customer->id,
            'menu_item_id' => $menuItem->id,
        ], [
            'restaurant_id' => $menuItem->restaurant_id,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'נוסף למועדפים',
        ]);
    }

    /**
     * הסר מועדף
     */
    public function removeFavorite(Request $request, $menuItemId)
    {
        $customer = $request->customer;

        CustomerFavorite::where('customer_id', $customer->id)
            ->where('menu_item_id', $menuItemId)
            ->delete();

        return response()->json([
            'success' => true,
            'message' => 'הוסר מהמועדפים',
        ]);
    }

    /**
     * הזמנה חוזרת — מחזיר את פריטי ההזמנה בפורמט סל
     */
    public function reorder(Request $request, $orderId)
    {
        $customer = $request->customer;

        $order = Order::withoutGlobalScope('tenant')
            ->where('id', $orderId)
            ->where(function ($q) use ($customer) {
                $q->where('customer_id', $customer->id)
                    ->orWhere('customer_phone', $customer->phone);
            })
            ->with(['items' => function ($q) {
                $q->with('menuItem:id,name,price,image_url,is_available,category_id');
            }])
            ->first();

        if (!$order) {
            return response()->json([
                'success' => false,
                'message' => 'הזמנה לא נמצאה',
            ], 404);
        }

        $restaurant = Restaurant::withoutGlobalScope('tenant')
            ->find($order->restaurant_id);

        $cartItems = [];
        $unavailable = [];

        foreach ($order->items as $item) {
            if (!$item->menuItem || !$item->menuItem->is_available) {
                $unavailable[] = $item->menuItem?->name ?? 'פריט לא זמין';
                continue;
            }

            $cartItems[] = [
                'menu_item_id' => $item->menu_item_id,
                'name' => $item->menuItem->name,
                'price' => $item->menuItem->price,
                'image_url' => $item->menuItem->image_url,
                'quantity' => $item->quantity,
                'variant_id' => $item->variant_id,
                'variant_name' => $item->variant_name,
                'addons' => $item->addons ?? [],
            ];
        }

        return response()->json([
            'success' => true,
            'data' => [
                'restaurant_tenant_id' => $restaurant?->tenant_id,
                'restaurant_name' => $restaurant?->name,
                'items' => $cartItems,
                'unavailable' => $unavailable,
            ],
        ]);
    }
}

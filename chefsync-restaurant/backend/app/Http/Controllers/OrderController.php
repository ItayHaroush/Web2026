<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\MenuItem;
use App\Models\Restaurant;
use App\Models\FcmToken;
use App\Services\FcmService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * OrderController - ניהול הזמנות
 */
class OrderController extends Controller
{
    /**
     * צור הזמנה חדשה
     * 
     * בקשה:
     * {
     *   "customer_name": "דוד כהן",
     *   "customer_phone": "050-1234567",
     *   "items": [
     *     {"menu_item_id": 1, "quantity": 2},
     *     {"menu_item_id": 3, "quantity": 1}
     *   ]
     * }
     */
    public function store(Request $request)
    {
        try {
            $validated = $request->validate([
                'customer_name' => 'required|string|max:100',
                'customer_phone' => 'required|string|max:20',
                'delivery_method' => 'required|in:pickup,delivery',
                'payment_method' => 'required|in:cash',
                'delivery_address' => 'nullable|string|max:255',
                'delivery_notes' => 'nullable|string|max:500',
                'items' => 'required|array|min:1',
                'items.*.menu_item_id' => 'required|integer|exists:menu_items,id',
                'items.*.quantity' => 'required|integer|min:1',
            ]);

            Log::info('Order request received', [
                'delivery_method' => $validated['delivery_method'],
                'delivery_address' => $validated['delivery_address'] ?? null,
                'all_data' => $request->all()
            ]);

            if ($validated['delivery_method'] === 'delivery' && empty($validated['delivery_address'])) {
                return response()->json([
                    'success' => false,
                    'message' => 'נא להזין כתובת למשלוח',
                ], 422);
            }

            $tenantId = app('tenant_id');
            $restaurantId = Restaurant::where('tenant_id', $tenantId)->value('id');
            if (!$restaurantId) {
                throw new \Exception('Restaurant not found for tenant');
            }

            // צור את ההזמנה
            $order = Order::create([
                'tenant_id' => $tenantId,
                'restaurant_id' => $restaurantId,
                'customer_name' => $validated['customer_name'],
                'customer_phone' => $validated['customer_phone'],
                'delivery_method' => $validated['delivery_method'],
                'payment_method' => $validated['payment_method'],
                'delivery_address' => $validated['delivery_address'] ?? null,
                'delivery_notes' => $validated['delivery_notes'] ?? null,
                'status' => Order::STATUS_RECEIVED,
                'total_amount' => 0, // יחושב מיד אחרי
            ]);

            // הוסף פריטים להזמנה
            $totalAmount = 0;
            foreach ($validated['items'] as $itemData) {
                $menuItem = MenuItem::findOrFail($itemData['menu_item_id']);

                OrderItem::create([
                    'order_id' => $order->id,
                    'menu_item_id' => $menuItem->id,
                    'quantity' => $itemData['quantity'],
                    'price_at_order' => $menuItem->price,
                ]);

                $totalAmount += $menuItem->price * $itemData['quantity'];
            }

            // עדכן סכום ההזמנה
            $order->update(['total_amount' => $totalAmount]);

            // שליחת פוש לטאבלטים של המסעדה
            $this->sendOrderNotification(
                tenantId: $tenantId,
                title: config('push.messages.order_new.title'),
                body: config('push.messages.order_new.body'),
                data: ['orderId' => (string) $order->id]
            );

            return response()->json([
                'success' => true,
                'message' => 'הזמנה נקבלה בהצלחה',
                'data' => $order->load('items.menuItem'),
            ], 201);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'שגיאה בתקינות הנתונים',
                'errors' => $e->errors(),
            ], 422);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'שגיאה ביצירת הזמנה',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * קבל פרטי הזמנה לפי ID
     */
    public function show($id)
    {
        try {
            $tenantId = app('tenant_id');
            $order = Order::where('tenant_id', $tenantId)
                ->with('items.menuItem')
                ->findOrFail($id);

            return response()->json([
                'success' => true,
                'data' => $order,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'הזמנה לא נמצאה',
                'error' => $e->getMessage(),
            ], 404);
        }
    }

    /**
     * קבל הזמנות פעילות של המסעדה (לממשק מנהל)
     */
    public function restaurantIndex(Request $request)
    {
        try {
            $tenantId = app('tenant_id');
            $status = $request->query('status'); // סנן לפי סטטוס אם יש

            $query = Order::where('tenant_id', $tenantId)
                ->with('items.menuItem')
                ->orderBy('created_at', 'desc');

            if ($status) {
                $query->where('status', $status);
            }

            $orders = $query->paginate(20);

            return response()->json([
                'success' => true,
                'data' => $orders,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'שגיאה בטעינת הזמנות',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * עדכן סטטוס הזמנה
     * 
     * בקשה:
     * {
     *   "status": "preparing" // received, preparing, ready, delivered
     * }
     */
    public function updateStatus(Request $request, $id)
    {
        try {
            $validated = $request->validate([
                'status' => 'required|in:' . implode(',', Order::validStatuses()),
            ]);

            $tenantId = app('tenant_id');
            $order = Order::where('tenant_id', $tenantId)->findOrFail($id);

            $order->update(['status' => $validated['status']]);

            $statusMessages = config('push.messages.status');
            if (isset($statusMessages[$validated['status']])) {
                $message = $statusMessages[$validated['status']];
                $this->sendOrderNotification(
                    tenantId: $tenantId,
                    title: $message['title'],
                    body: $message['body'],
                    data: ['orderId' => (string) $order->id, 'status' => $validated['status']]
                );
            }

            return response()->json([
                'success' => true,
                'message' => 'סטטוס עודכן בהצלחה',
                'data' => $order,
            ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'סטטוס לא תקף',
                'errors' => $e->errors(),
            ], 422);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'שגיאה בעדכון הסטטוס',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    private function sendOrderNotification(string $tenantId, string $title, string $body, array $data = []): void
    {
        try {
            $tokens = FcmToken::where('tenant_id', $tenantId)->pluck('token');
            if ($tokens->isEmpty()) {
                return;
            }

            $fcm = app(FcmService::class);
            foreach ($tokens as $token) {
                $fcm->sendToToken($token, $title, $body, $data);
            }
        } catch (\Throwable $e) {
            Log::warning('Failed to send FCM notification', [
                'error' => $e->getMessage(),
            ]);
        }
    }
}

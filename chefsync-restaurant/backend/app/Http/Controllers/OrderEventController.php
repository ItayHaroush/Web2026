<?php

namespace App\Http\Controllers;

use App\Models\FcmToken;
use App\Models\Order;
use App\Models\OrderEvent;
use App\Models\SystemError;
use App\Services\FcmService;
use App\Services\OrderEventService;
use Carbon\Carbon;
use Illuminate\Http\Request;

class OrderEventController extends Controller
{
    private const STATUS_LABELS_HE = [
        Order::STATUS_AWAITING_PAYMENT => 'ממתין לתשלום',
        Order::STATUS_PENDING => 'ממתין',
        Order::STATUS_RECEIVED => 'התקבל',
        Order::STATUS_PREPARING => 'בהכנה',
        Order::STATUS_READY => 'מוכן',
        Order::STATUS_DELIVERING => 'במשלוח',
    ];

    private const NUDGE_EVENT_TYPES = [
        'super_admin_owner_nudge',
        'super_admin_owner_reminder',
    ];
    /**
     * Search order events
     */
    public function search(Request $request)
    {
        $validated = $request->validate([
            'order_id' => 'nullable|integer',
            'phone' => 'nullable|string',
            'transaction_id' => 'nullable|string',
            'correlation_id' => 'nullable|string',
            'tenant_id' => 'nullable|string',
            'event_type' => 'nullable|string',
            'from' => 'nullable|date',
            'to' => 'nullable|date',
        ]);

        $query = OrderEvent::query()->with('order:id,customer_name,customer_phone,status,total_amount,correlation_id,tenant_id');

        // Collect order IDs from various search criteria
        $orderIdFilters = [];

        if (! empty($validated['order_id'])) {
            $orderIdFilters[] = [(int) $validated['order_id']];
        }

        if (! empty($validated['phone'])) {
            $ids = Order::withoutGlobalScopes()
                ->where('customer_phone', 'like', '%'.$validated['phone'].'%')
                ->pluck('id')
                ->toArray();
            $orderIdFilters[] = $ids;
        }

        if (! empty($validated['transaction_id'])) {
            $ids = Order::withoutGlobalScopes()
                ->where('payment_transaction_id', $validated['transaction_id'])
                ->pluck('id')
                ->toArray();
            $orderIdFilters[] = $ids;
        }

        if (! empty($orderIdFilters)) {
            $matchedIds = $orderIdFilters[0];
            for ($i = 1; $i < count($orderIdFilters); $i++) {
                $matchedIds = array_intersect($matchedIds, $orderIdFilters[$i]);
            }
            $query->whereIn('order_id', $matchedIds);
        }

        if (! empty($validated['correlation_id'])) {
            $query->where('correlation_id', $validated['correlation_id']);
        }

        if (! empty($validated['tenant_id'])) {
            $query->where('tenant_id', $validated['tenant_id']);
        }

        if (! empty($validated['event_type'])) {
            $query->where('event_type', $validated['event_type']);
        }

        if (! empty($validated['from'])) {
            $query->where('created_at', '>=', $validated['from']);
        }

        if (! empty($validated['to'])) {
            $query->where('created_at', '<=', $validated['to']);
        }

        $events = $query->orderByDesc('created_at')->paginate(50);

        // If searching by order_id and no events found, still return the order info
        if ($events->isEmpty() && ! empty($validated['order_id'])) {
            $order = Order::withoutGlobalScopes()
                ->select('id', 'customer_name', 'customer_phone', 'status', 'total_amount', 'correlation_id', 'tenant_id', 'created_at')
                ->find($validated['order_id']);

            if ($order) {
                return response()->json([
                    'success' => true,
                    'data' => $events,
                    'order_found' => $order,
                    'message' => 'ההזמנה נמצאה אך אין אירועים מתועדים עבורה',
                ]);
            }
        }

        return response()->json([
            'success' => true,
            'data' => $events,
        ]);
    }

    /**
     * Open (incomplete) orders from the last N days, newest first.
     */
    public function openOrders(Request $request)
    {
        $validated = $request->validate([
            'days' => 'nullable|integer|min:1|max:30',
        ]);

        $days = (int) ($validated['days'] ?? 7);
        $from = Carbon::now()->subDays($days - 1)->startOfDay();

        $orders = Order::withoutGlobalScopes()
            ->where('created_at', '>=', $from)
            ->whereNotIn('status', [Order::STATUS_DELIVERED, Order::STATUS_CANCELLED])
            ->with('restaurant:id,name,tenant_id')
            ->orderByDesc('created_at')
            ->limit(500)
            ->get();

        $orderIds = $orders->pluck('id')->all();
        $nudgeEventsByOrder = collect();

        if (! empty($orderIds)) {
            $nudgeEventsByOrder = OrderEvent::query()
                ->whereIn('order_id', $orderIds)
                ->whereIn('event_type', self::NUDGE_EVENT_TYPES)
                ->orderByDesc('created_at')
                ->get()
                ->groupBy('order_id');
        }

        $now = Carbon::now();
        $mappedOrders = $orders->map(function ($order) use ($nudgeEventsByOrder, $now) {
            $restaurantHandled = ! in_array($order->status, [
                Order::STATUS_PENDING,
                Order::STATUS_AWAITING_PAYMENT,
            ], true);

            $lastNudge = $nudgeEventsByOrder->get($order->id)?->first();

            return [
                'id' => $order->id,
                'customer_name' => $order->customer_name,
                'customer_phone' => $order->customer_phone,
                'status' => $order->status,
                'payment_status' => $order->payment_status,
                'total_amount' => $order->total_amount,
                'delivery_method' => $order->delivery_method,
                'created_at' => $order->created_at,
                'updated_at' => $order->updated_at,
                'restaurant_id' => $order->restaurant_id,
                'restaurant_name' => $order->restaurant->name ?? null,
                'tenant_id' => $order->tenant_id,
                'correlation_id' => $order->correlation_id,
                'restaurant_handled' => $restaurantHandled,
                'minutes_open' => (int) $order->created_at->diffInMinutes($now),
                'minutes_in_status' => (int) $order->updated_at->diffInMinutes($now),
                'last_nudge_at' => $lastNudge?->created_at,
                'last_nudge_type' => $lastNudge?->event_type,
            ];
        });

        return response()->json([
            'success' => true,
            'data' => [
                'orders' => $mappedOrders,
                'from' => $from->toIso8601String(),
                'to' => $now->toIso8601String(),
                'total' => $mappedOrders->count(),
                'days' => $days,
            ],
        ]);
    }

    /**
     * Send push notification to restaurant staff about an open order.
     */
    public function nudgeRestaurantOwner(Request $request, int $orderId)
    {
        $order = Order::withoutGlobalScopes()
            ->with('restaurant:id,name,tenant_id')
            ->findOrFail($orderId);

        if (in_array($order->status, [Order::STATUS_DELIVERED, Order::STATUS_CANCELLED], true)) {
            return response()->json([
                'success' => false,
                'message' => 'ההזמנה כבר הסתיימה',
            ], 422);
        }

        $restaurantHandled = ! in_array($order->status, [
            Order::STATUS_PENDING,
            Order::STATUS_AWAITING_PAYMENT,
        ], true);

        $statusHe = self::STATUS_LABELS_HE[$order->status] ?? $order->status;
        $minutesInStatus = (int) $order->updated_at->diffInMinutes(now());
        $restaurantName = $order->restaurant->name ?? $order->tenant_id;
        $deliveryHe = $order->delivery_method === 'pickup' ? 'איסוף' : 'משלוח';

        if (! $restaurantHandled) {
            $eventType = 'super_admin_owner_nudge';
            $title = "הזמנה פתוחה #{$order->id} — {$restaurantName}";
            $body = "{$order->customer_name} | {$order->customer_phone} | ₪{$order->total_amount} | {$statusHe} | {$deliveryHe}";
        } else {
            $eventType = 'super_admin_owner_reminder';
            $title = "תזכורת: סיים טיפול #{$order->id} — {$restaurantName}";
            $body = "ההזמנה בסטטוס \"{$statusHe}\" כבר {$minutesInStatus} דקות | {$order->customer_name} | ₪{$order->total_amount}";
        }

        $tokens = FcmToken::withoutGlobalScopes()
            ->where('tenant_id', $order->tenant_id)
            ->pluck('token');

        if ($tokens->isEmpty()) {
            return response()->json([
                'success' => false,
                'message' => 'לא נמצאו מכשירים רשומים למסעדה זו',
            ], 422);
        }

        $fcm = app(FcmService::class);
        $sentOk = 0;
        foreach ($tokens as $token) {
            if ($fcm->sendToToken($token, $title, $body, [
                'type' => $eventType,
                'orderId' => (string) $order->id,
                'tenantId' => $order->tenant_id,
            ])) {
                $sentOk++;
            }
        }

        if ($sentOk === 0) {
            return response()->json([
                'success' => false,
                'message' => 'שליחת ההתראה נכשלה',
            ], 500);
        }

        OrderEventService::log(
            $order->id,
            $eventType,
            'super_admin',
            $request->user()?->id,
            [
                'title' => $title,
                'body' => $body,
                'tokens_targeted' => $tokens->count(),
                'tokens_sent_ok' => $sentOk,
                'restaurant_handled' => $restaurantHandled,
            ],
            $request
        );

        return response()->json([
            'success' => true,
            'message' => $restaurantHandled
                ? 'תזכורת לסיום טיפול נשלחה למסעדן'
                : 'התראה עם פרטי ההזמנה נשלחה למסעדן',
            'data' => [
                'event_type' => $eventType,
                'restaurant_handled' => $restaurantHandled,
                'tokens_sent_ok' => $sentOk,
            ],
        ]);
    }

    /**
     * Get timeline for a specific order
     */
    public function timeline($orderId)
    {
        $order = Order::withoutGlobalScopes()
            ->with('items.menuItem:id,name')
            ->findOrFail($orderId);

        $events = OrderEvent::forOrder($orderId)
            ->orderBy('created_at')
            ->get();

        return response()->json([
            'success' => true,
            'data' => [
                'order' => [
                    'id' => $order->id,
                    'correlation_id' => $order->correlation_id,
                    'tenant_id' => $order->tenant_id,
                    'customer_name' => $order->customer_name,
                    'customer_phone' => $order->customer_phone,
                    'status' => $order->status,
                    'payment_status' => $order->payment_status,
                    'total_amount' => $order->total_amount,
                    'delivery_method' => $order->delivery_method,
                    'created_at' => $order->created_at,
                    'items_count' => $order->items->count(),
                ],
                'events' => $events,
            ],
        ]);
    }

    /**
     * Get system errors
     */
    public function getSystemErrors(Request $request)
    {
        $query = SystemError::query();

        if ($request->has('severity')) {
            $query->where('severity', $request->severity);
        }

        $resolved = $request->query('resolved');
        if ($resolved === 'all') {
            // no filter
        } elseif ($resolved === null) {
            $query->where('resolved', false);
        } else {
            $query->where('resolved', filter_var($resolved, FILTER_VALIDATE_BOOLEAN));
        }

        if ($request->has('error_type')) {
            $query->where('error_type', $request->error_type);
        }

        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('message', 'like', "%{$search}%")
                    ->orWhere('error_type', 'like', "%{$search}%")
                    ->orWhere('correlation_id', $search);
            });
        }

        $errors = $query->orderByDesc('created_at')->paginate(50);

        return response()->json([
            'success' => true,
            'data' => $errors,
        ]);
    }

    /**
     * Resolve a system error
     */
    public function resolveError($id)
    {
        $error = SystemError::findOrFail($id);

        $error->update([
            'resolved' => true,
            'resolved_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'השגיאה סומנה כפתורה',
            'data' => $error,
        ]);
    }
}

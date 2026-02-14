<?php

namespace App\Http\Controllers;

use App\Models\OrderEvent;
use App\Models\SystemError;
use App\Models\Order;
use Illuminate\Http\Request;

class OrderEventController extends Controller
{
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

        if (!empty($validated['order_id'])) {
            $orderIdFilters[] = [(int) $validated['order_id']];
        }

        if (!empty($validated['phone'])) {
            $ids = Order::withoutGlobalScopes()
                ->where('customer_phone', 'like', '%' . $validated['phone'] . '%')
                ->pluck('id')
                ->toArray();
            $orderIdFilters[] = $ids;
        }

        if (!empty($validated['transaction_id'])) {
            $ids = Order::withoutGlobalScopes()
                ->where('payment_transaction_id', $validated['transaction_id'])
                ->pluck('id')
                ->toArray();
            $orderIdFilters[] = $ids;
        }

        if (!empty($orderIdFilters)) {
            $matchedIds = $orderIdFilters[0];
            for ($i = 1; $i < count($orderIdFilters); $i++) {
                $matchedIds = array_intersect($matchedIds, $orderIdFilters[$i]);
            }
            $query->whereIn('order_id', $matchedIds);
        }

        if (!empty($validated['correlation_id'])) {
            $query->where('correlation_id', $validated['correlation_id']);
        }

        if (!empty($validated['tenant_id'])) {
            $query->where('tenant_id', $validated['tenant_id']);
        }

        if (!empty($validated['event_type'])) {
            $query->where('event_type', $validated['event_type']);
        }

        if (!empty($validated['from'])) {
            $query->where('created_at', '>=', $validated['from']);
        }

        if (!empty($validated['to'])) {
            $query->where('created_at', '<=', $validated['to']);
        }

        $events = $query->orderByDesc('created_at')->paginate(50);

        // If searching by order_id and no events found, still return the order info
        if ($events->isEmpty() && !empty($validated['order_id'])) {
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

        if ($request->has('resolved') && $request->resolved !== '') {
            $query->where('resolved', filter_var($request->resolved, FILTER_VALIDATE_BOOLEAN));
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

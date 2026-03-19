<?php

namespace App\Http\Controllers;

use App\Models\CartSession;
use App\Models\Restaurant;
use Carbon\Carbon;
use Illuminate\Http\Request;

class SuperAdminCartSessionsController extends Controller
{
    /**
     * GET /super-admin/cart-sessions
     * סלים פתוחים, נשלחו תזכורת, והזמנות שנצלו
     */
    public function index(Request $request)
    {
        $validated = $request->validate([
            'status' => 'nullable|string|in:open,reminded,converted,all',
            'restaurant_id' => 'nullable|integer|exists:restaurants,id',
            'month' => 'nullable|string|regex:/^\d{4}-\d{2}$/',
        ]);

        $status = $validated['status'] ?? 'all';
        $restaurantId = $validated['restaurant_id'] ?? null;
        $month = $validated['month'] ?? now()->format('Y-m');

        $query = CartSession::with('restaurant:id,name,tenant_id')
            ->with('order:id,total_amount,created_at')
            ->where(function ($q) {
                $q->whereNotNull('customer_phone')->where('customer_phone', '!=', '')
                    ->orWhereNotNull('customer_id');
            });

        if ($restaurantId) {
            $query->where('restaurant_id', $restaurantId);
        }

        switch ($status) {
            case 'open':
                $query->whereNull('reminded_at')
                    ->whereNull('completed_order_id')
                    ->where('updated_at', '>=', now()->subHours(24));
                break;
            case 'reminded':
                $query->whereNotNull('reminded_at')
                    ->whereNull('completed_order_id');
                if ($month) {
                    $start = Carbon::parse($month . '-01')->startOfMonth();
                    $end = (clone $start)->endOfMonth();
                    $query->whereBetween('reminded_at', [$start, $end]);
                }
                break;
            case 'converted':
                $query->whereNotNull('reminded_at')
                    ->whereNotNull('completed_order_id');
                if ($month) {
                    $start = Carbon::parse($month . '-01')->startOfMonth();
                    $end = (clone $start)->endOfMonth();
                    $query->whereBetween('reminded_at', [$start, $end]);
                }
                break;
        }

        $sessions = $query->orderByDesc('updated_at')->paginate(50);

        $sessions->getCollection()->transform(function (CartSession $session) {
            return [
                'id' => $session->id,
                'restaurant' => $session->restaurant ? [
                    'id' => $session->restaurant->id,
                    'name' => $session->restaurant->name,
                    'tenant_id' => $session->restaurant->tenant_id,
                ] : null,
                'customer_phone' => $this->maskPhone($session->customer_phone ?? ''),
                'customer_name' => $session->customer_name,
                'total_amount' => (float) $session->total_amount,
                'item_count' => is_array($session->cart_data) ? count($session->cart_data) : 0,
                'updated_at' => $session->updated_at?->toIso8601String(),
                'reminded_at' => $session->reminded_at?->toIso8601String(),
                'completed_order_id' => $session->completed_order_id,
                'order_total' => $session->order ? (float) $session->order->total_amount : null,
                'status' => $session->reminded_at
                    ? ($session->completed_order_id ? 'converted' : 'reminded')
                    : 'open',
            ];
        });

        return response()->json([
            'success' => true,
            'data' => $sessions,
        ]);
    }

    /**
     * מסעדות לdropdown לסינון
     */
    public function restaurants(Request $request)
    {
        $restaurants = Restaurant::orderBy('name')
            ->get(['id', 'name', 'tenant_id']);

        return response()->json([
            'success' => true,
            'restaurants' => $restaurants,
        ]);
    }

    private function maskPhone(string $phone): string
    {
        $digits = preg_replace('/\D/', '', $phone);
        $len = strlen($digits);
        if ($len >= 4) {
            return '05x-***-**' . substr($digits, -4);
        }
        return '05x-***-****';
    }
}

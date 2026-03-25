<?php

namespace App\Http\Controllers;

use App\Models\CartSession;
use App\Models\Restaurant;
use App\Services\PhoneValidationService;
use Illuminate\Http\Request;

class CartHeartbeatController extends Controller
{
    /**
     * שמירת/עדכון סל להמשך מעקב תזכורות סל נטוש
     */
    public function store(Request $request)
    {
        $tenantId = $request->header('X-Tenant-ID') ?? $request->input('tenant_id');
        if (!$tenantId) {
            return response()->json(['success' => false, 'message' => 'חסר מזהה מסעדה'], 422);
        }

        $restaurant = Restaurant::where('tenant_id', $tenantId)->first();
        if (!$restaurant) {
            return response()->json(['success' => false, 'message' => 'מסעדה לא נמצאה'], 404);
        }

        $validated = $request->validate([
            'cart' => 'required|array',
            'cart.*' => 'array',
            'customer_phone' => 'nullable|string|max:20',
            'customer_id' => 'nullable|integer|exists:customers,id',
            'customer_name' => 'nullable|string|max:100',
            'total_amount' => 'nullable|numeric|min:0',
        ]);

        $cart = $validated['cart'];
        $customerPhoneRaw = isset($validated['customer_phone']) ? trim((string) $validated['customer_phone']) : '';
        $customerPhone = $customerPhoneRaw !== '' ? $customerPhoneRaw : null;
        $normalizedPhone = $customerPhone ? PhoneValidationService::normalizeIsraeliMobileE164($customerPhone) : null;
        $storedPhone = $normalizedPhone ?? $customerPhone;
        $customerId = $validated['customer_id'] ?? null;
        $customerName = $validated['customer_name'] ?? null;

        // חישוב סכום אם לא סופק
        $totalAmount = $validated['total_amount'] ?? null;
        if ($totalAmount === null && is_array($cart)) {
            $totalAmount = 0;
            foreach ($cart as $item) {
                $totalAmount += (float) ($item['totalPrice'] ?? $item['total_price'] ?? (($item['unitPrice'] ?? $item['unit_price'] ?? 0) * ($item['qty'] ?? $item['quantity'] ?? 1)));
            }
        }
        $totalAmount = (float) ($totalAmount ?? 0);

        $query = CartSession::where('tenant_id', $tenantId)
            ->where('restaurant_id', $restaurant->id);

        // חייב טלפון או customer_id כדי לשלוח תזכורת
        if (!$storedPhone && !$customerId) {
            return response()->json(['success' => true]); // לא שומרים אורחים ללא מזהה
        }

        if ($customerId) {
            $query->where('customer_id', $customerId);
        } else {
            $query->whereNull('customer_id');
            if ($normalizedPhone) {
                $query->where(function ($q) use ($normalizedPhone, $customerPhone) {
                    $q->where('customer_phone', $normalizedPhone);
                    if ($customerPhone !== null && $customerPhone !== $normalizedPhone) {
                        $q->orWhere('customer_phone', $customerPhone);
                    }
                });
            } elseif ($customerPhone !== null) {
                $query->where('customer_phone', $customerPhone);
            }
        }

        $session = $query->first();

        $data = [
            'cart_data' => $cart,
            'customer_name' => $customerName,
            'total_amount' => $totalAmount,
        ];

        if ($session) {
            $session->update(array_merge($data, [
                'customer_phone' => $storedPhone ?? $session->customer_phone,
                'customer_id' => $customerId ?? $session->customer_id,
            ]));
        } else {
            CartSession::create([
                'tenant_id' => $tenantId,
                'restaurant_id' => $restaurant->id,
                'customer_phone' => $storedPhone,
                'customer_id' => $customerId,
                'customer_name' => $customerName,
                'cart_data' => $cart,
                'total_amount' => $totalAmount,
            ]);
        }

        return response()->json(['success' => true]);
    }
}

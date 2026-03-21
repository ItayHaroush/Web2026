<?php

namespace App\Services;

use App\Models\CashMovement;
use App\Models\CashRegisterShift;
use App\Models\Order;
use App\Models\Payment;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class PosPaymentService
{
    private ZCreditService $zcredit;

    public function __construct(ZCreditService $zcredit)
    {
        $this->zcredit = $zcredit;
    }

    /**
     * חיוב הזמנה קיימת בכרטיס אשראי דרך PinPad
     */
    public function chargeOrderCredit(int $orderId, float $amount, int $restaurantId, int $userId): array
    {
        $order = Order::withoutGlobalScopes()
            ->where('restaurant_id', $restaurantId)
            ->findOrFail($orderId);

        if ($order->payment_status === 'paid') {
            return [
                'success' => false,
                'message' => 'ההזמנה כבר שולמה',
            ];
        }

        // יצירת רשומת תשלום בסטטוס pending
        $payment = Payment::create([
            'order_id'      => $order->id,
            'restaurant_id' => $restaurantId,
            'provider'      => 'zcredit',
            'amount'        => $amount,
            'currency'      => 'ILS',
            'status'        => 'pending',
        ]);

        // שליחה ל-ZCredit PinPad
        $result = $this->zcredit->chargePinPad($amount, 'order_' . $orderId);

        if ($result['success']) {
            $data = $result['data'];

            DB::transaction(function () use ($payment, $order, $data, $restaurantId, $userId, $amount) {
                // עדכון רשומת תשלום
                $payment->update([
                    'status'            => 'approved',
                    'transaction_id'    => $data['transaction_id'],
                    'approval_code'     => $data['approval_code'],
                    'voucher_number'    => $data['voucher_number'],
                    'provider_response' => $data['full_response'],
                ]);

                // עדכון ההזמנה (אשראי — לרבות מוק Z-Credit)
                $order->update([
                    'payment_method'         => 'credit_card',
                    'payment_status'         => 'paid',
                    'payment_transaction_id' => $data['transaction_id'],
                    'paid_at'                => now(),
                ]);

                // רישום בקופה (cash movement מסוג credit)
                $shift = CashRegisterShift::where('restaurant_id', $restaurantId)
                    ->whereNull('closed_at')
                    ->first();

                if ($shift) {
                    CashMovement::create([
                        'shift_id'       => $shift->id,
                        'order_id'       => $order->id,
                        'user_id'        => $userId,
                        'type'           => 'payment',
                        'payment_method' => 'credit',
                        'amount'         => $amount,
                        'description'    => "הזמנה #{$order->id} — אשראי",
                    ]);
                }
            });

            return [
                'success' => true,
                'message' => 'התשלום אושר',
                'payment' => [
                    'id'              => $payment->id,
                    'status'          => 'approved',
                    'transaction_id'  => $data['transaction_id'],
                    'approval_code'   => $data['approval_code'],
                    'voucher_number'  => $data['voucher_number'],
                    'card_last4'      => $data['card_last4'] ?? null,
                    'card_brand'      => $data['card_brand'] ?? null,
                ],
            ];
        }

        // עסקה נדחתה
        $errorData = $result['data'];

        $payment->update([
            'status'            => 'declined',
            'error_message'     => $errorData['error_message'] ?? 'העסקה נדחתה',
            'provider_response' => $errorData['full_response'] ?? null,
        ]);

        return [
            'success' => false,
            'message' => $errorData['error_message'] ?? 'העסקה נדחתה',
            'payment' => [
                'id'           => $payment->id,
                'status'       => 'declined',
                'return_code'  => $errorData['return_code'] ?? null,
                'error'        => $errorData['error_message'] ?? null,
            ],
        ];
    }

    /**
     * יצירת הזמנת POS + חיוב מיידי באשראי דרך PinPad
     */
    public function createOrderAndCharge(array $orderData, int $restaurantId, string $tenantId, int $userId): array
    {
        // חישוב סכום
        $totalAmount = 0;
        foreach ($orderData['items'] as $item) {
            $totalAmount += $item['price'] * $item['quantity'];
            if (!empty($item['addons'])) {
                foreach ($item['addons'] as $addon) {
                    $totalAmount += ($addon['price'] ?? 0) * ($item['quantity'] ?? 1);
                }
            }
        }

        // יצירת הזמנה בסטטוס pending
        $order = Order::create([
            'restaurant_id'  => $restaurantId,
            'tenant_id'      => $tenantId,
            'correlation_id' => \Illuminate\Support\Str::uuid()->toString(),
            'customer_name'  => $orderData['customer_name'] ?? 'POS',
            'customer_phone' => '0000000000',
            'delivery_method' => 'pickup',
            'payment_method' => 'credit_card',
            'payment_status' => 'pending',
            'status'         => 'received',
            'total_amount'   => $totalAmount,
            'source'         => 'pos',
            'notes'          => $orderData['notes'] ?? null,
        ]);

        // יצירת פריטים
        foreach ($orderData['items'] as $item) {
            $addonTotal = 0;
            $addonsArray = [];
            if (!empty($item['addons'])) {
                foreach ($item['addons'] as $a) {
                    $addonTotal += ($a['price'] ?? 0);
                    $addonsArray[] = [
                        'name' => $a['name'] ?? '',
                        'price' => $a['price'] ?? 0,
                    ];
                }
            }
            $order->items()->create([
                'menu_item_id'  => $item['menu_item_id'],
                'quantity'      => $item['quantity'],
                'price_at_order' => $item['price'],
                'variant_name'  => $item['variant_name'] ?? null,
                'addons'        => !empty($addonsArray) ? $addonsArray : null,
                'addons_total'  => $addonTotal,
            ]);
        }

        // חיוב באשראי
        $chargeResult = $this->chargeOrderCredit($order->id, $totalAmount, $restaurantId, $userId);

        return array_merge($chargeResult, [
            'order_id' => $order->id,
            'total'    => $totalAmount,
        ]);
    }
}

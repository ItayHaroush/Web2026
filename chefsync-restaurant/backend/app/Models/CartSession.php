<?php

namespace App\Models;

use App\Services\PhoneValidationService;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CartSession extends Model
{
    protected $fillable = [
        'tenant_id',
        'restaurant_id',
        'customer_phone',
        'customer_id',
        'cart_data',
        'customer_name',
        'total_amount',
        'reminded_at',
        'completed_order_id',
    ];

    protected $casts = [
        'cart_data' => 'array',
        'total_amount' => 'decimal:2',
        'reminded_at' => 'datetime',
    ];

    public function restaurant(): BelongsTo
    {
        return $this->belongsTo(Restaurant::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class, 'completed_order_id');
    }

    /**
     * סימון סלי לקוח כהושלמו לאחר תשלום (או מזומן) — לא לפני אישור אשראי B2C.
     *
     * ההזמנה שומרת טלפון ב-E164; ה-heartbeat עלול לשמור פורמט גולמי (050…).
     * לכן משווים אחרי נרמול, ולא מסמנים סשן של לקוח רשום אחר עם אותו מספר.
     */
    public static function markCompletedForB2COrder(Order $order): void
    {
        $order = $order->fresh();
        $normalizedOrderPhone = PhoneValidationService::normalizeIsraeliMobileE164($order->customer_phone ?? '');

        $candidates = static::query()
            ->where('tenant_id', $order->tenant_id)
            ->where('restaurant_id', $order->restaurant_id)
            ->whereNull('completed_order_id')
            ->get();

        $ids = [];
        foreach ($candidates as $session) {
            if ($order->customer_id && $session->customer_id && (int) $session->customer_id === (int) $order->customer_id) {
                $ids[] = $session->id;
                continue;
            }

            if (!$normalizedOrderPhone || $session->customer_phone === null || $session->customer_phone === '') {
                continue;
            }

            $sessionNorm = PhoneValidationService::normalizeIsraeliMobileE164($session->customer_phone);
            if ($sessionNorm !== $normalizedOrderPhone) {
                continue;
            }

            if ($session->customer_id === null) {
                $ids[] = $session->id;
            }
        }

        $ids = array_values(array_unique($ids));
        if ($ids !== []) {
            static::whereIn('id', $ids)->update(['completed_order_id' => $order->id]);
        }
    }
}

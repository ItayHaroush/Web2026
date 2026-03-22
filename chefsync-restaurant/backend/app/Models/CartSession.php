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
     */
    public static function markCompletedForB2COrder(Order $order): void
    {
        $normalized = PhoneValidationService::normalizeIsraeliMobileE164($order->customer_phone ?? '');
        $q = static::query()
            ->where('tenant_id', $order->tenant_id)
            ->where('restaurant_id', $order->restaurant_id)
            ->whereNull('completed_order_id');

        $q->where(function ($sub) use ($order, $normalized) {
            if ($order->customer_id) {
                $sub->where('customer_id', $order->customer_id);
            }
            if ($normalized) {
                $sub->orWhere('customer_phone', $normalized);
            }
        });

        $q->update(['completed_order_id' => $order->id]);
    }
}

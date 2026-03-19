<?php

namespace App\Models;

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
}

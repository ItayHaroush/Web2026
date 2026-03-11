<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Payment extends Model
{
    protected $fillable = [
        'order_id',
        'restaurant_id',
        'provider',
        'amount',
        'currency',
        'status',
        'transaction_id',
        'approval_code',
        'voucher_number',
        'provider_response',
        'error_message',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'provider_response' => 'array',
    ];

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function restaurant(): BelongsTo
    {
        return $this->belongsTo(Restaurant::class);
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PaymentSession extends Model
{
    protected $fillable = [
        'tenant_id',
        'restaurant_id',
        'order_id',
        'session_token',
        'amount',
        'status',
        'hyp_transaction_id',
        'payment_url',
        'expires_at',
        'completed_at',
        'error_message',
    ];

    protected $casts = [
        'amount'       => 'decimal:2',
        'expires_at'   => 'datetime',
        'completed_at' => 'datetime',
    ];

    public function restaurant(): BelongsTo
    {
        return $this->belongsTo(Restaurant::class);
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function isExpired(): bool
    {
        return $this->status === 'expired' || ($this->expires_at && $this->expires_at->isPast());
    }
}

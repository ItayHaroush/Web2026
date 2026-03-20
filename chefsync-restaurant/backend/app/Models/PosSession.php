<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PosSession extends Model
{
    protected $fillable = [
        'user_id',
        'restaurant_id',
        'payment_terminal_id',
        'token',
        'expires_at',
        'locked_at',
    ];

    protected $casts = [
        'expires_at' => 'datetime',
        'locked_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function paymentTerminal(): BelongsTo
    {
        return $this->belongsTo(PaymentTerminal::class);
    }

    public function isValid(): bool
    {
        return $this->expires_at->isFuture() && is_null($this->locked_at);
    }
}

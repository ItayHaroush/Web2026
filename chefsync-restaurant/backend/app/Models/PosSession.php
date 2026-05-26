<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PosSession extends Model
{
    public const REVOKED_REASON_REPLACED = 'replaced_by_other_device';

    protected $fillable = [
        'user_id',
        'restaurant_id',
        'payment_terminal_id',
        'token',
        'expires_at',
        'locked_at',
        'revoked_at',
        'revoked_reason',
    ];

    protected $casts = [
        'expires_at' => 'datetime',
        'locked_at' => 'datetime',
        'revoked_at' => 'datetime',
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
        return $this->expires_at->isFuture()
            && is_null($this->locked_at)
            && is_null($this->revoked_at);
    }
}

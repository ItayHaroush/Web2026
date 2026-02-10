<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * PaymentVerification - לוג אימות מסופי תשלום
 */
class PaymentVerification extends Model
{
    protected $fillable = [
        'restaurant_id',
        'amount',
        'transaction_id',
        'status',
        'initiated_by',
        'error_message',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function restaurant(): BelongsTo
    {
        return $this->belongsTo(Restaurant::class);
    }
}

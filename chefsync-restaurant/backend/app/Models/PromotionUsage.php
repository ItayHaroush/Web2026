<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * דגם PromotionUsage - שימוש במבצע
 */
class PromotionUsage extends Model
{
    protected $table = 'promotion_usage';

    protected $fillable = [
        'promotion_id',
        'order_id',
        'customer_phone',
        'used_at',
    ];

    protected $casts = [
        'used_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function promotion(): BelongsTo
    {
        return $this->belongsTo(Promotion::class);
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }
}

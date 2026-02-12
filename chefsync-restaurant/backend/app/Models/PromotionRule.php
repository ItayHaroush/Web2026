<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * דגם PromotionRule - תנאי מבצע
 */
class PromotionRule extends Model
{
    protected $fillable = [
        'promotion_id',
        'required_category_id',
        'min_quantity',
    ];

    protected $casts = [
        'min_quantity' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function promotion(): BelongsTo
    {
        return $this->belongsTo(Promotion::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class, 'required_category_id');
    }
}

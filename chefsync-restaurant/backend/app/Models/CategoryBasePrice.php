<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CategoryBasePrice extends Model
{
    protected $fillable = [
        'category_id',
        'restaurant_variant_id',
        'tenant_id',
        'price_delta',
    ];

    protected $casts = [
        'price_delta' => 'decimal:2',
    ];

    protected static function booted()
    {
        static::addGlobalScope('tenant', function ($query) {
            if (app()->has('tenant_id')) {
                $query->where('tenant_id', app('tenant_id'));
            }
        });
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function variant(): BelongsTo
    {
        return $this->belongsTo(RestaurantVariant::class, 'restaurant_variant_id');
    }
}

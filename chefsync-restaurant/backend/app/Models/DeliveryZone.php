<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DeliveryZone extends Model
{
    protected $fillable = [
        'restaurant_id',
        'tenant_id',
        'city_id',
        'name',
        'polygon',
        'pricing_type',
        'fixed_fee',
        'per_km_fee',
        'tiered_fees',
        'is_active',
        'sort_order',
        'city_radius',
        'preview_image',
    ];

    protected $casts = [
        'polygon' => 'array',
        'tiered_fees' => 'array',
        'fixed_fee' => 'decimal:2',
        'per_km_fee' => 'decimal:2',
        'is_active' => 'boolean',
        'sort_order' => 'integer',
        'city_radius' => 'decimal:2',
    ];

    public function restaurant(): BelongsTo
    {
        return $this->belongsTo(Restaurant::class);
    }

    public function city(): BelongsTo
    {
        return $this->belongsTo(City::class);
    }

    protected static function booted()
    {
        static::addGlobalScope('tenant', function ($query) {
            if (app()->has('tenant_id')) {
                $query->where('tenant_id', app('tenant_id'));
            }
        });
    }
}

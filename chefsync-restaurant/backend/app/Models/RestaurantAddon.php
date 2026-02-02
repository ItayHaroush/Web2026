<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RestaurantAddon extends Model
{
    protected $fillable = [
        'addon_group_id',
        'restaurant_id',
        'tenant_id',
        'name',
        'price_delta',
        'selection_weight',
        'is_active',
        'category_ids',
        'sort_order',
    ];

    protected $casts = [
        'price_delta' => 'decimal:2',
        'is_active' => 'boolean',
        'category_ids' => 'array',
        'sort_order' => 'integer',
        'selection_weight' => 'integer',
    ];

    protected static function booted()
    {
        static::addGlobalScope('tenant', function ($query) {
            if (app()->has('tenant_id')) {
                $query->where('tenant_id', app('tenant_id'));
            }
        });
    }

    public function group(): BelongsTo
    {
        return $this->belongsTo(RestaurantAddonGroup::class, 'addon_group_id');
    }

    public function restaurant(): BelongsTo
    {
        return $this->belongsTo(Restaurant::class);
    }
}

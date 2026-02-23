<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class RestaurantAddonGroup extends Model
{
    protected $fillable = [
        'restaurant_id',
        'tenant_id',
        'name',
        'selection_type',
        'min_selections',
        'max_selections',
        'is_required',
        'is_active',
        'sort_order',
        'placement',
        'source_type',
        'source_category_id',
        'source_include_prices',
        'source_selection_weight',
    ];

    protected $casts = [
        'min_selections' => 'integer',
        'max_selections' => 'integer',
        'is_required' => 'boolean',
        'is_active' => 'boolean',
        'sort_order' => 'integer',
        'source_category_id' => 'integer',
        'source_include_prices' => 'boolean',
        'source_selection_weight' => 'integer',
    ];

    protected static function booted()
    {
        static::addGlobalScope('tenant', function ($query) {
            if (app()->has('tenant_id')) {
                $query->where('tenant_id', app('tenant_id'));
            }
        });
    }

    public function restaurant(): BelongsTo
    {
        return $this->belongsTo(Restaurant::class);
    }

    public function sourceCategory(): BelongsTo
    {
        return $this->belongsTo(Category::class, 'source_category_id');
    }

    public function addons(): HasMany
    {
        return $this->hasMany(RestaurantAddon::class, 'addon_group_id')->orderBy('sort_order');
    }
}

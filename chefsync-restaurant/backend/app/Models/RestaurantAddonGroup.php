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
        'source_addon_fixed_price',
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
        'source_addon_fixed_price' => 'decimal:2',
        'source_selection_weight' => 'integer',
    ];

    /**
     * מחיר תוספת סינתטית לפריט מקושר מקטגוריה: מחיר קבוע לקבוצה (אם הוגדר) או מחיר מהתפריט / 0
     */
    public function syntheticAddonPriceDelta(float $itemMenuPrice): float
    {
        if ($this->source_addon_fixed_price !== null) {
            return round((float) $this->source_addon_fixed_price, 2);
        }

        return ($this->source_include_prices ?? true) ? round($itemMenuPrice, 2) : 0.0;
    }

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

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * דגם Category - קטגוריות תפריט
 */
class Category extends Model
{
    protected $fillable = [
        'restaurant_id',
        'tenant_id',
        'name',
        'description',
        'icon',
        'sort_order',
        'is_active',
        'display_order',
        'dish_type',
        'dine_in_adjustment',
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'is_active' => 'boolean',
        'dine_in_adjustment' => 'decimal:2',
    ];

    /**
     * המסעדה בעלת הקטגוריה
     */
    public function restaurant(): BelongsTo
    {
        return $this->belongsTo(Restaurant::class);
    }

    /**
     * פריטי התפריט בקטגוריה זו
     */
    public function items(): HasMany
    {
        return $this->hasMany(MenuItem::class);
    }

    /**
     * מחירי בסיסים ספציפיים לקטגוריה
     */
    public function basePrices(): HasMany
    {
        return $this->hasMany(CategoryBasePrice::class);
    }

    /**
     * מדפסות המשויכות לקטגוריה
     */
    public function printers(): BelongsToMany
    {
        return $this->belongsToMany(Printer::class, 'printer_category');
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

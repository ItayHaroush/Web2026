<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;

/**
 * דגם MenuItem - פריטי תפריט
 */
class MenuItem extends Model
{
    protected $fillable = [
        'restaurant_id',
        'category_id',
        'tenant_id',
        'name',
        'description',
        'allergen_tags',        // אלרגנים במנה
        'price',
        'image_url',
        'is_available',
        'use_variants',
        'use_addons',
        'addons_group_scope',
        'max_addons',
        'dine_in_adjustment',
    ];

    protected $casts = [
        'price' => 'decimal:2',
        'is_available' => 'boolean',
        'use_variants' => 'boolean',
        'use_addons' => 'boolean',
        'max_addons' => 'integer',
        'allergen_tags' => 'array',  // JSON array של אלרגנים
        'dine_in_adjustment' => 'decimal:2',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * המסעדה שבעלותה הפריט
     */
    public function restaurant(): BelongsTo
    {
        return $this->belongsTo(Restaurant::class);
    }

    /**
     * הקטגוריה של הפריט
     */
    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    /**
     * הזמנות שמכילות את הפריט הזה
     */
    public function orderItems(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    /**
     * וריאציות זמינות עבור הפריט
     */
    public function variants(): HasMany
    {
        return $this->hasMany(MenuItemVariant::class)->orderBy('sort_order');
    }

    /**
     * קבוצות תוספות/סלטים של הפריט
     */
    public function addonGroups(): HasMany
    {
        return $this->hasMany(MenuItemAddonGroup::class)->orderBy('sort_order');
    }

    /**
     * חישוב התאמת מחיר לישיבה אפקטיבית: ברמת פריט אם קיים, אחרת ברמת קטגוריה, אחרת 0
     */
    public function getEffectiveDineInAdjustment(): float
    {
        if ($this->dine_in_adjustment !== null) {
            return (float) $this->dine_in_adjustment;
        }
        return (float) ($this->category?->dine_in_adjustment ?? 0);
    }

    protected static function booted()
    {
        static::addGlobalScope('tenant', function ($query) {
            if (app()->has('tenant_id')) {
                $query->where('tenant_id', app('tenant_id'));
            }
        });
    }

    /**
     * ודא שתמונת הפריט מוחזרת תמיד כ-URL מלא
     */
    public function getImageUrlAttribute($value)
    {
        if (!$value) {
            return null;
        }

        if (is_string($value) && (str_starts_with($value, 'http://') || str_starts_with($value, 'https://'))) {
            return $value;
        }

        $relative = str_starts_with($value, '/storage') ? $value : Storage::url($value);
        return URL::to($relative);
    }
}

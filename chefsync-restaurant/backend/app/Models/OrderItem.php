<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * דגם OrderItem - פריט בהזמנה
 */
class OrderItem extends Model
{
    protected $fillable = [
        'order_id',
        'menu_item_id',
        'category_id',
        'category_name',
        'variant_id',
        'variant_name',
        'variant_price_delta',
        'addons',
        'addons_total',
        'quantity',
        'price_at_order',
        'promotion_id',
        'is_gift',
        // Legacy / upcoming aliases to prevent mass-assignment failures in older deployments
        'addons_json',
        'unit_price',
        'total_price',
        'qty',
    ];

    protected $appends = ['price', 'subtotal', 'name'];

    protected $casts = [
        'price_at_order' => 'decimal:2',
        'variant_price_delta' => 'decimal:2',
        'addons' => 'array',
        'addons_total' => 'decimal:2',
        'category_id' => 'integer',
        'is_gift' => 'boolean',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Accessor לשדה price (עבור תאימות עם Frontend)
     */
    public function getPriceAttribute()
    {
        return $this->price_at_order;
    }

    /**
     * Accessor לשדה subtotal (מחיר כפול כמות)
     */
    public function getSubtotalAttribute()
    {
        return $this->price_at_order * $this->quantity;
    }

    /**
     * Accessor לשדה name (שם הפריט)
     */
    public function getNameAttribute()
    {
        return $this->menuItem ? $this->menuItem->name : 'פריט לא ידוע';
    }

    /**
     * ההזמנה שמכילה את הפריט
     */
    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    /**
     * פריט התפריט המקורי
     */
    public function menuItem(): BelongsTo
    {
        return $this->belongsTo(MenuItem::class);
    }

    /**
     * וריאציה שנבחרה (אם קיימת)
     */
    public function variant(): BelongsTo
    {
        return $this->belongsTo(MenuItemVariant::class, 'variant_id');
    }
}

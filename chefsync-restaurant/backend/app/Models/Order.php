<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * דגם Order - הזמנות
 */
class Order extends Model
{
    protected $fillable = [
        'restaurant_id',
        'tenant_id',
        'customer_name',
        'customer_phone',
        'status',
        'total_amount',
        'notes',
        'updated_by_name',
        'updated_by_user_id',
    ];

    protected $appends = ['total'];

    protected $casts = [
        'total_amount' => 'decimal:2',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Accessor לשדה total (עבור תאימות עם Frontend)
     */
    public function getTotalAttribute()
    {
        return $this->total_amount;
    }

    /**
     * סטטוסים אפשריים
     */
    const STATUS_PENDING = 'pending';        // ממתין
    const STATUS_RECEIVED = 'received';      // התקבלה
    const STATUS_PREPARING = 'preparing';    // בהכנה
    const STATUS_READY = 'ready';            // מוכנה
    const STATUS_DELIVERING = 'delivering';  // במשלוח
    const STATUS_DELIVERED = 'delivered';    // נמסרה
    const STATUS_CANCELLED = 'cancelled';    // בוטלה

    public static function validStatuses(): array
    {
        return [
            self::STATUS_PENDING,
            self::STATUS_RECEIVED,
            self::STATUS_PREPARING,
            self::STATUS_READY,
            self::STATUS_DELIVERING,
            self::STATUS_DELIVERED,
            self::STATUS_CANCELLED,
        ];
    }

    /**
     * המסעדה של ההזמנה
     */
    public function restaurant(): BelongsTo
    {
        return $this->belongsTo(Restaurant::class);
    }

    /**
     * פריטים בהזמנה
     */
    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    /**
     * חישוב הסכום הכללי מחדש
     */
    public function calculateTotal(): float
    {
        return $this->items()
            ->with('menuItem')
            ->get()
            ->sum(fn($item) => $item->menuItem->price * $item->quantity);
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

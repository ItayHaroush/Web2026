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
        'delivery_method',
        'payment_method',
        'delivery_address',
        'delivery_notes',
        'delivery_zone_id',
        'delivery_fee',
        'delivery_distance_km',
        'delivery_lat',
        'delivery_lng',
        'eta_minutes',
        'eta_note',
        'eta_updated_at',
        'status',
        'total_amount',
        'notes',
        'updated_by_name',
        'updated_by_user_id',
    ];

    protected $appends = ['total'];

    protected $casts = [
        'total_amount' => 'decimal:2',
        'delivery_fee' => 'decimal:2',
        'delivery_distance_km' => 'decimal:2',
        'delivery_lat' => 'decimal:7',
        'delivery_lng' => 'decimal:7',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'eta_updated_at' => 'datetime',
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
     * מפת מעברי סטטוס מותרים לפי סוג משלוח
     * 
     * @param string $currentStatus
     * @param string $deliveryMethod 'delivery' או 'pickup'
     * @return array רשימת סטטוסים מותרים למעבר
     */
    public static function getAllowedNextStatuses(string $currentStatus, string $deliveryMethod): array
    {
        // מעברים משותפים לכל סוג משלוח
        $commonTransitions = [
            self::STATUS_PENDING => [self::STATUS_RECEIVED, self::STATUS_PREPARING, self::STATUS_CANCELLED],
            self::STATUS_RECEIVED => [self::STATUS_PREPARING, self::STATUS_CANCELLED],
            self::STATUS_PREPARING => [self::STATUS_READY, self::STATUS_CANCELLED],
            self::STATUS_CANCELLED => [], // סטטוס סופי
        ];

        // מעברים ספציפיים למשלוח
        $deliveryTransitions = [
            self::STATUS_READY => [self::STATUS_DELIVERING, self::STATUS_CANCELLED],
            self::STATUS_DELIVERING => [self::STATUS_DELIVERED, self::STATUS_CANCELLED],
            self::STATUS_DELIVERED => [], // סטטוס סופי
        ];

        // מעברים ספציפיים לאיסוף עצמי (דילוג על delivering)
        $pickupTransitions = [
            self::STATUS_READY => [self::STATUS_DELIVERED, self::STATUS_CANCELLED],
            self::STATUS_DELIVERED => [], // סטטוס סופי
        ];

        $transitions = $commonTransitions;
        
        if ($deliveryMethod === 'delivery') {
            $transitions = array_merge($transitions, $deliveryTransitions);
        } else {
            $transitions = array_merge($transitions, $pickupTransitions);
        }

        return $transitions[$currentStatus] ?? [];
    }

    /**
     * בדיקה אם מעבר סטטוס מותר
     * 
     * @param string $newStatus
     * @return bool
     */
    public function canTransitionTo(string $newStatus): bool
    {
        $allowedStatuses = self::getAllowedNextStatuses($this->status, $this->delivery_method);
        return in_array($newStatus, $allowedStatuses);
    }

    /**
     * קבלת הסטטוס הבא המומלץ לפי סוג משלוח
     * 
     * @return string|null
     */
    public function getNextStatus(): ?string
    {
        $allowed = self::getAllowedNextStatuses($this->status, $this->delivery_method);
        
        // החזר את הסטטוס הראשון ברשימה (הכי הגיוני להמשך)
        // למעט cancelled שהוא תמיד אופציה אחרונה
        $allowed = array_filter($allowed, fn($status) => $status !== self::STATUS_CANCELLED);
        
        return $allowed[0] ?? null;
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

    public function deliveryZone(): BelongsTo
    {
        return $this->belongsTo(DeliveryZone::class, 'delivery_zone_id');
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
                $query->where('orders.tenant_id', app('tenant_id'));
            }
        });
    }
}

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
        'wolt_external_id',
        'name',
        'description',
        'tag',                  // תגית תצוגה (למשל: חדש, מומלץ, חריף)
        'allergen_tags',        // אלרגנים במנה
        'price',
        'image_url',
        'is_available',
        'is_active',
        'use_variants',
        'use_addons',
        'addons_group_scope',
        'max_addons',
        'dine_in_adjustment',
        'addon_selection_weight',  // משקל בחירה כשהפריט מוצג כתוספת מקושרת לקטגוריה (null=ברירת מחדל קבוצה)
        'availability_start_time', // שעת התחלת זמינות יומית (null = כל היום)
        'availability_end_time',   // שעת סיום זמינות יומית
        'availability_days',       // ימי זמינות בשבוע [0-6] (null = כל הימים)
    ];

    protected $casts = [
        'price' => 'decimal:2',
        'is_available' => 'boolean',
        'is_active' => 'boolean',
        'use_variants' => 'boolean',
        'use_addons' => 'boolean',
        'max_addons' => 'integer',
        'allergen_tags' => 'array',  // JSON array של אלרגנים
        'dine_in_adjustment' => 'decimal:2',
        'addon_selection_weight' => 'integer',
        'availability_days' => 'array',
        'wolt_external_id' => 'string',
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

    /**
     * האם יש לפריט חלון זמינות מוגדר (שעות/ימים)
     */
    public function hasAvailabilityWindow(): bool
    {
        return !empty($this->availability_start_time)
            || !empty($this->availability_end_time)
            || (is_array($this->availability_days) && count($this->availability_days) > 0);
    }

    /**
     * בדיקה האם הפריט זמין כעת לפי שעות וימים שהוגדרו.
     * מחזיר ['available' => bool, 'reason' => string|null]
     */
    public function checkCurrentAvailability(?\DateTimeInterface $now = null): array
    {
        $now = $now ?: now();

        // בדיקת ימים
        $days = $this->availability_days;
        if (is_array($days) && count($days) > 0) {
            $today = (int) $now->format('w'); // 0=Sunday
            if (!in_array($today, array_map('intval', $days), true)) {
                return [
                    'available' => false,
                    'reason' => 'הפריט אינו זמין היום',
                ];
            }
        }

        $start = $this->availability_start_time;
        $end = $this->availability_end_time;
        if (!$start && !$end) {
            return ['available' => true, 'reason' => null];
        }

        $current = $now->format('H:i:s');
        $startStr = $start ? substr((string) $start, 0, 8) : '00:00:00';
        $endStr = $end ? substr((string) $end, 0, 8) : '23:59:59';

        // טווח רגיל באותו יום
        if ($startStr <= $endStr) {
            $inRange = $current >= $startStr && $current <= $endStr;
        } else {
            // טווח שעובר חצות (למשל 22:00 - 02:00)
            $inRange = $current >= $startStr || $current <= $endStr;
        }

        if ($inRange) {
            return ['available' => true, 'reason' => null];
        }

        $startDisp = substr($startStr, 0, 5);
        $endDisp = substr($endStr, 0, 5);
        return [
            'available' => false,
            'reason' => "הפריט זמין בין {$startDisp} ל-{$endDisp}",
        ];
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

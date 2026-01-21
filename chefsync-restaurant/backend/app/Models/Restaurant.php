<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use App\Models\City;
use App\Models\RestaurantVariant;
use App\Models\RestaurantAddonGroup;

/**
 * דגם Restaurant (Tenant)
 * כל מסעדה היא Tenant נפרד במערכת
 */
class Restaurant extends Model
{
    protected $appends = [
        'is_open_now',
    ];

    protected $fillable = [
        'tenant_id',
        'name',
        'slug',
        'phone',
        'address',
        'city',
        'latitude',
        'longitude',
        'is_open',
        'is_approved',
        'has_delivery',
        'has_pickup',
        'is_override_status',
        'description',
        'logo_url',
        'operating_days',
        'operating_hours',
        'subscription_status',
        'trial_ends_at',
        'subscription_ends_at',
        'subscription_plan',
        'tranzila_terminal_name',
        'tranzila_token',
        'payment_method_last4',
        'payment_method_type',
        'monthly_price',
        'yearly_price',
        'last_payment_at',
        'next_payment_at',
        'share_incentive_text',
        'delivery_time_minutes',
        'delivery_time_note',
        'pickup_time_minutes',
        'pickup_time_note',
    ];

    protected $attributes = [
        'operating_days' => '{}',
        'operating_hours' => '{}',
        'subscription_status' => 'trial',
    ];

    protected $casts = [
        'is_open' => 'boolean',
        'is_approved' => 'boolean',
        'has_delivery' => 'boolean',
        'has_pickup' => 'boolean',
        'is_override_status' => 'boolean',
        'operating_days' => 'array',
        'operating_hours' => 'array',
        'trial_ends_at' => 'datetime',
        'subscription_ends_at' => 'datetime',
        'last_payment_at' => 'datetime',
        'next_payment_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'delivery_time_minutes' => 'integer',
        'pickup_time_minutes' => 'integer',
    ];

    /**
     * קטגוריות תפריט של המסעדה
     */
    public function categories(): HasMany
    {
        return $this->hasMany(Category::class, 'restaurant_id');
    }

    /**
     * פריטי תפריט
     */
    public function menuItems(): HasMany
    {
        return $this->hasMany(MenuItem::class, 'restaurant_id');
    }

    public function variants(): HasMany
    {
        return $this->hasMany(RestaurantVariant::class);
    }

    public function addonGroups(): HasMany
    {
        return $this->hasMany(RestaurantAddonGroup::class);
    }

    public function deliveryZones(): HasMany
    {
        return $this->hasMany(DeliveryZone::class)->orderBy('sort_order');
    }

    /**
     * הזמנות של המסעדה
     */
    public function orders(): HasMany
    {
        return $this->hasMany(Order::class, 'restaurant_id');
    }

    public function subscription(): HasOne
    {
        return $this->hasOne(RestaurantSubscription::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(RestaurantPayment::class);
    }

    /**
     * טענת מחדש - סנן לפי Tenant ID הנוכחי
     */
    protected static function booted()
    {
        static::addGlobalScope('tenant', function ($query) {
            if (app()->has('tenant_id')) {
                $query->where('tenant_id', app('tenant_id'));
            }
        });
    }

    /**
     * ודא שהלוגו מוחזר תמיד כ-URL מלא, גם אם נשמר כנתיב יחסי
     */
    public function getLogoUrlAttribute($value)
    {
        if (!$value) {
            return null;
        }

        // אם כבר URL מלא
        if (is_string($value) && (str_starts_with($value, 'http://') || str_starts_with($value, 'https://'))) {
            return $value;
        }

        // אם הערך מתחיל ב-/storage השתמש בו כפי שהוא, אחרת הפוך לנתיב storage דרך Storage::url
        $relative = str_starts_with($value, '/storage') ? $value : Storage::url($value);
        return URL::to($relative);
    }

    /**
     * ודא שהעיר מוחזרת תמיד בעברית. אם נשמר באנגלית, נמפה לשם העברי לפי טבלת הערים.
     */
    public function getCityAttribute($value)
    {
        if (!$value) {
            return null;
        }

        // אם הערך כבר בעברית (טווח יוניקוד עברי), החזר כפי שהוא
        if (preg_match('/[\x{0590}-\x{05FF}]/u', $value)) {
            return $value;
        }

        // טען מפה קבועה של עיר באנגלית -> שם עברי (בזיכרון סטטי למניעת פניות DB מרובות)
        static $cityMap = null;
        if ($cityMap === null) {
            $cityMap = [];
            foreach (City::all(['name', 'hebrew_name']) as $city) {
                if (!empty($city->name)) {
                    $cityMap[$city->name] = $city->hebrew_name ?: $city->name;
                }
                if (!empty($city->hebrew_name)) {
                    // גם אם נשלח עברית, ודא שמוחזר בשם העברי עצמו
                    $cityMap[$city->hebrew_name] = $city->hebrew_name;
                }
            }
        }

        return $cityMap[$value] ?? $value;
    }

    /**
     * בדיקה האם המסעדה בתקופת ניסיון
     */
    public function isOnTrial(): bool
    {
        return $this->subscription_status === 'trial'
            && $this->trial_ends_at
            && $this->trial_ends_at->isFuture();
    }

    /**
     * בדיקה האם המנוי פעיל
     */
    public function hasActiveSubscription(): bool
    {
        return $this->subscription_status === 'active'
            && (!$this->subscription_ends_at || $this->subscription_ends_at->isFuture());
    }

    /**
     * בדיקה האם יש גישה למערכת (ניסיון או מנוי פעיל)
     */
    public function hasAccess(): bool
    {
        return $this->isOnTrial() || $this->hasActiveSubscription();
    }

    /**
     * קבלת ימים שנותרו לניסיון
     */
    public function getDaysLeftInTrial(): int
    {
        if (!$this->isOnTrial()) {
            return 0;
        }

        return max(0, now()->diffInDays($this->trial_ends_at, false));
    }

    /**
     * קבלת ימים שנותרו למנוי
     */
    public function getDaysLeftInSubscription(): int
    {
        if (!$this->hasActiveSubscription() || !$this->subscription_ends_at) {
            return 0;
        }

        return max(0, now()->diffInDays($this->subscription_ends_at, false));
    }

    public function getIsOpenNowAttribute(): bool
    {
        if ($this->is_approved === false) {
            return false;
        }

        if ($this->is_override_status) {
            return (bool) $this->is_open;
        }

        return self::calculateIsOpen(
            $this->operating_days ?? [],
            $this->operating_hours ?? [],
        );
    }

    public static function calculateIsOpen(array $operatingDays = [], array $operatingHours = [], ?Carbon $now = null): bool
    {
        if (empty($operatingDays) && empty($operatingHours)) {
            return true;
        }

        $now = $now ?? Carbon::now('Asia/Jerusalem');
        $todayDate = $now->toDateString();
        $hebrewDays = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
        $currentDayName = $hebrewDays[$now->dayOfWeek] ?? null;

        $defaultHours = $operatingHours['default'] ?? $operatingHours;
        $specialDays = $operatingHours['special_days'] ?? [];
        $perDayOverrides = $operatingHours['days'] ?? [];

        // 1) יום מיוחד לפי תאריך גובר על הכל
        if (!empty($specialDays[$todayDate]) && is_array($specialDays[$todayDate])) {
            $special = $specialDays[$todayDate];
            if (!empty($special['closed'])) {
                return false;
            }
            $open = $special['open'] ?? ($defaultHours['open'] ?? '00:00');
            $close = $special['close'] ?? ($defaultHours['close'] ?? '23:59');
        }
        // 2) override שבועי ליום בשבוע (אם לא היה יום מיוחד)
        elseif ($currentDayName && !empty($perDayOverrides[$currentDayName]) && is_array($perDayOverrides[$currentDayName])) {
            $dayCfg = $perDayOverrides[$currentDayName];
            if (!empty($dayCfg['closed'])) {
                return false;
            }
            $open = $dayCfg['open'] ?? ($defaultHours['open'] ?? '00:00');
            $close = $dayCfg['close'] ?? ($defaultHours['close'] ?? '23:59');
        }
        // 3) ברירת מחדל: ימים + שעות כלליים
        else {
            if ($currentDayName && !empty($operatingDays) && !($operatingDays[$currentDayName] ?? false)) {
                return false;
            }

            if (empty($defaultHours) || !is_array($defaultHours)) {
                return true;
            }

            $open = $defaultHours['open'] ?? '00:00';
            $close = $defaultHours['close'] ?? '23:59';
        }

        $currentTime = $now->format('H:i');
        $open = is_string($open) ? $open : '00:00';
        $close = is_string($close) ? $close : '23:59';

        // אם שעת הסגירה קטנה משעת הפתיחה (פתוח בין לילה)
        if ($close < $open) {
            return $currentTime >= $open || $currentTime <= $close;
        }

        return $currentTime >= $open && $currentTime <= $close;
    }
}

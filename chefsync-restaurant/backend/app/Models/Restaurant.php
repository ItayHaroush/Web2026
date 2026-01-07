<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use App\Models\City;

/**
 * דגם Restaurant (Tenant)
 * כל מסעדה היא Tenant נפרד במערכת
 */
class Restaurant extends Model
{
    protected $fillable = [
        'tenant_id',
        'name',
        'slug',
        'phone',
        'address',
        'city',
        'is_open',
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
    ];

    protected $attributes = [
        'operating_days' => '{}',
        'operating_hours' => '{}',
        'subscription_status' => 'trial',
    ];

    protected $casts = [
        'is_open' => 'boolean',
        'is_override_status' => 'boolean',
        'operating_days' => 'array',
        'operating_hours' => 'array',
        'trial_ends_at' => 'datetime',
        'subscription_ends_at' => 'datetime',
        'last_payment_at' => 'datetime',
        'next_payment_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
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
}

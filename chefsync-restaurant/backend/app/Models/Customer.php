<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Customer extends Model
{
    protected $fillable = [
        'phone',
        'name',
        'user_id',
        'email',
        'email_verified_at',
        'email_verification_token',
        'google_id',
        'pin_hash',
        'password_hash',
        'default_delivery_address',
        'default_delivery_city',
        'default_delivery_street',
        'default_delivery_house_number',
        'default_delivery_lat',
        'default_delivery_lng',
        'default_delivery_notes',
        'preferred_payment_method',
        'is_registered',
        'last_order_at',
        'total_orders',
        'pwa_installed_at',
        'last_app_open_at',
        'push_opt_in_at',
        'push_permission',
    ];

    protected $hidden = [
        'pin_hash',
        'password_hash',
        'email_verification_token',
    ];

    protected $casts = [
        'is_registered' => 'boolean',
        'last_order_at' => 'datetime',
        'pwa_installed_at' => 'datetime',
        'last_app_open_at' => 'datetime',
        'push_opt_in_at' => 'datetime',
        'email_verified_at' => 'datetime',
        'default_delivery_lat' => 'decimal:7',
        'default_delivery_lng' => 'decimal:7',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }

    public function tokens(): HasMany
    {
        return $this->hasMany(CustomerToken::class);
    }

    public function favorites(): HasMany
    {
        return $this->hasMany(CustomerFavorite::class);
    }

    public function addresses(): HasMany
    {
        return $this->hasMany(CustomerAddress::class);
    }

    public function pushTokens(): HasMany
    {
        return $this->hasMany(CustomerPushToken::class);
    }

    public function restaurantNotificationOptIns(): HasMany
    {
        return $this->hasMany(CustomerRestaurantNotificationOptIn::class);
    }

    /**
     * סנכרון שדות default_delivery_* מטבלת כתובות שמורות (אחרי מחיקה/שינוי ברירת מחדל).
     * בלי זה הלקוח עדיין רואה בפרופיל ובסל את הכתובת שנמחקה מהרשימה.
     */
    public function syncDefaultDeliveryFromSavedAddresses(): void
    {
        $default = $this->addresses()->where('is_default', true)->first()
            ?? $this->addresses()->orderByDesc('updated_at')->first();

        if (! $default || $default->lat === null || $default->lng === null) {
            $this->forceFill([
                'default_delivery_address' => null,
                'default_delivery_city' => null,
                'default_delivery_street' => null,
                'default_delivery_house_number' => null,
                'default_delivery_lat' => null,
                'default_delivery_lng' => null,
                'default_delivery_notes' => null,
            ])->save();

            return;
        }

        $this->forceFill([
            'default_delivery_address' => $default->full_address,
            'default_delivery_city' => $default->city,
            'default_delivery_street' => $default->street,
            'default_delivery_house_number' => $default->house_number ?: null,
            'default_delivery_lat' => $default->lat,
            'default_delivery_lng' => $default->lng,
            'default_delivery_notes' => $default->notes,
        ])->save();
    }
}

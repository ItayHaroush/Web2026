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
        'default_delivery_address',
        'default_delivery_lat',
        'default_delivery_lng',
        'default_delivery_notes',
        'preferred_payment_method',
        'is_registered',
        'last_order_at',
        'total_orders',
    ];

    protected $hidden = [
        'pin_hash',
        'email_verification_token',
    ];

    protected $casts = [
        'is_registered' => 'boolean',
        'last_order_at' => 'datetime',
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
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class RestaurantSubscription extends Model
{
    use HasFactory;

    protected $fillable = [
        'restaurant_id',
        'plan_type',
        'monthly_fee',
        'billing_day',
        'currency',
        'status',
        'outstanding_amount',
        'next_charge_at',
        'last_paid_at',
        'notes',
    ];

    protected $casts = [
        'plan_type' => 'string',
        'monthly_fee' => 'decimal:2',
        'outstanding_amount' => 'decimal:2',
        'next_charge_at' => 'datetime',
        'last_paid_at' => 'datetime',
    ];

    public function restaurant(): BelongsTo
    {
        return $this->belongsTo(Restaurant::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(RestaurantPayment::class);
    }
}

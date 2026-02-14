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
        'billing_model',
        'base_fee',
        'commission_percent',
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
        'base_fee' => 'decimal:2',
        'commission_percent' => 'decimal:2',
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

    public function invoices(): HasMany
    {
        return $this->hasMany(MonthlyInvoice::class, 'restaurant_id', 'restaurant_id');
    }

    /**
     * Get the effective billing configuration for this restaurant.
     * Falls back to system_settings defaults if no explicit values set.
     */
    public function getEffectiveBillingConfig(): array
    {
        $model = $this->billing_model;
        $baseFee = (float) $this->base_fee;
        $commissionPercent = (float) $this->commission_percent;

        // If no explicit billing config, use global defaults
        if ((!$model || $model === 'flat') && $baseFee == 0 && $commissionPercent == 0) {
            $globalModel = SystemSetting::get('commission_model', 'flat');
            $globalFee = (float) SystemSetting::get('flat_monthly_fee', 0);
            $globalPercent = (float) SystemSetting::get('commission_percentage', 0);

            // Use global defaults only if they exist
            if ($globalFee > 0 || $globalPercent > 0) {
                return [
                    'billing_model' => $globalModel,
                    'base_fee' => $globalFee,
                    'commission_percent' => $globalPercent,
                    'is_default' => true,
                ];
            }

            // Fall back to monthly_fee from subscription
            return [
                'billing_model' => 'flat',
                'base_fee' => (float) $this->monthly_fee,
                'commission_percent' => 0,
                'is_default' => true,
            ];
        }

        return [
            'billing_model' => $model,
            'base_fee' => $baseFee,
            'commission_percent' => $commissionPercent,
            'is_default' => false,
        ];
    }
}

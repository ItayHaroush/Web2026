<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DailyReport extends Model
{
    protected $fillable = [
        'restaurant_id',
        'tenant_id',
        'date',
        'total_orders',
        'total_revenue',
        'pickup_orders',
        'delivery_orders',
        'web_orders',
        'web_revenue',
        'kiosk_orders',
        'kiosk_revenue',
        'pos_orders',
        'pos_revenue',
        'dine_in_orders',
        'takeaway_orders',
        'cash_total',
        'credit_total',
        'cancelled_orders',
        'cancelled_total',
        'avg_order_value',
        'report_json',
    ];

    protected $casts = [
        'date' => 'date',
        'total_revenue' => 'decimal:2',
        'web_revenue' => 'decimal:2',
        'kiosk_revenue' => 'decimal:2',
        'pos_revenue' => 'decimal:2',
        'cash_total' => 'decimal:2',
        'credit_total' => 'decimal:2',
        'cancelled_total' => 'decimal:2',
        'avg_order_value' => 'decimal:2',
        'report_json' => 'array',
    ];

    public function restaurant(): BelongsTo
    {
        return $this->belongsTo(Restaurant::class);
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

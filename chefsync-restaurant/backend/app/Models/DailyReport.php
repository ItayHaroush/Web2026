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
        'refund_count',
        'refund_total',
        'net_revenue',
        'pos_credit_total',
        'online_credit_total',
        'kiosk_credit_total',
        'waived_count',
        'waived_total',
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
        'refund_total' => 'decimal:2',
        'net_revenue' => 'decimal:2',
        'pos_credit_total' => 'decimal:2',
        'online_credit_total' => 'decimal:2',
        'kiosk_credit_total' => 'decimal:2',
        'waived_total' => 'decimal:2',
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

    /**
     * JSON/API: עמודת date היא יום עסקים (DATE), לא רגע UTC.
     * parent::toArray() ממיר Carbon ל-ISO ב-UTC ואז split('T')[0] בפרונט מקדים יום בישראל.
     */
    public function toArray(): array
    {
        $array = parent::toArray();

        $raw = $this->getRawOriginal('date');
        if (is_string($raw) && strlen($raw) >= 10 && preg_match('/^\d{4}-\d{2}-\d{2}/', substr($raw, 0, 10))) {
            $array['date'] = substr($raw, 0, 10);
        } elseif ($this->date !== null) {
            $array['date'] = $this->date->copy()->timezone('Asia/Jerusalem')->format('Y-m-d');
        }

        return $array;
    }
}

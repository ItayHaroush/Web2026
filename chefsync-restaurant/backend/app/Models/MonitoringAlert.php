<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MonitoringAlert extends Model
{
    protected $fillable = [
        'tenant_id',
        'restaurant_id',
        'alert_type',
        'title',
        'body',
        'severity',
        'metadata',
        'is_read',
    ];

    protected $casts = [
        'metadata' => 'array',
        'is_read'  => 'boolean',
    ];

    protected static function booted()
    {
        static::addGlobalScope('tenant', function ($query) {
            if (app()->has('tenant_id')) {
                $query->where('monitoring_alerts.tenant_id', app('tenant_id'));
            }
        });
    }

    public function restaurant(): BelongsTo
    {
        return $this->belongsTo(Restaurant::class);
    }
}

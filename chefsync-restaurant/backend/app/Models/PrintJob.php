<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PrintJob extends Model
{
    protected $fillable = [
        'tenant_id',
        'restaurant_id',
        'printer_id',
        'order_id',
        'status',
        'role',
        'device_id',
        'target_ip',
        'target_port',
        'payload',
        'error_message',
        'printer_status_verified',
        'printer_status',
        'printer_status_detail',
        'attempts',
        'retry_count',
        'print_duration_ms',
        'printer_name',
        'failed_notified_at',
    ];

    protected $casts = [
        'payload' => 'array',
        'printer_status_verified' => 'boolean',
        'attempts' => 'integer',
        'retry_count' => 'integer',
        'print_duration_ms' => 'integer',
        'target_port' => 'integer',
        'failed_notified_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    protected static function booted()
    {
        static::addGlobalScope('tenant', function ($query) {
            if (app()->has('tenant_id')) {
                $query->where('tenant_id', app('tenant_id'));
            }
        });
    }

    public function printer(): BelongsTo
    {
        return $this->belongsTo(Printer::class);
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function device(): BelongsTo
    {
        return $this->belongsTo(PrintDevice::class, 'device_id');
    }
}

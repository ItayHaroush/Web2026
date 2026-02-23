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
        'attempts',
    ];

    protected $casts = [
        'payload' => 'array',
        'attempts' => 'integer',
        'target_port' => 'integer',
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

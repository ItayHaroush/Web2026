<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OrderEvent extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'tenant_id',
        'order_id',
        'event_type',
        'actor_type',
        'actor_id',
        'old_status',
        'new_status',
        'payload',
        'ip_address',
        'correlation_id',
        'created_at',
    ];

    protected $casts = [
        'payload' => 'array',
        'created_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::creating(function (self $event) {
            $event->created_at = $event->created_at ?? now();
        });
    }

    public function order()
    {
        return $this->belongsTo(Order::class);
    }

    public function scopeForOrder($query, $orderId)
    {
        return $query->where('order_id', $orderId);
    }

    public function scopeForTenant($query, string $tenantId)
    {
        return $query->where('tenant_id', $tenantId);
    }

    public function scopeOfType($query, string $type)
    {
        return $query->where('event_type', $type);
    }
}

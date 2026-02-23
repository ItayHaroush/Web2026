<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class PrintDevice extends Model
{
    protected $fillable = [
        'tenant_id',
        'restaurant_id',
        'name',
        'role',
        'device_token',
        'printer_ip',
        'printer_port',
        'is_active',
        'last_seen_at',
        'last_error_message',
        'last_error_at',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'printer_port' => 'integer',
        'last_seen_at' => 'datetime',
        'last_error_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    protected $hidden = ['device_token'];

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($device) {
            if (empty($device->device_token)) {
                $device->device_token = bin2hex(random_bytes(32));
            }
        });
    }

    protected static function booted()
    {
        static::addGlobalScope('tenant', function ($query) {
            if (app()->has('tenant_id')) {
                $query->where('tenant_id', app('tenant_id'));
            }
        });
    }

    public function restaurant(): BelongsTo
    {
        return $this->belongsTo(Restaurant::class);
    }

    public function printJobs(): HasMany
    {
        return $this->hasMany(PrintJob::class, 'device_id');
    }

    public function getIsConnectedAttribute(): bool
    {
        return $this->last_seen_at && $this->last_seen_at->diffInSeconds(now()) < 60;
    }
}

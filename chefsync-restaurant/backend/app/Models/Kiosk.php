<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class Kiosk extends Model
{
    protected $fillable = [
        'tenant_id',
        'restaurant_id',
        'name',
        'token',
        'is_active',
        'design_options',
        'require_name',
        'tables',
        'last_seen_at',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'require_name' => 'boolean',
        'design_options' => 'array',
        'tables' => 'array',
        'last_seen_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($kiosk) {
            if (empty($kiosk->token)) {
                $kiosk->token = (string) Str::uuid();
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

    public function getIsConnectedAttribute(): bool
    {
        return $this->last_seen_at && $this->last_seen_at->diffInSeconds(now()) < 120;
    }
}

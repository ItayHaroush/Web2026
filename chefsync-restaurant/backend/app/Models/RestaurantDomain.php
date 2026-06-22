<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class RestaurantDomain extends Model
{
    use SoftDeletes;

    public const TYPE_PRIMARY = 'primary';
    public const TYPE_REDIRECT = 'redirect';
    public const TYPE_LEGACY = 'legacy';

    public const HEALTH_PENDING = 'pending';
    public const HEALTH_DNS_PENDING = 'dns_pending';
    public const HEALTH_SSL_PENDING = 'ssl_pending';
    public const HEALTH_HEALTHY = 'healthy';
    public const HEALTH_ERROR = 'error';

    public const HEALTH_STATUSES = [
        self::HEALTH_PENDING,
        self::HEALTH_DNS_PENDING,
        self::HEALTH_SSL_PENDING,
        self::HEALTH_HEALTHY,
        self::HEALTH_ERROR,
    ];

    protected $fillable = [
        'restaurant_id',
        'tenant_id',
        'domain',
        'domain_type',
        'domain_request_id',
        'vercel_domain_id',
        'ssl_status',
        'health_status',
        'health_checked_at',
        'connected_at',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'connected_at' => 'datetime',
        'health_checked_at' => 'datetime',
    ];

    public function restaurant(): BelongsTo
    {
        return $this->belongsTo(Restaurant::class);
    }

    public function domainRequest(): BelongsTo
    {
        return $this->belongsTo(DomainRequest::class);
    }

    /** Soft disconnect — mark legacy, never hard delete */
    public function markLegacy(): void
    {
        $this->update([
            'is_active' => false,
            'domain_type' => self::TYPE_LEGACY,
            'health_status' => self::HEALTH_ERROR,
            'health_checked_at' => now(),
        ]);
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true)->whereNull('deleted_at');
    }

    public function scopePrimary($query)
    {
        return $query->where('domain_type', self::TYPE_PRIMARY);
    }
}

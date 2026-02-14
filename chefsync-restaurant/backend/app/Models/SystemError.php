<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SystemError extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'tenant_id',
        'order_id',
        'correlation_id',
        'error_type',
        'message',
        'stack_trace',
        'context',
        'severity',
        'resolved',
        'resolved_at',
        'created_at',
    ];

    protected $casts = [
        'context' => 'array',
        'resolved' => 'boolean',
        'resolved_at' => 'datetime',
        'created_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::creating(function (self $error) {
            $error->created_at = $error->created_at ?? now();
        });
    }

    public function scopeUnresolved($query)
    {
        return $query->where('resolved', false);
    }

    public function scopeCritical($query)
    {
        return $query->where('severity', 'critical');
    }

    public function scopeRecent($query, int $hours = 24)
    {
        return $query->where('created_at', '>=', now()->subHours($hours));
    }

    /**
     * Log a new system error
     */
    public static function log(
        string $errorType,
        string $message,
        string $severity = 'error',
        ?string $tenantId = null,
        ?int $orderId = null,
        ?string $correlationId = null,
        ?string $stackTrace = null,
        ?array $context = null
    ): self {
        return static::create([
            'tenant_id' => $tenantId,
            'order_id' => $orderId,
            'correlation_id' => $correlationId,
            'error_type' => $errorType,
            'message' => $message,
            'stack_trace' => $stackTrace,
            'context' => $context,
            'severity' => $severity,
        ]);
    }
}

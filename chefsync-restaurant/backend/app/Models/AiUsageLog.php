<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AiUsageLog extends Model
{
    protected $fillable = [
        'tenant_id',
        'restaurant_id',
        'user_id',
        'feature',
        'action',
        'prompt_type',       // 'chat'|'insight'|'sms_draft'
        'bypass_reason',     // 'dev_mode'|'ai_unlimited'|null
        'credits_used',
        'tokens_used',
        'response_time_ms',
        'cached',
        'cache_key',
        'prompt',
        'response',
        'metadata',
        'status',
        'error_message',
    ];

    protected $casts = [
        'credits_used' => 'integer',
        'tokens_used' => 'integer',
        'response_time_ms' => 'integer',
        'cached' => 'boolean',
        'metadata' => 'array',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Get the restaurant that owns the log
     */
    public function restaurant(): BelongsTo
    {
        return $this->belongsTo(Restaurant::class);
    }

    /**
     * Get the user who triggered the AI action
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Scope to filter by tenant
     */
    public function scopeTenant($query, string $tenantId)
    {
        return $query->where('tenant_id', $tenantId);
    }

    /**
     * Scope to filter by feature
     */
    public function scopeFeature($query, string $feature)
    {
        return $query->where('feature', $feature);
    }

    /**
     * Scope to filter by status
     */
    public function scopeSuccessful($query)
    {
        return $query->where('status', 'success');
    }

    /**
     * Scope to filter by date range
     */
    public function scopeDateRange($query, $startDate, $endDate)
    {
        return $query->whereBetween('created_at', [$startDate, $endDate]);
    }
}

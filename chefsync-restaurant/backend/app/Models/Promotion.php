<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * דגם Promotion - מבצעים
 */
class Promotion extends Model
{
    protected $fillable = [
        'tenant_id',
        'restaurant_id',
        'name',
        'description',
        'start_at',
        'end_at',
        'active_hours_start',
        'active_hours_end',
        'active_days',
        'is_active',
        'priority',
        'auto_apply',
        'gift_required',
        'stackable',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'auto_apply' => 'boolean',
        'gift_required' => 'boolean',
        'stackable' => 'boolean',
        'active_days' => 'array',
        'start_at' => 'datetime',
        'end_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function restaurant(): BelongsTo
    {
        return $this->belongsTo(Restaurant::class);
    }

    public function rules(): HasMany
    {
        return $this->hasMany(PromotionRule::class);
    }

    public function rewards(): HasMany
    {
        return $this->hasMany(PromotionReward::class);
    }

    public function usage(): HasMany
    {
        return $this->hasMany(PromotionUsage::class);
    }

    protected static function booted()
    {
        static::addGlobalScope('tenant', function ($query) {
            if (app()->has('tenant_id')) {
                $query->where('tenant_id', app('tenant_id'));
            }
        });
    }
}

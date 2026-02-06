<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Support\Str;

/**
 * דגם DisplayScreen - מסכי תצוגה
 */
class DisplayScreen extends Model
{
    protected $fillable = [
        'tenant_id',
        'restaurant_id',
        'name',
        'token',
        'display_type',
        'design_preset',
        'design_options',
        'content_mode',
        'refresh_interval',
        'rotation_speed',
        'is_active',
        'show_branding',
        'last_seen_at',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'show_branding' => 'boolean',
        'design_options' => 'array',
        'last_seen_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'refresh_interval' => 'integer',
        'rotation_speed' => 'integer',
    ];

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($screen) {
            if (empty($screen->token)) {
                $screen->token = (string) Str::uuid();
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

    public function menuItems(): BelongsToMany
    {
        return $this->belongsToMany(MenuItem::class, 'display_screen_items')
            ->withPivot('sort_order', 'badge')
            ->orderBy('display_screen_items.sort_order');
    }

    /**
     * סטטוס חיבור - מחובר אם last_seen_at תוך 2 דקות
     */
    public function getIsConnectedAttribute(): bool
    {
        return $this->last_seen_at && $this->last_seen_at->diffInSeconds(now()) < 120;
    }
}

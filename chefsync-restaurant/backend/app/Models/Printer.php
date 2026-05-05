<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Printer extends Model
{
    protected $fillable = [
        'tenant_id',
        'restaurant_id',
        'name',
        'type',
        'role',
        'ip_address',
        'port',
        'paper_width',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'port' => 'integer',
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

    public function restaurant(): BelongsTo
    {
        return $this->belongsTo(Restaurant::class);
    }

    public function categories(): BelongsToMany
    {
        return $this->belongsToMany(Category::class, 'printer_category');
    }

    /**
     * קבוצות תוספות שיוסתרו מהדפסה במדפסת זו (רק קבוצות "כלליות" שלא מקושרות לקטגוריה).
     */
    public function addonGroups(): BelongsToMany
    {
        return $this->belongsToMany(RestaurantAddonGroup::class, 'printer_addon_group', 'printer_id', 'addon_group_id');
    }

    public function printJobs(): HasMany
    {
        return $this->hasMany(PrintJob::class);
    }
}

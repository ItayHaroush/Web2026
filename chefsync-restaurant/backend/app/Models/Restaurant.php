<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * דגם Restaurant (Tenant)
 * כל מסעדה היא Tenant נפרד במערכת
 */
class Restaurant extends Model
{
    protected $fillable = [
        'tenant_id',
        'name',
        'slug',
        'phone',
        'address',
        'is_open',
        'is_override_status',
        'description',
        'logo_url',
        'operating_days',
        'operating_hours',
    ];

    protected $casts = [
        'is_open' => 'boolean',
        'is_override_status' => 'boolean',
        'operating_days' => 'array',
        'operating_hours' => 'array',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * קטגוריות תפריט של המסעדה
     */
    public function categories(): HasMany
    {
        return $this->hasMany(Category::class, 'restaurant_id');
    }

    /**
     * פריטי תפריט
     */
    public function menuItems(): HasMany
    {
        return $this->hasMany(MenuItem::class, 'restaurant_id');
    }

    /**
     * הזמנות של המסעדה
     */
    public function orders(): HasMany
    {
        return $this->hasMany(Order::class, 'restaurant_id');
    }

    /**
     * טענת מחדש - סנן לפי Tenant ID הנוכחי
     */
    protected static function booted()
    {
        static::addGlobalScope('tenant', function ($query) {
            if (app()->has('tenant_id')) {
                $query->where('tenant_id', app('tenant_id'));
            }
        });
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PriceRule extends Model
{
    protected $fillable = [
        'tenant_id',
        'target_type',
        'target_id',
        'scope_type',
        'scope_id',
        'price_delta',
    ];

    protected $casts = [
        'price_delta' => 'decimal:2',
    ];

    protected static function booted()
    {
        static::addGlobalScope('tenant', function ($query) {
            if (app()->has('tenant_id')) {
                $query->where('price_rules.tenant_id', app('tenant_id'));
            }
        });
    }

    public function variant(): BelongsTo
    {
        return $this->belongsTo(RestaurantVariant::class, 'target_id');
    }
}

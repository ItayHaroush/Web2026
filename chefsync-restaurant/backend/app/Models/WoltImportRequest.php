<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * בקשת ייבוא תפריט מוולט — נוצרת בהרשמה וממתינה לאישור סופר-אדמין.
 */
class WoltImportRequest extends Model
{
    protected $fillable = [
        'restaurant_id',
        'tenant_id',
        'wolt_url',
        'slug',
        'selection_mode',
        'categories',
        'restaurant_meta',
        'summary',
        'status',
        'applied_at',
    ];

    protected $casts = [
        'categories' => 'array',
        'restaurant_meta' => 'array',
        'summary' => 'array',
        'applied_at' => 'datetime',
    ];

    public function restaurant(): BelongsTo
    {
        return $this->belongsTo(Restaurant::class);
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * תגובת מסעדה לחג — שעות/סגירה מיוחדות
 */
class RestaurantHolidayHour extends Model
{
    protected $fillable = [
        'restaurant_id',
        'holiday_id',
        'status',
        'open_time',
        'close_time',
        'note',
        'responded_at',
    ];

    protected $casts = [
        'responded_at' => 'datetime',
    ];

    public function restaurant(): BelongsTo
    {
        return $this->belongsTo(Restaurant::class);
    }

    public function holiday(): BelongsTo
    {
        return $this->belongsTo(IsraeliHoliday::class, 'holiday_id');
    }
}

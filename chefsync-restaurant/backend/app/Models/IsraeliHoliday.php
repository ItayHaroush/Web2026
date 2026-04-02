<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * חגים ישראליים — מנוהל ע"י סופר אדמין
 */
class IsraeliHoliday extends Model
{
    protected $fillable = [
        'name',
        'hebrew_date_info',
        'start_date',
        'end_date',
        'year',
        'type',
        'description',
    ];

    protected $casts = [
        'start_date' => 'date',
        'end_date' => 'date',
        'year' => 'integer',
    ];

    public function restaurantHours(): HasMany
    {
        return $this->hasMany(RestaurantHolidayHour::class, 'holiday_id');
    }

    /**
     * חגים עתידיים או פעילים כרגע
     */
    public function scopeUpcoming($query)
    {
        return $query->where('end_date', '>=', today());
    }

    /**
     * חגים שפעילים היום
     */
    public function scopeCurrent($query)
    {
        $today = today();
        return $query->where('start_date', '<=', $today)
            ->where('end_date', '>=', $today);
    }
}

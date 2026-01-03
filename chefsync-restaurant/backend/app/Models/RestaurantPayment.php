<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RestaurantPayment extends Model
{
    use HasFactory;

    protected $fillable = [
        'restaurant_id',
        'amount',
        'currency',
        'period_start',
        'period_end',
        'paid_at',
        'method',
        'reference',
        'status',
        'failure_reason',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'period_start' => 'date',
        'period_end' => 'date',
        'paid_at' => 'datetime',
    ];

    public function restaurant(): BelongsTo
    {
        return $this->belongsTo(Restaurant::class);
    }
}

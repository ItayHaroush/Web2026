<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MonthlyInvoice extends Model
{
    use HasFactory;

    protected $fillable = [
        'restaurant_id',
        'month',
        'base_fee',
        'commission_fee',
        'total_due',
        'order_count',
        'order_revenue',
        'commission_percent',
        'billing_model',
        'currency',
        'status',
        'payment_link',
        'paid_at',
        'notes',
    ];

    protected $casts = [
        'base_fee' => 'decimal:2',
        'commission_fee' => 'decimal:2',
        'total_due' => 'decimal:2',
        'order_revenue' => 'decimal:2',
        'commission_percent' => 'decimal:2',
        'order_count' => 'integer',
        'paid_at' => 'datetime',
    ];

    public function restaurant(): BelongsTo
    {
        return $this->belongsTo(Restaurant::class);
    }

    public function scopeForMonth($query, string $month)
    {
        return $query->where('month', $month);
    }

    public function scopeUnpaid($query)
    {
        return $query->whereIn('status', ['pending', 'overdue']);
    }

    public function scopeDraft($query)
    {
        return $query->where('status', 'draft');
    }
}

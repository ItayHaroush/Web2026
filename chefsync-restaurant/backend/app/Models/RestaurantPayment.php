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

    protected static function booted(): void
    {
        static::created(function (self $payment) {
            if ($payment->status === 'paid') {
                $payment->markMatchingInvoicePaid();
            }
        });
    }

    /**
     * כשתשלום נרשם — מסמן את החשבונית התואמת כשולמה
     */
    private function markMatchingInvoicePaid(): void
    {
        $paidAt = $this->paid_at ?? $this->created_at ?? now();
        $month = $paidAt->format('Y-m');

        $invoice = MonthlyInvoice::where('restaurant_id', $this->restaurant_id)
            ->where('month', $month)
            ->whereIn('status', ['pending', 'overdue', 'draft'])
            ->first();

        // אם לא נמצאה לחודש הנוכחי, חפש את האחרונה הפתוחה
        if (!$invoice) {
            $invoice = MonthlyInvoice::where('restaurant_id', $this->restaurant_id)
                ->whereIn('status', ['pending', 'overdue'])
                ->orderByDesc('month')
                ->first();
        }

        if ($invoice) {
            $invoice->update([
                'status'  => 'paid',
                'paid_at' => $paidAt,
            ]);
        }
    }

    public function restaurant(): BelongsTo
    {
        return $this->belongsTo(Restaurant::class);
    }
}

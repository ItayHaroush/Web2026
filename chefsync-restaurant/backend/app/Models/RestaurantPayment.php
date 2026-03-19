<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RestaurantPayment extends Model
{
    use HasFactory;

    protected $fillable = [
        'restaurant_id',
        'type',
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

    /** סוגי תשלום שמתאימים לחשבונית חודשית */
    public const INVOICE_TYPES = ['subscription', 'abandoned_cart_package'];

    protected static function booted(): void
    {
        static::created(function (self $payment) {
            if ($payment->status === 'paid' && in_array($payment->type ?? 'subscription', self::INVOICE_TYPES, true)) {
                $payment->tryMarkMatchingInvoicePaid();
            }
        });
    }

    /**
     * כשתשלום נרשם — בודק אם סך התשלומים (מנוי + חבילות תזכורות) מכסה את החשבונית ומסמן כשולמה
     */
    private function tryMarkMatchingInvoicePaid(): void
    {
        $paidAt = $this->paid_at ?? $this->created_at ?? now();
        $month = $paidAt->format('Y-m');

        $invoice = MonthlyInvoice::where('restaurant_id', $this->restaurant_id)
            ->where('month', $month)
            ->whereIn('status', ['pending', 'overdue', 'draft'])
            ->first();

        if (!$invoice) {
            $invoice = MonthlyInvoice::where('restaurant_id', $this->restaurant_id)
                ->whereIn('status', ['pending', 'overdue'])
                ->orderByDesc('month')
                ->first();
        }

        if (!$invoice) {
            return;
        }

        // סך תשלומים לחודש (מנוי + חבילות תזכורות)
        $periodStart = Carbon::parse($invoice->month . '-01')->startOfMonth();
        $periodEnd = (clone $periodStart)->endOfMonth();

        $totalPaid = (float) static::where('restaurant_id', $this->restaurant_id)
            ->whereIn('type', self::INVOICE_TYPES)
            ->where('status', 'paid')
            ->whereBetween('paid_at', [$periodStart, $periodEnd])
            ->sum('amount');

        if ($totalPaid >= (float) $invoice->total_due) {
            $invoice->update([
                'status'  => 'paid',
                'paid_at' => $paidAt,
            ]);

            // סמן חבילות תזכורות ממתינות כשולמו
            $periodStart = Carbon::parse($invoice->month . '-01')->startOfMonth();
            $periodEnd = (clone $periodStart)->endOfMonth();
            static::where('restaurant_id', $this->restaurant_id)
                ->where('type', 'abandoned_cart_package')
                ->where('status', 'pending')
                ->whereBetween('created_at', [$periodStart, $periodEnd])
                ->update(['status' => 'paid', 'paid_at' => $paidAt]);
        }
    }

    public function restaurant(): BelongsTo
    {
        return $this->belongsTo(Restaurant::class);
    }
}

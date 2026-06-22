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

    /** סוגי תשלום דומיין מותאם */
    public const DOMAIN_TYPES = ['domain_connect', 'domain_full_service'];

    /** סוגי תשלום שמתאימים לחשבונית חודשית */
    public const INVOICE_TYPES = ['subscription', 'abandoned_cart_package', 'domain_connect', 'domain_full_service'];

    protected static function booted(): void
    {
        static::created(function (self $payment) {
            if ($payment->status !== 'paid') {
                return;
            }

            $type = $payment->type ?? 'subscription';

            if (in_array($type, self::DOMAIN_TYPES, true)) {
                app(PlatformCommissionService::class)->syncInvoiceDomainFee(
                    (int) $payment->restaurant_id,
                    $payment->paid_at ?? $payment->created_at ?? now()
                );
            }

            if (in_array($type, self::INVOICE_TYPES, true)) {
                $payment->tryMarkMatchingInvoicePaid();
            }
        });
    }

    /**
     * כשתשלום נרשם — בודק אם סך התשלומים (מנוי + חבילות + דומיין) מכסה את החשבונית ומסמן כשולמה
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

        // סך תשלומים לחודש (מנוי + חבילות תזכורות + דומיין)
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

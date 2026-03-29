<?php

namespace App\Services\Reporting;

use Illuminate\Support\Collection;

/**
 * סיכום תנועות קופה (משמרת) — מקור יחיד ל-Z, סיכום חי ויתרה צפויה.
 */
final class ShiftMovementTotals
{
    private function __construct(
        public readonly float $cashPayments,
        public readonly float $creditPayments,
        public readonly float $cashInCash,
        public readonly float $cashInCredit,
        public readonly float $cashOut,
        public readonly float $refundsTotal,
        public readonly float $cashRefunds,
        public readonly int $paymentCount,
        public readonly int $cashPaymentCount,
        public readonly int $creditPaymentCount,
        public readonly int $refundCount,
        public readonly int $paymentsWithOrderIdCount,
    ) {}

    public static function fromMovements(Collection $movements): self
    {
        $cashPayments = (float) $movements->where('type', 'payment')->where('payment_method', 'cash')->sum('amount');
        $creditPayments = (float) $movements->where('type', 'payment')->where('payment_method', 'credit')->sum('amount');
        $cashInCash = (float) $movements->where('type', 'cash_in')->where('payment_method', 'cash')->sum('amount');
        $cashInCredit = (float) $movements->where('type', 'cash_in')->where('payment_method', 'credit')->sum('amount');
        $cashOut = (float) $movements->where('type', 'cash_out')->sum('amount');
        $refundsTotal = (float) $movements->where('type', 'refund')->sum('amount');
        $cashRefunds = (float) $movements->where('type', 'refund')->where('payment_method', 'cash')->sum('amount');

        $paymentMovements = $movements->where('type', 'payment');

        return new self(
            $cashPayments,
            $creditPayments,
            $cashInCash,
            $cashInCredit,
            $cashOut,
            $refundsTotal,
            $cashRefunds,
            $paymentMovements->count(),
            $paymentMovements->where('payment_method', 'cash')->count(),
            $paymentMovements->where('payment_method', 'credit')->count(),
            $movements->where('type', 'refund')->count(),
            $paymentMovements->whereNotNull('order_id')->count(),
        );
    }

    public function expectedRegisterBalance(float $openingBalance): float
    {
        return round(
            $openingBalance + $this->cashPayments + $this->cashInCash - $this->cashOut - $this->cashRefunds,
            2
        );
    }

    public function totalSales(): float
    {
        return round($this->cashPayments + $this->creditPayments + $this->cashInCredit, 2);
    }
}

<?php

namespace App\Services;

use App\Http\Controllers\SuperAdminSettingsController;
use App\Models\MonthlyInvoice;
use App\Models\Order;
use App\Models\Restaurant;
use App\Models\RestaurantPayment;
use App\Models\RestaurantSubscription;
use Carbon\Carbon;
use Illuminate\Support\Facades\Log;

class PlatformCommissionService
{
    /**
     * Generate monthly invoices for all active restaurants for a given month.
     */
    public function generateMonthlyInvoices(string $month, bool $overwriteDrafts = false): array
    {
        $results = ['generated' => 0, 'skipped' => 0, 'errors' => []];

        $periodStart = Carbon::createFromFormat('Y-m', $month)->startOfMonth();
        $periodEnd = (clone $periodStart)->endOfMonth();

        $restaurants = Restaurant::whereIn('subscription_status', ['active', 'trial'])
            ->with('subscription')
            ->get();

        foreach ($restaurants as $restaurant) {
            try {
                $result = $this->generateInvoiceForRestaurant(
                    $restaurant,
                    $month,
                    $periodStart,
                    $periodEnd,
                    $overwriteDrafts
                );
                if ($result) {
                    $results['generated']++;
                } else {
                    $results['skipped']++;
                }
            } catch (\Exception $e) {
                Log::error('Invoice generation failed', [
                    'restaurant_id' => $restaurant->id,
                    'month' => $month,
                    'error' => $e->getMessage(),
                ]);
                $results['errors'][] = [
                    'restaurant_id' => $restaurant->id,
                    'restaurant_name' => $restaurant->name,
                    'error' => $e->getMessage(),
                ];
            }
        }

        return $results;
    }

    /**
     * Generate a single invoice for a specific restaurant and month.
     */
    public function generateInvoiceForRestaurant(
        Restaurant $restaurant,
        string $month,
        Carbon $periodStart,
        Carbon $periodEnd,
        bool $overwriteDrafts = false
    ): ?MonthlyInvoice {
        $existing = MonthlyInvoice::where('restaurant_id', $restaurant->id)
            ->where('month', $month)
            ->first();

        if ($existing) {
            if ($existing->status !== 'draft' || !$overwriteDrafts) {
                return null;
            }
            $existing->delete();
        }

        $subscription = $restaurant->subscription;
        if (!$subscription) {
            // Create a basic subscription from restaurant fields
            $subscription = RestaurantSubscription::create([
                'restaurant_id' => $restaurant->id,
                'monthly_fee' => $restaurant->monthly_price ?? 0,
                'base_fee' => $restaurant->monthly_price ?? 0,
                'billing_model' => 'flat',
                'commission_percent' => 0,
                'billing_day' => 1,
                'currency' => 'ILS',
                'status' => $restaurant->subscription_status === 'trial' ? 'trial' : 'active',
                'outstanding_amount' => 0,
            ]);
        }

        $config = $subscription->getEffectiveBillingConfig();

        // Query orders across tenants — רק הזמנות שהגיעו בפועל למסעדה
        // (לא סופרים הזמנות אשראי שנתקעו ב-pending ולא אושרו)
        $orderQuery = Order::withoutGlobalScope('tenant')
            ->where('restaurant_id', $restaurant->id)
            ->whereBetween('created_at', [$periodStart, $periodEnd])
            ->where('is_test', false)
            ->whereNotIn('status', ['cancelled'])
            ->where(function ($q) {
                $q->where('payment_method', '!=', 'credit_card')
                    ->orWhere('payment_status', '!=', Order::PAYMENT_PENDING);
            });

        $orderRevenue = (float) $orderQuery->sum('total_amount');
        $orderCount = $orderQuery->count();

        // Calculate fees
        $baseFee = 0;
        $commissionFee = 0;

        switch ($config['billing_model']) {
            case 'flat':
                $baseFee = $config['base_fee'];
                break;
            case 'percentage':
                $commissionFee = round($orderRevenue * ($config['commission_percent'] / 100), 2);
                break;
            case 'hybrid':
                $baseFee = $config['base_fee'];
                $commissionFee = round($orderRevenue * ($config['commission_percent'] / 100), 2);
                break;
        }

        // חבילות תזכורות סל נטוש — שולמו או ממתינות (נוספו לחוב)
        $abandonedCartFee = (float) RestaurantPayment::where('restaurant_id', $restaurant->id)
            ->where('type', 'abandoned_cart_package')
            ->where(function ($q) use ($periodStart, $periodEnd) {
                $q->where(function ($q2) use ($periodStart, $periodEnd) {
                    $q2->where('status', 'paid')->whereBetween('paid_at', [$periodStart, $periodEnd]);
                })->orWhere(function ($q2) use ($periodStart, $periodEnd) {
                    $q2->where('status', 'pending')->whereBetween('created_at', [$periodStart, $periodEnd]);
                });
            })
            ->sum('amount');

        // דמי פתיחת מסוף — חד-פעמי בחשבונית רק אם עדיין לא שולמו בפועל (HYP / סופר־אדמין)
        $setupFee = 0;
        if ($restaurant->hyp_setup_fee_charged && ! $this->restaurantHasPaidTerminalSetupFee($restaurant)) {
            $alreadyInvoiced = MonthlyInvoice::where('restaurant_id', $restaurant->id)
                ->where('setup_fee', '>', 0)
                ->exists();
            if (! $alreadyInvoiced) {
                $setupFee = ($restaurant->tier === 'pro') ? 100 : 200;
            }
        }

        $totalDue = round($baseFee + $commissionFee + $abandonedCartFee + $setupFee, 2);

        // מחיר מקורי לתצוגה עם קו — כשהמחיר בפועל נמוך ממחיר החבילה
        $originalBaseFee = null;
        if ($config['billing_model'] === 'flat' && $baseFee > 0) {
            $pricing = SuperAdminSettingsController::getPricingArray();
            $tier = $restaurant->tier ?? 'basic';
            $planType = $subscription->plan_type ?? 'monthly';
            $catalogMonthly = (float) ($pricing[$tier]['monthly'] ?? 0);
            $catalogYearly = (float) ($pricing[$tier]['yearly'] ?? 0);
            $standardBaseFee = $planType === 'yearly' ? round($catalogYearly / 12, 2) : $catalogMonthly;
            if ($standardBaseFee > 0 && abs((float) $baseFee - $standardBaseFee) > 0.01) {
                $originalBaseFee = $standardBaseFee;
            }
        }

        return MonthlyInvoice::create([
            'restaurant_id' => $restaurant->id,
            'month' => $month,
            'base_fee' => $baseFee,
            'original_base_fee' => $originalBaseFee,
            'commission_fee' => $commissionFee,
            'abandoned_cart_fee' => $abandonedCartFee,
            'original_abandoned_cart_fee' => null,
            'setup_fee' => $setupFee,
            'total_due' => $totalDue,
            'order_count' => $orderCount,
            'order_revenue' => $orderRevenue,
            'commission_percent' => $config['commission_percent'],
            'billing_model' => $config['billing_model'],
            'currency' => $subscription->currency ?? 'ILS',
            'status' => 'draft',
        ]);
    }

    /**
     * Finalize all draft invoices for a month (draft → pending).
     */
    public function finalizeInvoices(string $month): int
    {
        return MonthlyInvoice::where('month', $month)
            ->where('status', 'draft')
            ->update(['status' => 'pending']);
    }

    /**
     * Mark an invoice as paid.
     */
    public function markInvoicePaid(int $invoiceId, ?string $paymentLink = null): MonthlyInvoice
    {
        $invoice = MonthlyInvoice::findOrFail($invoiceId);
        $invoice->update([
            'status' => 'paid',
            'paid_at' => now(),
            'payment_link' => $paymentLink ?? $invoice->payment_link,
        ]);

        $this->syncSubscriptionOutstandingFromOpenInvoices($invoice->restaurant_id);

        RestaurantSubscription::where('restaurant_id', $invoice->restaurant_id)
            ->update(['last_paid_at' => now()]);

        return $invoice->fresh();
    }

    /**
     * סכום חשבוניות פתוחות (ממתינה / באיחור) למסעדה — לעדכון חוב במנוי.
     */
    public function syncSubscriptionOutstandingFromOpenInvoices(int $restaurantId): void
    {
        $totalUnpaid = (float) MonthlyInvoice::where('restaurant_id', $restaurantId)
            ->whereIn('status', ['pending', 'overdue'])
            ->sum('total_due');

        RestaurantSubscription::where('restaurant_id', $restaurantId)
            ->update(['outstanding_amount' => $totalUnpaid]);
    }

    /**
     * דמי הקמה ששולמו בפועל — לא לשקול שוב בחשבונית חודשית.
     *
     * כולל: שורת terminal_setup, סיומת _setup ב-HYP, סימון ב-notes אחרי HYP,
     * ותשלום הפעלה ישן (מנוי+הקמה בשורת subscription אחת לפני פיצול התשלומים).
     */
    private function restaurantHasPaidTerminalSetupFee(Restaurant $restaurant): bool
    {
        $restaurantId = $restaurant->id;

        if (RestaurantPayment::where('restaurant_id', $restaurantId)
            ->where('status', 'paid')
            ->where('type', 'terminal_setup')
            ->exists()) {
            return true;
        }

        $references = RestaurantPayment::where('restaurant_id', $restaurantId)
            ->where('status', 'paid')
            ->whereNotNull('reference')
            ->pluck('reference');

        if ($references->contains(fn ($ref) => str_ends_with((string) $ref, '_setup'))) {
            return true;
        }

        $subscription = $restaurant->subscription;
        $notes = (string) ($subscription?->notes ?? '');
        if ($notes !== '' && str_contains($notes, 'דמי הקמת חיבור אשראי') && str_contains($notes, 'נגבו בתשלום ראשון')) {
            return true;
        }

        if (! $restaurant->hyp_setup_fee_charged || ! $subscription) {
            return false;
        }

        $expectedSetup = ($restaurant->tier === 'pro') ? 100.0 : 200.0;
        $base = $this->activationSubscriptionBaseAmount($restaurant, $subscription);
        if ($base < 0.01) {
            return false;
        }

        $threshold = $base + $expectedSetup - 0.02;

        $payments = RestaurantPayment::where('restaurant_id', $restaurantId)
            ->where('status', 'paid')
            ->where(function ($q) {
                $q->where('type', 'subscription')->orWhereNull('type');
            })
            ->orderBy('paid_at')
            ->orderBy('id')
            ->get(['amount', 'reference']);

        foreach ($payments as $p) {
            $ref = (string) ($p->reference ?? '');
            if (str_ends_with($ref, '_setup')) {
                continue;
            }
            if ((float) $p->amount >= $threshold) {
                return true;
            }
        }

        return false;
    }

    /**
     * סכום המנוי בעת הפעלה (חודשי או שנתי מלא) לפי מחיר מסעדה / מנוי / לוח.
     */
    private function activationSubscriptionBaseAmount(Restaurant $restaurant, RestaurantSubscription $subscription): float
    {
        $prices = SuperAdminSettingsController::getPricingArray();
        $tier = $restaurant->tier ?: 'basic';
        $yearly = ($subscription->plan_type ?? 'monthly') === 'yearly';

        if ($yearly) {
            $y = (float) ($restaurant->yearly_price ?? 0);
            if ($y < 0.01) {
                $y = (float) ($prices[$tier]['yearly'] ?? 0);
            }

            return $y;
        }

        $m = (float) ($restaurant->monthly_price ?? 0);
        if ($m < 0.01) {
            $m = (float) ($subscription->monthly_fee ?? 0);
        }
        if ($m < 0.01) {
            $m = (float) ($prices[$tier]['monthly'] ?? 0);
        }

        return $m;
    }

    /**
     * Mark overdue invoices (pending invoices past their month).
     */
    public function markOverdueInvoices(): int
    {
        $currentMonth = now()->format('Y-m');
        return MonthlyInvoice::where('status', 'pending')
            ->where('month', '<', $currentMonth)
            ->update(['status' => 'overdue']);
    }
}

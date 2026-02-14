<?php

namespace App\Services;

use App\Models\MonthlyInvoice;
use App\Models\Order;
use App\Models\Restaurant;
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

        // Query orders across tenants (exclude cancelled and test orders)
        $orderQuery = Order::withoutGlobalScope('tenant')
            ->where('restaurant_id', $restaurant->id)
            ->whereBetween('created_at', [$periodStart, $periodEnd])
            ->where('is_test', false)
            ->whereNotIn('status', ['cancelled']);

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

        $totalDue = round($baseFee + $commissionFee, 2);

        return MonthlyInvoice::create([
            'restaurant_id' => $restaurant->id,
            'month' => $month,
            'base_fee' => $baseFee,
            'commission_fee' => $commissionFee,
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

        // Update subscription outstanding amount
        $totalUnpaid = MonthlyInvoice::where('restaurant_id', $invoice->restaurant_id)
            ->whereIn('status', ['pending', 'overdue'])
            ->sum('total_due');

        RestaurantSubscription::where('restaurant_id', $invoice->restaurant_id)
            ->update([
                'outstanding_amount' => $totalUnpaid,
                'last_paid_at' => now(),
            ]);

        return $invoice->fresh();
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

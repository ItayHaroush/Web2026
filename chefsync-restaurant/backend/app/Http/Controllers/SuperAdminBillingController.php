<?php

namespace App\Http\Controllers;

use App\Models\MonthlyInvoice;
use App\Models\Order;
use App\Models\Restaurant;
use App\Models\RestaurantPayment;
use App\Models\RestaurantSubscription;
use App\Services\PlatformCommissionService;
use App\Services\InvoicePdfService;
use App\Mail\InvoiceMail;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Log;

class SuperAdminBillingController extends Controller
{
    public function summary()
    {
        $monthlyExpected = RestaurantSubscription::where('status', 'active')->sum('monthly_fee');
        $outstanding = RestaurantSubscription::sum('outstanding_amount');
        $paidThisMonth = RestaurantPayment::where('status', 'paid')
            ->whereBetween('paid_at', [now()->startOfMonth(), now()->endOfMonth()])
            ->sum('amount');

        // Fallback: if no subscriptions exist, use Restaurant model fields
        if ($monthlyExpected == 0) {
            $monthlyExpected = Restaurant::where('subscription_status', 'active')
                ->sum('monthly_price');
        }

        // Order-based revenue data
        $orderRevenueMonth = Order::whereBetween('created_at', [now()->startOfMonth(), now()->endOfMonth()])
            ->whereNotIn('status', ['cancelled'])
            ->where('is_test', false)
            ->sum('total_amount');
        $orderRevenueTotal = Order::whereNotIn('status', ['cancelled'])
            ->where('is_test', false)
            ->sum('total_amount');
        $ordersThisMonth = Order::whereBetween('created_at', [now()->startOfMonth(), now()->endOfMonth()])
            ->whereNotIn('status', ['cancelled'])
            ->where('is_test', false)
            ->count();

        $totalRestaurants = Restaurant::count();
        $activeRestaurants = Restaurant::where('is_approved', true)->count();
        $trialRestaurants = Restaurant::where('subscription_status', 'trial')->count();

        // Invoice stats
        $currentMonth = now()->format('Y-m');
        $invoicedThisMonth = MonthlyInvoice::where('month', $currentMonth)->sum('total_due');
        $invoicesPaidThisMonth = MonthlyInvoice::where('month', $currentMonth)
            ->where('status', 'paid')->sum('total_due');
        $invoicesOverdue = MonthlyInvoice::where('status', 'overdue')->count();

        return response()->json([
            'success' => true,
            'data' => [
                'monthly_expected' => $monthlyExpected,
                'outstanding' => $outstanding,
                'paid_this_month' => $paidThisMonth,
                'total_restaurants' => $totalRestaurants,
                'active_restaurants' => $activeRestaurants,
                'trial_restaurants' => $trialRestaurants,
                'order_revenue_month' => $orderRevenueMonth,
                'order_revenue_total' => $orderRevenueTotal,
                'orders_this_month' => $ordersThisMonth,
                'invoiced_this_month' => $invoicedThisMonth,
                'invoices_paid_this_month' => $invoicesPaidThisMonth,
                'invoices_overdue_count' => $invoicesOverdue,
            ],
        ]);
    }

    public function restaurants(Request $request)
    {
        $query = Restaurant::query()
            ->with('subscription')
            ->withSum(['payments as total_paid_ytd' => function ($q) {
                $q->whereYear('paid_at', now()->year)->where('status', 'paid');
            }], 'amount')
            ->withCount(['payments as payments_count' => function ($q) {
                $q->where('status', 'paid');
            }])
            ->withCount(['orders as orders_count' => function ($q) {
                $q->whereNotIn('status', ['cancelled'])->where('is_test', false);
            }])
            ->withSum(['orders as order_revenue' => function ($q) {
                $q->whereNotIn('status', ['cancelled'])->where('is_test', false);
            }], 'total_amount');

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('tenant_id', 'like', "%{$search}%");
            });
        }

        if ($request->filled('status')) {
            $query->where('subscription_status', $request->status);
        }

        if ($request->filled('tier')) {
            $query->where('tier', $request->tier);
        }

        $restaurants = $query->orderBy('created_at', 'desc')->paginate(50);

        $restaurants->getCollection()->transform(function ($restaurant) {
            $subscription = $restaurant->subscription;
            $restaurant->monthly_fee = $subscription?->monthly_fee ?? $restaurant->monthly_price ?? 0;
            $restaurant->billing_day = $subscription?->billing_day;
            $restaurant->billing_status = $subscription?->status ?? $restaurant->subscription_status ?? 'inactive';
            $restaurant->outstanding_amount = $subscription?->outstanding_amount ?? 0;
            $restaurant->next_charge_at = $subscription?->next_charge_at ?? $restaurant->next_payment_at;
            $restaurant->last_paid_at = $subscription?->last_paid_at ?? $restaurant->last_payment_at;
            $restaurant->total_paid_ytd = $restaurant->total_paid_ytd ?? 0;
            $restaurant->orders_count = $restaurant->orders_count ?? 0;
            $restaurant->order_revenue = $restaurant->order_revenue ?? 0;
            $restaurant->payments_count = $restaurant->payments_count ?? 0;
            $restaurant->trial_ends_at = $restaurant->trial_ends_at;
            $restaurant->tier = $restaurant->tier;
            $restaurant->subscription_plan = $restaurant->subscription_plan;
            $restaurant->has_card = !empty($restaurant->hyp_card_token);
            $restaurant->card_last4 = $restaurant->hyp_card_last4;
            $restaurant->setup_fee_charged = (bool) $restaurant->hyp_setup_fee_charged;
            $restaurant->billing_model = $subscription?->billing_model ?? 'flat';
            $restaurant->base_fee = $subscription?->base_fee ?? 0;
            $restaurant->commission_percent = $subscription?->commission_percent ?? 0;
            return $restaurant;
        });

        return response()->json([
            'success' => true,
            'restaurants' => $restaurants,
        ]);
    }

    /**
     * הפעלת מנוי ידנית על ידי סופר אדמין (ללא תשלום)
     */
    public function manualActivateSubscription(Request $request, $id)
    {
        $validated = $request->validate([
            'tier' => 'required|in:basic,pro',
            'plan_type' => 'required|in:monthly,yearly',
            'note' => 'nullable|string|max:500',
            'record_payment' => 'nullable|boolean',  // true = תשלום בוצע בפועל — לרישום בדוחות
            'payment_reference' => 'nullable|string|max:100',  // מזהה עסקה מ-HYP אם יש
        ]);

        $restaurant = Restaurant::findOrFail($id);
        $prices = SuperAdminSettingsController::getPricingArray();
        $tier = $validated['tier'];
        $planType = $validated['plan_type'];

        $chargeAmount = $prices[$tier][$planType === 'yearly' ? 'yearly' : 'monthly'];
        $monthlyFee = $planType === 'yearly' ? round($chargeAmount / 12, 2) : $chargeAmount;

        $periodStart = now()->startOfDay();
        $periodEnd = $planType === 'yearly' ? $periodStart->copy()->addYear() : $periodStart->copy()->addMonth();

        DB::beginTransaction();
        try {
            $subscription = RestaurantSubscription::updateOrCreate(
                ['restaurant_id' => $restaurant->id],
                [
                    'plan_type'          => $planType,
                    'monthly_fee'        => $monthlyFee,
                    'billing_day'        => now()->day > 28 ? 28 : now()->day,
                    'currency'           => 'ILS',
                    'status'             => 'active',
                    'outstanding_amount' => 0,
                    'next_charge_at'     => $periodEnd,
                    'last_paid_at'       => now(),
                ]
            );

            $noteLine = ($validated['record_payment'] ?? false)
                ? now()->format('Y-m-d') . " - אישור תשלום התקבל (HYP)" . ($validated['note'] ? ": " . $validated['note'] : '')
                : (($validated['note'] ?? null) ? now()->format('Y-m-d') . " - הפעלה ידנית: " . $validated['note'] : null);
            if ($noteLine) {
                $subscription->update([
                    'notes' => trim(($subscription->notes ?? '') . "\n" . $noteLine),
                ]);
            }

            // רישום התשלום — תמיד (למעקב סופר אדמין) — method מציין אם בוצע בפועל
            RestaurantPayment::create([
                'restaurant_id' => $restaurant->id,
                'amount'        => $chargeAmount,
                'currency'      => 'ILS',
                'period_start'  => $periodStart,
                'period_end'    => $periodEnd,
                'paid_at'       => now(),
                'method'        => ($validated['record_payment'] ?? false) ? 'hyp_credit_card' : 'manual',
                'reference'     => $validated['payment_reference'] ?? ('manual_' . now()->format('YmdHis')),
                'status'        => 'paid',
            ]);

            $restaurant->update([
                'subscription_status'   => 'active',
                'subscription_plan'     => $planType,
                'tier'                  => $tier,
                'ai_credits_monthly'    => $prices[$tier]['ai_credits'] ?? 0,
                'subscription_ends_at'  => $periodEnd,
                'last_payment_at'       => now(),
                'next_payment_at'       => $periodEnd,
                'payment_failed_at'     => null,
                'payment_failure_count' => 0,
            ]);

            // AI Credits
            if ($tier === 'pro' && ($prices[$tier]['ai_credits'] ?? 0) > 0) {
                \App\Models\AiCredit::updateOrCreate(
                    ['restaurant_id' => $restaurant->id],
                    [
                        'tenant_id'           => $restaurant->tenant_id,
                        'tier'                => $tier,
                        'monthly_limit'       => $prices[$tier]['ai_credits'],
                        'credits_remaining'   => $prices[$tier]['ai_credits'],
                        'credits_used'        => 0,
                        'billing_cycle_start' => now()->startOfMonth(),
                        'billing_cycle_end'   => now()->endOfMonth(),
                    ]
                );
            }

            DB::commit();

            Log::info('Super admin manually activated subscription', [
                'restaurant_id' => $restaurant->id,
                'tier'          => $tier,
                'plan_type'     => $planType,
                'by_user_id'    => $request->user()->id,
            ]);

            return response()->json([
                'success' => true,
                'message' => "המנוי הופעל ידנית למסעדה {$restaurant->name}",
                'restaurant' => $restaurant->fresh(),
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'שגיאה בהפעלת מנוי: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function chargeRestaurant(Request $request, $id)
    {
        $validated = $request->validate([
            'amount' => 'required|numeric|min:0.01',
            'currency' => 'nullable|string|size:3',
            'reference' => 'nullable|string|max:255',
            'method' => 'nullable|string|max:100',
            'paid_at' => 'nullable|date',
            'period_start' => 'nullable|date',
            'period_end' => 'nullable|date',
        ]);

        $restaurant = Restaurant::findOrFail($id);

        DB::beginTransaction();
        try {
            $subscription = RestaurantSubscription::firstOrCreate(
                ['restaurant_id' => $restaurant->id],
                [
                    'monthly_fee' => 0,
                    'billing_day' => 1,
                    'currency' => $validated['currency'] ?? 'ILS',
                    'status' => 'active',
                    'outstanding_amount' => 0,
                ]
            );

            $paidAt = isset($validated['paid_at']) ? Carbon::parse($validated['paid_at']) : now();

            $payment = RestaurantPayment::create([
                'restaurant_id' => $restaurant->id,
                'amount' => $validated['amount'],
                'currency' => $validated['currency'] ?? $subscription->currency ?? 'ILS',
                'period_start' => $validated['period_start'] ?? null,
                'period_end' => $validated['period_end'] ?? null,
                'paid_at' => $paidAt,
                'method' => $validated['method'] ?? null,
                'reference' => $validated['reference'] ?? null,
                'status' => 'paid',
            ]);

            $nextChargeAt = $this->calculateNextChargeDate($subscription, $paidAt);
            $outstanding = max(0, ($subscription->outstanding_amount ?? 0) - $payment->amount);

            $subscription->update([
                'last_paid_at' => $paidAt,
                'next_charge_at' => $nextChargeAt,
                'outstanding_amount' => $outstanding,
            ]);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'התשלום נרשם בהצלחה',
                'payment' => $payment,
                'subscription' => $subscription->fresh(),
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'שגיאה ברישום תשלום: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function payments(Request $request)
    {
        $payments = RestaurantPayment::with('restaurant')
            ->when($request->filled('status'), fn($q) => $q->where('status', $request->status))
            ->orderByDesc('paid_at')
            ->orderByDesc('created_at')
            ->paginate(50);

        return response()->json([
            'success' => true,
            'payments' => $payments,
        ]);
    }

    // ============================================
    // Monthly Invoices
    // ============================================

    public function generateInvoices(Request $request, PlatformCommissionService $service)
    {
        $validated = $request->validate([
            'month' => 'required|string|regex:/^\d{4}-\d{2}$/',
            'overwrite_drafts' => 'nullable|boolean',
        ]);

        $results = $service->generateMonthlyInvoices(
            $validated['month'],
            $validated['overwrite_drafts'] ?? false
        );

        return response()->json([
            'success' => true,
            'message' => "נוצרו {$results['generated']} חשבוניות, {$results['skipped']} דולגו",
            'data' => $results,
        ]);
    }

    public function invoices(Request $request)
    {
        $query = MonthlyInvoice::with('restaurant:id,name,tenant_id,tier')
            ->when($request->filled('month'), fn($q) => $q->where('month', $request->month))
            ->when($request->filled('status'), fn($q) => $q->where('status', $request->status))
            ->when($request->filled('restaurant_id'), fn($q) => $q->where('restaurant_id', $request->restaurant_id))
            ->orderByDesc('month')
            ->orderByDesc('created_at');

        $invoices = $query->paginate(50);

        // Summary stats
        $statsQuery = MonthlyInvoice::query();
        if ($request->filled('month')) {
            $statsQuery->where('month', $request->month);
        }

        $stats = [
            'total_due' => (clone $statsQuery)->sum('total_due'),
            'total_paid' => (clone $statsQuery)->where('status', 'paid')->sum('total_due'),
            'draft_count' => (clone $statsQuery)->where('status', 'draft')->count(),
            'pending_count' => (clone $statsQuery)->where('status', 'pending')->count(),
            'overdue_count' => (clone $statsQuery)->where('status', 'overdue')->count(),
            'paid_count' => (clone $statsQuery)->where('status', 'paid')->count(),
        ];

        return response()->json([
            'success' => true,
            'invoices' => $invoices,
            'stats' => $stats,
        ]);
    }

    public function invoiceDetail(int $id)
    {
        $invoice = MonthlyInvoice::with('restaurant:id,name,tenant_id,tier')
            ->findOrFail($id);

        return response()->json([
            'success' => true,
            'invoice' => $invoice,
        ]);
    }

    public function updateInvoice(Request $request, int $id, PlatformCommissionService $service)
    {
        $validated = $request->validate([
            'status' => 'required|string|in:pending,paid,overdue',
            'payment_link' => 'nullable|string|max:500',
            'notes' => 'nullable|string|max:1000',
        ]);

        $invoice = MonthlyInvoice::findOrFail($id);

        if ($validated['status'] === 'paid') {
            $invoice = $service->markInvoicePaid($id, $validated['payment_link'] ?? null);
        } else {
            $invoice->update([
                'status' => $validated['status'],
                'payment_link' => $validated['payment_link'] ?? $invoice->payment_link,
                'notes' => $validated['notes'] ?? $invoice->notes,
            ]);
        }

        return response()->json([
            'success' => true,
            'message' => 'החשבונית עודכנה בהצלחה',
            'invoice' => $invoice->fresh()->load('restaurant:id,name,tenant_id'),
        ]);
    }

    public function finalizeInvoices(Request $request, PlatformCommissionService $service)
    {
        $validated = $request->validate([
            'month' => 'required|string|regex:/^\d{4}-\d{2}$/',
        ]);

        $count = $service->finalizeInvoices($validated['month']);

        return response()->json([
            'success' => true,
            'message' => "סופקו {$count} חשבוניות",
            'finalized_count' => $count,
        ]);
    }

    public function updateBillingConfig(Request $request, int $id)
    {
        $validated = $request->validate([
            'billing_model' => 'required|string|in:flat,percentage,hybrid',
            'base_fee' => 'required|numeric|min:0',
            'commission_percent' => 'required|numeric|min:0|max:100',
        ]);

        $restaurant = Restaurant::findOrFail($id);

        $subscription = RestaurantSubscription::firstOrCreate(
            ['restaurant_id' => $restaurant->id],
            [
                'monthly_fee' => $validated['base_fee'],
                'billing_day' => 1,
                'currency' => 'ILS',
                'status' => 'active',
                'outstanding_amount' => 0,
            ]
        );

        $subscription->update([
            'billing_model' => $validated['billing_model'],
            'base_fee' => $validated['base_fee'],
            'commission_percent' => $validated['commission_percent'],
            'monthly_fee' => $validated['base_fee'],
        ]);

        return response()->json([
            'success' => true,
            'message' => 'הגדרות חיוב עודכנו',
            'subscription' => $subscription->fresh(),
        ]);
    }

    // ============================================
    // Invoice PDF & Email
    // ============================================

    public function previewInvoicePdf(int $id, InvoicePdfService $service)
    {
        $invoice = MonthlyInvoice::with('restaurant')->findOrFail($id);
        return $service->streamPdf($invoice);
    }

    public function downloadInvoicePdf(int $id, InvoicePdfService $service)
    {
        $invoice = MonthlyInvoice::with('restaurant')->findOrFail($id);
        return $service->downloadPdf($invoice);
    }

    public function sendInvoiceEmail(Request $request, int $id, InvoicePdfService $service)
    {
        $validated = $request->validate([
            'email' => 'nullable|email',
        ]);

        $invoice = MonthlyInvoice::with('restaurant')->findOrFail($id);

        $email = $validated['email'] ?? $service->getOwnerEmail($invoice->restaurant);

        if (!$email) {
            return response()->json([
                'success' => false,
                'message' => 'לא נמצא אימייל לבעל המסעדה. ניתן לציין אימייל ידנית.',
            ], 400);
        }

        try {
            $pdfContent = $service->getPdfContent($invoice);
            Mail::to($email)->send(new InvoiceMail($invoice, $pdfContent));

            return response()->json([
                'success' => true,
                'message' => 'החשבונית נשלחה בהצלחה ל-' . $email,
                'sent_to' => $email,
            ]);
        } catch (\Exception $e) {
            Log::error('Invoice email failed', [
                'invoice_id' => $id,
                'email' => $email,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'שליחת החשבונית נכשלה: ' . $e->getMessage(),
            ], 500);
        }
    }

    private function calculateNextChargeDate(RestaurantSubscription $subscription, Carbon $from): Carbon
    {
        $billingDay = max(1, min(28, (int) $subscription->billing_day));
        $candidate = (clone $from)->startOfMonth()->day($billingDay);

        if ($candidate->lessThanOrEqualTo($from)) {
            $candidate->addMonth();
        }

        return $candidate;
    }
}

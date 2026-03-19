<?php

namespace App\Http\Controllers;

use App\Models\CartSession;
use App\Models\MonthlyInvoice;
use App\Models\MonitoringAlert;
use App\Models\NotificationLog;
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

        // Order-based revenue data — רק הזמנות שהגיעו למסעדה (לא תקועות בתשלום)
        $orderRevenueMonth = Order::visibleToRestaurant()
            ->whereBetween('created_at', [now()->startOfMonth(), now()->endOfMonth()])
            ->whereNotIn('status', ['cancelled'])
            ->where('is_test', false)
            ->sum('total_amount');
        $orderRevenueTotal = Order::visibleToRestaurant()
            ->whereNotIn('status', ['cancelled'])
            ->where('is_test', false)
            ->sum('total_amount');
        $ordersThisMonth = Order::visibleToRestaurant()
            ->whereBetween('created_at', [now()->startOfMonth(), now()->endOfMonth()])
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

        // תזכורות סל נטוש
        $abandonedCartPackagesSold = (int) RestaurantPayment::where('type', 'abandoned_cart_package')
            ->where('status', 'paid')
            ->whereBetween('created_at', [now()->startOfMonth(), now()->endOfMonth()])
            ->count();
        $abandonedCartRevenueMonth = (float) RestaurantPayment::where('type', 'abandoned_cart_package')
            ->where('status', 'paid')
            ->whereBetween('created_at', [now()->startOfMonth(), now()->endOfMonth()])
            ->sum('amount');
        $restaurantsWithReminders = Restaurant::where('abandoned_cart_reminders_enabled', true)->count();
        $abandonedCartSessionsMonth = CartSession::whereNotNull('reminded_at')
            ->whereBetween('reminded_at', [now()->startOfMonth(), now()->endOfMonth()])
            ->count();

        $pricing = SuperAdminSettingsController::getPricingArray();
        $packagePrices = [50 => 50, 100 => 90, 500 => 400];

        return response()->json([
            'success' => true,
            'data' => [
                'pricing' => $pricing,
                'package_prices' => $packagePrices,
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
                'abandoned_cart_packages_sold' => $abandonedCartPackagesSold,
                'abandoned_cart_revenue_month' => $abandonedCartRevenueMonth,
                'restaurants_with_reminders' => $restaurantsWithReminders,
                'abandoned_cart_sessions_month' => $abandonedCartSessionsMonth,
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
                $q->whereNotIn('status', ['cancelled'])->where('is_test', false)
                    ->where(function ($q2) {
                        $q2->where('payment_method', '!=', 'credit_card')
                            ->orWhere('payment_status', '!=', \App\Models\Order::PAYMENT_PENDING);
                    });
            }])
            ->withSum(['orders as order_revenue' => function ($q) {
                $q->whereNotIn('status', ['cancelled'])->where('is_test', false)
                    ->where(function ($q2) {
                        $q2->where('payment_method', '!=', 'credit_card')
                            ->orWhere('payment_status', '!=', \App\Models\Order::PAYMENT_PENDING);
                    });
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
            'custom_monthly_price' => 'nullable|numeric|min:0',  // דריסת מחיר חודשי
            'custom_yearly_price' => 'nullable|numeric|min:0',   // דריסת מחיר שנתי
            'abandoned_cart_package_size' => 'nullable|integer|in:50,100,500',  // חבילה לכלול בתשלום
            'abandoned_cart_package_amount' => 'nullable|numeric|min:0',
            'setup_fee' => 'nullable|numeric|min:0',  // דמי הקמת מסוף אם לא נגבו
        ]);

        $restaurant = Restaurant::findOrFail($id);
        $prices = SuperAdminSettingsController::getPricingArray();
        $tier = $validated['tier'];
        $planType = $validated['plan_type'];

        // דריסת מחיר — מאפשר הנחות נקודתיות פר מסעדה בלי לשנות את המחיר הפומבי
        $customMonthly = $validated['custom_monthly_price'] ?? null;
        $customYearly = $validated['custom_yearly_price'] ?? null;

        $defaultMonthly = $prices[$tier]['monthly'];
        $defaultYearly = $prices[$tier]['yearly'];

        $effectiveMonthly = $customMonthly !== null ? (float) $customMonthly : $defaultMonthly;
        $effectiveYearly = $customYearly !== null ? (float) $customYearly : $defaultYearly;

        $baseCharge = $planType === 'yearly' ? $effectiveYearly : $effectiveMonthly;
        $monthlyFee = $planType === 'yearly' ? round($baseCharge / 12, 2) : $baseCharge;

        // תוספות: חבילת תזכורות, דמי הקמה, חוב קיים
        $subscription = RestaurantSubscription::firstOrCreate(
            ['restaurant_id' => $restaurant->id],
            ['monthly_fee' => 0, 'billing_day' => 1, 'currency' => 'ILS', 'status' => 'active', 'outstanding_amount' => 0]
        );
        $outstanding = (float) ($subscription->outstanding_amount ?? 0);
        $packageAmount = 0;
        $packageCredits = 0;
        if (!empty($validated['abandoned_cart_package_size'])) {
            $packageCredits = (int) $validated['abandoned_cart_package_size'];
            $packageAmount = (float) ($validated['abandoned_cart_package_amount'] ?? [50 => 50, 100 => 90, 500 => 400][$packageCredits] ?? 0);
        }
        $setupFee = (float) ($validated['setup_fee'] ?? 0);
        $chargeAmount = $baseCharge + $packageAmount + $setupFee + $outstanding;

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

            // רישום התשלום — רק אם תשלום בוצע בפועל
            if ($validated['record_payment'] ?? false) {
                $ref = $validated['payment_reference'] ?? ('manual_' . now()->format('YmdHis'));

                RestaurantPayment::create([
                    'restaurant_id' => $restaurant->id,
                    'type'          => 'subscription',
                    'amount'        => $baseCharge + $setupFee,
                    'currency'      => 'ILS',
                    'period_start'  => $periodStart,
                    'period_end'    => $periodEnd,
                    'paid_at'       => now(),
                    'method'        => 'hyp_credit_card',
                    'reference'     => $ref,
                    'status'        => 'paid',
                ]);

                if ($packageAmount > 0) {
                    RestaurantPayment::create([
                        'restaurant_id' => $restaurant->id,
                        'type'          => 'abandoned_cart_package',
                        'amount'        => $packageAmount,
                        'currency'      => 'ILS',
                        'period_start'  => $periodStart,
                        'period_end'    => $periodEnd,
                        'paid_at'       => now(),
                        'method'        => 'hyp_credit_card',
                        'reference'     => $ref . '_package',
                        'status'        => 'paid',
                    ]);
                    $restaurant->increment('abandoned_cart_sms_balance', $packageCredits);
                }

                // סמן חבילות ממתינות (חוב קיים) כשולמו
                if ($outstanding > 0) {
                    RestaurantPayment::where('restaurant_id', $restaurant->id)
                        ->where('type', 'abandoned_cart_package')
                        ->where('status', 'pending')
                        ->update(['status' => 'paid', 'paid_at' => now()]);
                }
            }

            $restaurantUpdate = [
                'subscription_status'   => 'active',
                'subscription_plan'     => $planType,
                'tier'                  => $tier,
                'ai_credits_monthly'    => $prices[$tier]['ai_credits'] ?? 0,
                'subscription_ends_at'  => $periodEnd,
                'last_payment_at'       => now(),
                'next_payment_at'       => $periodEnd,
                'payment_failed_at'     => null,
                'payment_failure_count' => 0,
            ];

            // שמור מחיר מותאם אישית פר מסעדה
            if ($customMonthly !== null) {
                $restaurantUpdate['monthly_price'] = $effectiveMonthly;
            }
            if ($customYearly !== null) {
                $restaurantUpdate['yearly_price'] = $effectiveYearly;
            }
            if ($setupFee > 0) {
                $restaurantUpdate['hyp_setup_fee_charged'] = true;
            }

            $restaurant->update($restaurantUpdate);

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

            // --- Notifications ---
            $tierLabel = $tier === 'pro' ? 'Pro' : 'Basic';
            $planLabel = $planType === 'yearly' ? 'שנתי' : 'חודשי';
            $breaks = ["₪{$baseCharge} מנוי"];
            if ($setupFee > 0) $breaks[] = "₪{$setupFee} דמי הקמה";
            if ($packageAmount > 0) $breaks[] = "₪{$packageAmount} חבילת תזכורות ({$packageCredits} הודעות)";
            if ($outstanding > 0) $breaks[] = "₪{$outstanding} חוב קודם";
            $priceInfo = " (סהכ ₪{$chargeAmount}" . (count($breaks) > 1 ? ': ' . implode(' + ', $breaks) : '') . ')';

            // Restaurant owner alert
            try {
                MonitoringAlert::create([
                    'tenant_id'     => $restaurant->tenant_id,
                    'restaurant_id' => $restaurant->id,
                    'alert_type'    => 'subscription_activated',
                    'title'         => "המנוי הופעל — {$tierLabel} {$planLabel}",
                    'body'          => "המנוי שלך הופעל בהצלחה! תוכנית {$tierLabel}, מחזור {$planLabel}{$priceInfo}. תוקף עד {$periodEnd->format('d/m/Y')}.",
                    'severity'      => 'info',
                    'metadata'      => [
                        'action' => 'activate',
                        'tier' => $tier,
                        'plan_type' => $planType,
                        'amount' => $chargeAmount,
                        'period_end' => $periodEnd->toDateString(),
                        'custom_price' => $customMonthly !== null || $customYearly !== null,
                    ],
                    'is_read'       => false,
                ]);
            } catch (\Throwable $e) {
                Log::warning('Failed to create restaurant alert for activation', ['error' => $e->getMessage()]);
            }

            // Super admin notification log
            try {
                NotificationLog::create([
                    'channel'  => 'system',
                    'type'     => 'system',
                    'title'    => "הפעלת מנוי: {$restaurant->name}",
                    'body'     => "הופעל מנוי {$tierLabel} {$planLabel}{$priceInfo} למסעדה {$restaurant->name}." . (($validated['note'] ?? null) ? " הערה: {$validated['note']}" : ''),
                    'sender_id' => $request->user()->id,
                    'target_restaurant_ids' => [$restaurant->id],
                    'tokens_targeted' => 0,
                    'sent_ok' => 0,
                    'metadata' => [
                        'action' => 'manual_activate',
                        'restaurant_id' => $restaurant->id,
                        'tier' => $tier,
                        'plan_type' => $planType,
                        'amount' => $chargeAmount,
                        'record_payment' => $validated['record_payment'] ?? false,
                        'custom_price' => $customMonthly !== null || $customYearly !== null,
                    ],
                ]);
            } catch (\Throwable $e) {
                Log::warning('Failed to create notification log for activation', ['error' => $e->getMessage()]);
            }

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

    /**
     * החזרה לתקופת ניסיון — אתחול מחדש לבדיקת פלואו
     * POST /super-admin/billing/restaurants/{id}/reset-trial
     */
    public function resetToTrial(Request $request, $id)
    {
        $validated = $request->validate([
            'tier' => 'required|in:basic,pro',
            'trial_days' => 'nullable|integer|min:1|max:90',
            'note' => 'nullable|string|max:500',
        ]);

        $restaurant = Restaurant::findOrFail($id);
        $prices = SuperAdminSettingsController::getPricingArray();
        $tier = $validated['tier'];
        $trialDays = (int) ($validated['trial_days'] ?? 14);
        $trialEndsAt = now()->addDays($trialDays)->endOfDay();

        DB::beginTransaction();
        try {
            $aiCredits = $tier === 'pro' ? ($prices[$tier]['trial_ai_credits'] ?? 50) : 0;

            $restaurant->update([
                'subscription_status'   => 'trial',
                'subscription_plan'     => null,
                'tier'                  => $tier,
                'ai_credits_monthly'    => $tier === 'pro' ? ($prices[$tier]['ai_credits'] ?? 500) : 0,
                'trial_ends_at'         => $trialEndsAt,
                'subscription_ends_at'  => null,
                'last_payment_at'       => null,
                'next_payment_at'       => null,
                'payment_failed_at'     => null,
                'payment_failure_count' => 0,
            ]);

            RestaurantSubscription::updateOrCreate(
                ['restaurant_id' => $restaurant->id],
                [
                    'plan_type'          => 'monthly',
                    'monthly_fee'        => 0,
                    'billing_day'        => 1,
                    'currency'           => 'ILS',
                    'status'             => 'trial',
                    'outstanding_amount' => 0,
                    'next_charge_at'     => $trialEndsAt,
                    'last_paid_at'       => null,
                ]
            );

            if ($validated['note'] ?? null) {
                $sub = RestaurantSubscription::where('restaurant_id', $restaurant->id)->first();
                if ($sub) {
                    $sub->update([
                        'notes' => trim(($sub->notes ?? '') . "\n" . now()->format('Y-m-d') . " - החזרה לניסיון: " . $validated['note']),
                    ]);
                }
            }

            if ($tier === 'pro' && $aiCredits > 0) {
                \App\Models\AiCredit::updateOrCreate(
                    ['restaurant_id' => $restaurant->id],
                    [
                        'tenant_id'           => $restaurant->tenant_id,
                        'tier'                => $tier,
                        'monthly_limit'       => $aiCredits,
                        'credits_remaining'   => $aiCredits,
                        'credits_used'        => 0,
                        'billing_cycle_start' => now()->startOfMonth(),
                        'billing_cycle_end'   => now()->endOfMonth(),
                    ]
                );
            } elseif ($tier === 'basic') {
                $ac = \App\Models\AiCredit::where('restaurant_id', $restaurant->id)->first();
                if ($ac) {
                    $ac->update(['tier' => 'basic', 'monthly_limit' => 0, 'credits_remaining' => 0]);
                }
            }

            DB::commit();

            // --- Notifications ---
            $tierLabel = $tier === 'pro' ? 'Pro' : 'Basic';

            try {
                MonitoringAlert::create([
                    'tenant_id'     => $restaurant->tenant_id,
                    'restaurant_id' => $restaurant->id,
                    'alert_type'    => 'subscription_trial_reset',
                    'title'         => "תקופת ניסיון חדשה — {$trialDays} ימים",
                    'body'          => "החשבון שלך הוחזר לתקופת ניסיון של {$trialDays} ימים, תוכנית {$tierLabel}. תוקף עד {$trialEndsAt->format('d/m/Y')}.",
                    'severity'      => 'info',
                    'metadata'      => [
                        'action' => 'trial_reset',
                        'tier' => $tier,
                        'trial_days' => $trialDays,
                        'trial_ends_at' => $trialEndsAt->toDateString(),
                    ],
                    'is_read'       => false,
                ]);
            } catch (\Throwable $e) {
                Log::warning('Failed to create restaurant alert for trial reset', ['error' => $e->getMessage()]);
            }

            try {
                NotificationLog::create([
                    'channel'  => 'system',
                    'type'     => 'system',
                    'title'    => "החזרה לניסיון: {$restaurant->name}",
                    'body'     => "המסעדה {$restaurant->name} הוחזרה לתקופת ניסיון של {$trialDays} ימים, תוכנית {$tierLabel}." . (($validated['note'] ?? null) ? " הערה: {$validated['note']}" : ''),
                    'sender_id' => $request->user()->id,
                    'target_restaurant_ids' => [$restaurant->id],
                    'tokens_targeted' => 0,
                    'sent_ok' => 0,
                    'metadata' => [
                        'action' => 'trial_reset',
                        'restaurant_id' => $restaurant->id,
                        'tier' => $tier,
                        'trial_days' => $trialDays,
                    ],
                ]);
            } catch (\Throwable $e) {
                Log::warning('Failed to create notification log for trial reset', ['error' => $e->getMessage()]);
            }

            Log::info('Super admin reset restaurant to trial', [
                'restaurant_id' => $restaurant->id,
                'tier'          => $tier,
                'trial_days'    => $trialDays,
                'by_user_id'    => $request->user()->id,
            ]);

            return response()->json([
                'success' => true,
                'message' => "המסעדה הוחזרה לתקופת ניסיון של {$trialDays} ימים (מסלול {$tier})",
                'restaurant' => $restaurant->fresh(),
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'שגיאה: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function grantFreeMonth(Request $request, $id)
    {
        $validated = $request->validate([
            'months' => 'nullable|integer|min:1|max:12',
            'note' => 'nullable|string|max:500',
        ]);

        $restaurant = Restaurant::findOrFail($id);
        $months = (int) ($validated['months'] ?? 1);

        if (!in_array($restaurant->subscription_status, ['active', 'trial'])) {
            return response()->json([
                'success' => false,
                'message' => 'ניתן להאריך רק מנוי פעיל או בתקופת ניסיון.',
            ], 422);
        }

        DB::beginTransaction();
        try {
            $baseDate = $restaurant->next_payment_at ?? $restaurant->subscription_ends_at ?? now();
            $newDate = $baseDate->copy()->addMonths($months);

            $restaurant->update([
                'next_payment_at'      => $newDate,
                'subscription_ends_at' => $newDate,
            ]);

            $subscription = RestaurantSubscription::where('restaurant_id', $restaurant->id)->first();
            if ($subscription) {
                $subBaseDate = $subscription->next_charge_at ?? $baseDate;
                $subscription->update([
                    'next_charge_at' => $subBaseDate->copy()->addMonths($months),
                    'notes' => trim(
                        ($subscription->notes ?? '') . "\n"
                            . now()->format('Y-m-d') . " - הארכה חינם ({$months} חודשים)"
                            . (($validated['note'] ?? null) ? ': ' . $validated['note'] : '')
                    ),
                ]);
            }

            DB::commit();

            // --- Notifications ---
            $monthsLabel = $months === 1 ? 'חודש אחד' : "{$months} חודשים";

            try {
                MonitoringAlert::create([
                    'tenant_id'     => $restaurant->tenant_id,
                    'restaurant_id' => $restaurant->id,
                    'alert_type'    => 'subscription_free_extension',
                    'title'         => "הטבה — {$monthsLabel} חינם!",
                    'body'          => "קיבלת הארכת מנוי חינם ל-{$monthsLabel}! התשלום הבא נדחה ל-{$newDate->format('d/m/Y')}." . (($validated['note'] ?? null) ? " סיבה: {$validated['note']}" : ''),
                    'severity'      => 'info',
                    'metadata'      => [
                        'action' => 'free_extension',
                        'months' => $months,
                        'new_payment_date' => $newDate->toDateString(),
                    ],
                    'is_read'       => false,
                ]);
            } catch (\Throwable $e) {
                Log::warning('Failed to create restaurant alert for free extension', ['error' => $e->getMessage()]);
            }

            try {
                NotificationLog::create([
                    'channel'  => 'system',
                    'type'     => 'system',
                    'title'    => "הארכה חינם: {$restaurant->name}",
                    'body'     => "הוארך {$monthsLabel} חינם למסעדה {$restaurant->name}. תשלום הבא: {$newDate->format('d/m/Y')}." . (($validated['note'] ?? null) ? " סיבה: {$validated['note']}" : ''),
                    'sender_id' => $request->user()->id,
                    'target_restaurant_ids' => [$restaurant->id],
                    'tokens_targeted' => 0,
                    'sent_ok' => 0,
                    'metadata' => [
                        'action' => 'free_extension',
                        'restaurant_id' => $restaurant->id,
                        'months' => $months,
                        'new_payment_date' => $newDate->toDateString(),
                    ],
                ]);
            } catch (\Throwable $e) {
                Log::warning('Failed to create notification log for free extension', ['error' => $e->getMessage()]);
            }

            Log::info('Super admin granted free months', [
                'restaurant_id' => $restaurant->id,
                'months'        => $months,
                'new_next_payment' => $newDate->toDateString(),
                'by_user_id'    => $request->user()->id,
            ]);

            return response()->json([
                'success' => true,
                'message' => "הוארך חינם {$months} חודשים למסעדה {$restaurant->name}. תשלום הבא: {$newDate->format('d/m/Y')}",
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'שגיאה: ' . $e->getMessage(),
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
            ->when($request->filled('type'), fn($q) => $q->where('type', $request->type))
            ->orderByDesc('paid_at')
            ->orderByDesc('created_at')
            ->paginate(50);

        return response()->json([
            'success' => true,
            'payments' => $payments,
        ]);
    }

    /**
     * הוספת חבילת תזכורות סל נטוש למסעדה — מתווסף לחוב, יתרה ניתנת מיד.
     * התשלום יתבצע כשירשום תשלום (בהפעלת מנוי או חיוב נפרד).
     */
    public function addAbandonedCartPackage(Request $request, $id)
    {
        $validated = $request->validate([
            'package_size' => 'required|integer|in:50,100,500',
            'amount' => 'required|numeric|min:0',
            'reference' => 'nullable|string|max:255',
            'method' => 'nullable|string|max:100',
        ]);

        $restaurant = Restaurant::findOrFail($id);
        $credits = $validated['package_size'];
        $amount = (float) $validated['amount'];

        DB::beginTransaction();
        try {
            RestaurantPayment::create([
                'restaurant_id' => $restaurant->id,
                'type' => 'abandoned_cart_package',
                'amount' => $amount,
                'currency' => 'ILS',
                'paid_at' => null,
                'method' => $validated['method'] ?? 'manual',
                'reference' => $validated['reference'] ?? "חבילת תזכורות {$credits} הודעות",
                'status' => 'pending',
            ]);

            $restaurant->increment('abandoned_cart_sms_balance', $credits);

            $subscription = RestaurantSubscription::firstOrCreate(
                ['restaurant_id' => $restaurant->id],
                ['monthly_fee' => 0, 'billing_day' => 1, 'currency' => 'ILS', 'status' => 'active', 'outstanding_amount' => 0]
            );
            $subscription->increment('outstanding_amount', $amount);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => "נוספו {$credits} הודעות. יתרה: {$restaurant->fresh()->abandoned_cart_sms_balance}. החיוב (₪{$amount}) יתווסף לתשלום הבא.",
                'balance' => $restaurant->fresh()->abandoned_cart_sms_balance,
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'שגיאה: ' . $e->getMessage(),
            ], 500);
        }
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

<?php

namespace App\Http\Controllers;

use App\Models\Restaurant;
use App\Models\RestaurantPayment;
use App\Models\RestaurantSubscription;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SuperAdminBillingController extends Controller
{
    public function summary()
    {
        $monthlyExpected = RestaurantSubscription::where('status', 'active')->sum('monthly_fee');
        $outstanding = RestaurantSubscription::sum('outstanding_amount');
        $paidThisMonth = RestaurantPayment::where('status', 'paid')
            ->whereBetween('paid_at', [now()->startOfMonth(), now()->endOfMonth()])
            ->sum('amount');

        return response()->json([
            'success' => true,
            'data' => [
                'monthly_expected' => $monthlyExpected,
                'outstanding' => $outstanding,
                'paid_this_month' => $paidThisMonth,
                'total_restaurants' => Restaurant::count(),
            ],
        ]);
    }

    public function restaurants(Request $request)
    {
        $query = Restaurant::query()
            ->with('subscription')
            ->withSum(['payments as total_paid_ytd' => function ($q) {
                $q->whereYear('paid_at', now()->year)->where('status', 'paid');
            }], 'amount');

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('tenant_id', 'like', "%{$search}%");
            });
        }

        $restaurants = $query->orderBy('created_at', 'desc')->paginate(50);

        $restaurants->getCollection()->transform(function ($restaurant) {
            $subscription = $restaurant->subscription;
            $restaurant->monthly_fee = $subscription?->monthly_fee ?? 0;
            $restaurant->billing_day = $subscription?->billing_day;
            $restaurant->billing_status = $subscription?->status ?? 'inactive';
            $restaurant->outstanding_amount = $subscription?->outstanding_amount ?? 0;
            $restaurant->next_charge_at = $subscription?->next_charge_at;
            $restaurant->last_paid_at = $subscription?->last_paid_at;
            $restaurant->total_paid_ytd = $restaurant->total_paid_ytd ?? 0;
            return $restaurant;
        });

        return response()->json([
            'success' => true,
            'restaurants' => $restaurants,
        ]);
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

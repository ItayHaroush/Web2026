<?php

namespace App\Http\Controllers;

use App\Models\Restaurant;
use App\Models\RestaurantPayment;
use App\Models\RestaurantSubscription;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class RegisterRestaurantController extends Controller
{
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'tenant_id' => 'required|string|max:255|unique:restaurants,tenant_id|regex:/^[a-z0-9-]+$/',
            'phone' => 'required|string|max:20',
            'address' => 'nullable|string',
            'logo_url' => 'nullable|url',
            'owner_name' => 'required|string|max:255',
            'owner_email' => 'required|email|unique:users,email',
            'owner_phone' => 'required|string|max:20',
            'password' => 'required|string|min:6',
            'plan_type' => 'required|in:monthly,annual',
            'paid_upfront' => 'nullable|boolean',
        ]);

        $monthlyPrice = 600; // ILS
        $annualPrice = 5000; // ILS

        $planType = $validated['plan_type'];
        $paidUpfront = (bool) ($validated['paid_upfront'] ?? false);

        $chargeAmount = $planType === 'annual' ? $annualPrice : $monthlyPrice;
        $monthlyFeeForTracking = $planType === 'annual' ? round($annualPrice / 12, 2) : $monthlyPrice;

        DB::beginTransaction();
        try {
            // ודא slug תקין מה-name (לא מ-tenant_id)
            $slugValue = Str::slug($validated['name']);
            $tenantId = $validated['tenant_id'];

            if (empty($tenantId) || empty($slugValue)) {
                throw new \Exception('tenant_id and slug are required');
            }

            $restaurant = Restaurant::create([
                'tenant_id' => $tenantId,
                'name' => $validated['name'],
                'slug' => $slugValue,
                'phone' => $validated['phone'],
                'address' => $validated['address'] ?? null,
                'description' => null,
                'logo_url' => $validated['logo_url'] ?? null,
                'is_open' => false,
            ]);

            $owner = User::create([
                'restaurant_id' => $restaurant->id,
                'name' => $validated['owner_name'],
                'email' => $validated['owner_email'],
                'phone' => $validated['owner_phone'],
                'password' => Hash::make($validated['password']),
                'role' => 'owner',
                'is_active' => true,
            ]);

            $billingDay = now()->day > 28 ? 28 : now()->day;
            $nextCharge = $planType === 'annual'
                ? now()->addYear()->startOfDay()
                : now()->addMonth()->startOfDay();

            $subscription = RestaurantSubscription::create([
                'restaurant_id' => $restaurant->id,
                'plan_type' => $planType,
                'monthly_fee' => $monthlyFeeForTracking,
                'billing_day' => $billingDay,
                'currency' => 'ILS',
                'status' => 'active',
                'outstanding_amount' => $paidUpfront ? 0 : $chargeAmount,
                'next_charge_at' => $nextCharge,
                'last_paid_at' => $paidUpfront ? now() : null,
            ]);

            $payment = null;
            if ($paidUpfront) {
                $payment = RestaurantPayment::create([
                    'restaurant_id' => $restaurant->id,
                    'amount' => $chargeAmount,
                    'currency' => 'ILS',
                    'period_start' => now()->startOfDay(),
                    'period_end' => $planType === 'annual'
                        ? now()->addYear()->startOfDay()
                        : now()->addMonth()->startOfDay(),
                    'paid_at' => now(),
                    'method' => 'manual',
                    'reference' => 'initial_signup',
                    'status' => 'paid',
                ]);
            }

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'ההרשמה בוצעה בהצלחה',
                'restaurant' => $restaurant,
                'owner' => $owner,
                'subscription' => $subscription,
                'payment' => $payment,
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'שגיאה בהרשמה: ' . $e->getMessage(),
            ], 500);
        }
    }
}

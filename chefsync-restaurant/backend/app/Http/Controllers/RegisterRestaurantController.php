<?php

namespace App\Http\Controllers;

use App\Models\Restaurant;
use App\Models\RestaurantPayment;
use App\Models\RestaurantSubscription;
use App\Models\PhoneVerification;
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
            'city' => 'required|string|exists:cities,name',
            'logo' => 'nullable|image|mimes:jpeg,png,jpg,webp|max:2048',
            'logo_url' => 'nullable|url',
            'owner_name' => 'required|string|max:255',
            'owner_email' => 'required|email|unique:users,email',
            'owner_phone' => 'required|string|max:20',
            'password' => 'required|string|min:6|confirmed',
            'password_confirmation' => 'required|string|min:6',
            'plan_type' => 'required|in:monthly,annual',
            'paid_upfront' => 'nullable|boolean',
            'verification_code' => 'required|string',
        ]);

        // אימות קוד טלפון לבעלים
        $ownerPhoneNormalized = $this->normalizePhone($validated['owner_phone']);
        $verification = PhoneVerification::where('phone', $ownerPhoneNormalized)
            ->orderByDesc('id')
            ->first();

        if (!$verification) {
            return response()->json(['success' => false, 'message' => 'קוד אימות לא נמצא'], 400);
        }
        if ($verification->verified_at) {
            // כבר אומת בעבר – ממשיכים
        } else {
            if ($verification->expires_at < Carbon::now()) {
                return response()->json(['success' => false, 'message' => 'פג תוקף הקוד'], 400);
            }
            if ($verification->attempts >= 3) {
                return response()->json(['success' => false, 'message' => 'יותר מדי ניסיונות'], 429);
            }
            $verification->attempts++;
            $verification->save();

            if (!Hash::check($validated['verification_code'], $verification->code_hash)) {
                return response()->json(['success' => false, 'message' => 'קוד שגוי'], 400);
            }
            $verification->verified_at = Carbon::now();
            $verification->save();
        }

        $monthlyPrice = 600; // ILS
        $annualPrice = 5000; // ILS

        $planType = $validated['plan_type'];
        $paidUpfront = (bool) ($validated['paid_upfront'] ?? false);

        $trialEndsAt = now()->addDays(14)->endOfDay();
        $planDurationEnd = $planType === 'annual'
            ? $trialEndsAt->copy()->addYear()
            : $trialEndsAt->copy()->addMonth();
        $subscriptionStatus = $paidUpfront ? 'active' : 'trial';

        $chargeAmount = $planType === 'annual' ? $annualPrice : $monthlyPrice;
        $monthlyFeeForTracking = $planType === 'annual' ? round($annualPrice / 12, 2) : $monthlyPrice;

        $logoUrl = null;
        if ($request->hasFile('logo') && $request->file('logo')->isValid()) {
            $logoPath = $request->file('logo')->store('logos', 'public');
            $logoUrl = '/storage/' . $logoPath;
        } elseif (!empty($request->input('logo_url'))) {
            // שמור תאימות אחורה אם נשלח URL ישיר
            $logoUrl = $request->input('logo_url');
        }

        DB::beginTransaction();
        try {
            // בנה slug מהשם; אם ריק (למשל שם בעברית) נFallback ל-tenant_id
            $slugValue = Str::slug($validated['name']);
            $tenantId = $validated['tenant_id'];

            if (empty($slugValue)) {
                $slugValue = Str::slug($tenantId) ?: $tenantId;
            }

            $restaurant = Restaurant::create([
                'tenant_id' => $tenantId,
                'name' => $validated['name'],
                'slug' => $slugValue,
                'phone' => $this->normalizePhone($validated['phone']),
                'address' => $validated['address'] ?? null,
                'city' => $validated['city'],
                'description' => null,
                'logo_url' => $logoUrl,
                'is_open' => false,
                'subscription_status' => $subscriptionStatus,
                'trial_ends_at' => $trialEndsAt,
                'subscription_plan' => $planType,
                'subscription_ends_at' => $subscriptionStatus === 'active' ? $planDurationEnd : $trialEndsAt,
                'last_payment_at' => $paidUpfront ? now() : null,
                'next_payment_at' => $subscriptionStatus === 'active'
                    ? ($planType === 'annual'
                        ? $planDurationEnd->copy()->addYear()
                        : $planDurationEnd->copy()->addMonth())
                    : $trialEndsAt,
            ]);

            $owner = User::create([
                'restaurant_id' => $restaurant->id,
                'name' => $validated['owner_name'],
                'email' => $validated['owner_email'],
                'phone' => $ownerPhoneNormalized,
                'password' => Hash::make($validated['password']),
                'role' => 'owner',
                'is_active' => true,
            ]);

            $billingDay = now()->day > 28 ? 28 : now()->day;
            $nextCharge = $paidUpfront
                ? ($planType === 'annual'
                    ? $planDurationEnd->copy()->addYear()->startOfDay()
                    : $planDurationEnd->copy()->addMonth()->startOfDay())
                : $trialEndsAt->copy()->startOfDay();

            $subscription = RestaurantSubscription::create([
                'restaurant_id' => $restaurant->id,
                'plan_type' => $planType,
                'monthly_fee' => $monthlyFeeForTracking,
                'billing_day' => $billingDay,
                'currency' => 'ILS',
                'status' => $subscriptionStatus,
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
                    'period_start' => $trialEndsAt->copy()->startOfDay(),
                    'period_end' => $planDurationEnd->copy()->startOfDay(),
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

    private function normalizePhone(string $raw): string
    {
        $phone = preg_replace('/\s+/', '', $raw);
        if (str_starts_with($phone, '0')) {
            return '+972' . substr($phone, 1);
        }
        return $phone;
    }
}

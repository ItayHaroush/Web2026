<?php

namespace App\Http\Controllers;

use App\Mail\WelcomeMail;
use App\Models\City;
use App\Models\PhoneVerification;
use App\Models\Restaurant;
use App\Models\RestaurantPayment;
use App\Models\RestaurantSubscription;
use App\Models\User;
use App\Models\WoltImportRequest;
use App\Services\PhoneValidationService;
use App\Services\CitySearchService;
use App\Services\SystemErrorReporter;
use App\Services\WoltMenuImportService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
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
            'city_id' => 'nullable|integer|exists:cities,id|required_without:city',
            'city' => 'nullable|string|max:255|required_without:city_id',
            'logo' => 'nullable|image|mimes:jpeg,png,jpg,webp|max:2048',
            'logo_url' => 'nullable|url',
            'owner_name' => 'required|string|max:255',
            'owner_email' => 'required|email|unique:users,email',
            'owner_phone' => 'required|string|max:20',
            'password' => 'required|string|min:6|confirmed',
            'password_confirmation' => 'required|string|min:6',
            'tier' => 'required|in:basic,pro,enterprise',
            'plan_type' => 'required|in:monthly,yearly,annual',
            'paid_upfront' => 'nullable|boolean',
            'verification_code' => 'required|string',
            'latitude' => 'nullable|numeric|between:-90,90',
            'longitude' => 'nullable|numeric|between:-180,180',
            'wolt_url' => 'nullable|string|max:500',
            // JSON שנבנה בדף בחירת המוצרים: { mode, slug, summary, categories, restaurant_meta }
            'wolt_selection' => 'nullable|string',
        ]);

        // אימות קוד טלפון לבעלים
        $ownerPhoneNormalized = PhoneValidationService::normalizeIsraeliMobileE164($validated['owner_phone']);
        if (! $ownerPhoneNormalized) {
            return response()->json([
                'success' => false,
                'message' => 'מספר טלפון בעלים לא תקין (נייד ישראלי בלבד)',
            ], 422);
        }
        $verification = PhoneVerification::where('phone', $ownerPhoneNormalized)
            ->orderByDesc('id')
            ->first();

        if (! $verification) {
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

            if (! Hash::check($validated['verification_code'], $verification->code_hash)) {
                return response()->json(['success' => false, 'message' => 'קוד שגוי'], 400);
            }
            $verification->verified_at = Carbon::now();
            $verification->save();
        }

        // מחירים דינמיים מ-SystemSettings
        $pricing = SuperAdminSettingsController::getPricingArray();

        $tier = $validated['tier'];
        $planType = $validated['plan_type'];
        $paidUpfront = (bool) ($validated['paid_upfront'] ?? false);

        $monthlyPrice = $pricing[$tier]['monthly'];
        $yearlyPrice = $pricing[$tier]['yearly'];
        // אם Pro בניסיון (לא שילם מראש) - רק 50 credits, אחרת מלא
        $aiCreditsMonthly = $tier === 'pro' && ! $paidUpfront
            ? $pricing[$tier]['trial_ai_credits']
            : $pricing[$tier]['ai_credits'];

        // תמיכה גם ב-annual (legacy) וגם ב-yearly (חדש)
        $isYearly = in_array($planType, ['annual', 'yearly']);
        $chargeAmount = $isYearly ? $yearlyPrice : $monthlyPrice;
        $monthlyFeeForTracking = $isYearly ? round($yearlyPrice / 12, 2) : $monthlyPrice;

        $trialDays = (int) (\App\Models\SystemSetting::get('trial_duration_days') ?? 60);
        $trialStartsAt = now();
        $trialEndsAt = $trialStartsAt->copy()->addDays($trialDays)->endOfDay();
        $planDurationEnd = $isYearly
            ? $trialEndsAt->copy()->addYear()
            : $trialEndsAt->copy()->addMonth();
        $subscriptionStatus = $paidUpfront ? 'active' : 'trial';

        $logoUrl = null;
        if ($request->hasFile('logo') && $request->file('logo')->isValid()) {
            $logoPath = $request->file('logo')->store('logos', 'public');
            $logoUrl = '/storage/' . $logoPath;
        } elseif (! empty($request->input('logo_url'))) {
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

            // Resolve city identity (prefer city_id, keep backward compatibility with city name)
            $cityModel = null;
            if (! empty($validated['city_id'])) {
                $cityModel = City::where('id', $validated['city_id'])
                    ->where('approval_status', 'approved')
                    ->first();
            } elseif (! empty($validated['city'])) {
                $inputCity = trim((string) $validated['city']);

                $cityModel = City::where('name', $inputCity)
                    ->orWhere('hebrew_name', $inputCity)
                    ->where('approval_status', 'approved')
                    ->first();

                // If no approved city exists, create a pending suggestion for super-admin approval.
                if (! $cityModel && $inputCity !== '') {
                    // Try to queue OSM-based pending suggestion with coordinates for super-admin review.
                    app(CitySearchService::class)->search($inputCity, 5);

                    $normalized = Str::lower($inputCity);

                    $pending = City::where('normalized_name', $normalized)
                        ->whereIn('approval_status', ['pending', 'approved'])
                        ->first();

                    if (! $pending) {
                        City::create([
                            'name' => $inputCity,
                            'hebrew_name' => $inputCity,
                            'normalized_name' => $normalized,
                            'source' => 'manual',
                            'approval_status' => 'pending',
                        ]);
                    }
                }
            }

            $resolvedCityName = $cityModel?->hebrew_name ?: $cityModel?->name ?: ($validated['city'] ?? null);

            // קביעת קואורדינטות - עדיפות לערכים ידניים אם סופקו
            $latitude = null;
            $longitude = null;

            if ($request->filled(['latitude', 'longitude'])) {
                $latitude = $validated['latitude'];
                $longitude = $validated['longitude'];
            } else {
                $latitude = $cityModel?->latitude;
                $longitude = $cityModel?->longitude;
            }

            $restaurant = Restaurant::create([
                'tenant_id' => $tenantId,
                'name' => $validated['name'],
                'slug' => $slugValue,

                'phone' => $this->formatPhoneForDisplay($validated['phone']),
                'address' => $validated['address'] ?? null,
                'city' => $resolvedCityName,
                'latitude' => $latitude,
                'longitude' => $longitude,
                'description' => null,
                'logo_url' => $logoUrl,
                'is_open' => false,
                'is_approved' => false,
                'tier' => $tier,
                'ai_credits_monthly' => $aiCreditsMonthly,
                'subscription_status' => $subscriptionStatus,
                'trial_started_at' => $subscriptionStatus === 'trial' ? $trialStartsAt : null,
                'trial_ends_at' => $trialEndsAt,
                'subscription_plan' => $isYearly ? 'yearly' : 'monthly',
                'subscription_ends_at' => $subscriptionStatus === 'active' ? $planDurationEnd : $trialEndsAt,
                'last_payment_at' => $paidUpfront ? now() : null,
                'next_payment_at' => $subscriptionStatus === 'active'
                    ? ($isYearly
                        ? $planDurationEnd->copy()->addYear()
                        : $planDurationEnd->copy()->addMonth())
                    : $trialEndsAt,
                'monthly_price' => $monthlyPrice,
                'yearly_price' => $yearlyPrice,
            ]);

            // ייבוא מוולט לא מתבצע ישירות בהרשמה — נוצרת בקשת ייבוא הממתינה לאישור סופר-אדמין.
            $woltImportRequest = null;
            $importWarning = null;
            if (! empty($validated['wolt_url'])) {
                try {
                    $woltImportRequest = $this->createWoltImportRequest(
                        $restaurant,
                        $validated['wolt_url'],
                        $validated['wolt_selection'] ?? null
                    );
                } catch (\Throwable $importException) {
                    Log::warning('Wolt import request creation failed during registration', [
                        'restaurant_id' => $restaurant->id,
                        'tenant_id' => $restaurant->tenant_id,
                        'wolt_url' => $validated['wolt_url'],
                        'error' => $importException->getMessage(),
                    ]);

                    $importWarning = 'ההרשמה הושלמה, אך לא הצלחנו לשמור את בקשת הייבוא מוולט. אפשר לפנות לתמיכה או להזין תפריט ידנית.';
                }
            }

            $owner = User::create([
                'restaurant_id' => $restaurant->id,
                'name' => $validated['owner_name'],
                'email' => $validated['owner_email'],
                'phone' => $this->formatPhoneForDisplay($validated['owner_phone']),
                'password' => Hash::make($validated['password']),
                'role' => 'owner',
                'is_active' => true,
            ]);

            // אתחול רשומת AI Credits
            if ($aiCreditsMonthly > 0) {
                \App\Models\AiCredit::create([
                    'tenant_id' => $restaurant->tenant_id,
                    'restaurant_id' => $restaurant->id,
                    'tier' => $tier,
                    'monthly_limit' => $aiCreditsMonthly,
                    'credits_remaining' => $aiCreditsMonthly,
                    'credits_used' => 0,
                    'billing_cycle_start' => now()->startOfMonth(),
                    'billing_cycle_end' => now()->endOfMonth(),
                ]);
            }

            $billingDay = now()->day > 28 ? 28 : now()->day;
            $nextCharge = $paidUpfront
                ? ($isYearly
                    ? $planDurationEnd->copy()->addYear()->startOfDay()
                    : $planDurationEnd->copy()->addMonth()->startOfDay())
                : $trialEndsAt->copy()->startOfDay();

            $subscription = RestaurantSubscription::create([
                'restaurant_id' => $restaurant->id,
                'plan_type' => $isYearly ? 'yearly' : 'monthly',
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

            // שליחת מייל ברכה לבעל המסעדה
            try {
                Mail::to($owner->email)->send(new WelcomeMail($restaurant, $owner->name, $owner->email));
                \App\Services\EmailLogService::log($owner->email, 'restaurant_welcome', 'ברוכים הבאים - הרשמת מסעדה', null, 'sent', null, ['restaurant_id' => $restaurant->id]);
            } catch (\Exception $mailError) {
                Log::warning('Welcome email failed', [
                    'restaurant_id' => $restaurant->id,
                    'email' => $owner->email,
                    'error' => $mailError->getMessage(),
                ]);
                SystemErrorReporter::report(
                    'email_failure',
                    'מייל welcome להרשמת מסעדה נכשל: ' . $mailError->getMessage(),
                    'warning',
                    $restaurant->tenant_id,
                    null,
                    null,
                    $mailError->getTraceAsString(),
                    ['restaurant_id' => $restaurant->id, 'context' => 'restaurant_registration_welcome']
                );
                try {
                    \App\Services\EmailLogService::log($owner->email, 'restaurant_welcome', 'ברוכים הבאים - הרשמת מסעדה', null, 'failed', $mailError->getMessage());
                } catch (\Throwable $ignore) {
                }
            }

            return response()->json([
                'success' => true,
                'message' => 'ההרשמה בוצעה בהצלחה',
                'restaurant' => $restaurant,
                'owner' => $owner,
                'subscription' => $subscription,
                'payment' => $payment,
                'wolt_import_request' => $woltImportRequest ? [
                    'id' => $woltImportRequest->id,
                    'status' => $woltImportRequest->status,
                    'selection_mode' => $woltImportRequest->selection_mode,
                    'summary' => $woltImportRequest->summary,
                ] : null,
                'wolt_import_error' => $importWarning,
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            SystemErrorReporter::report(
                'registration_failed',
                'הרשמת מסעדה נכשלה: ' . $e->getMessage(),
                'error',
                null,
                null,
                null,
                $e->getTraceAsString(),
                ['context' => 'register_restaurant_store']
            );

            return response()->json([
                'success' => false,
                'message' => 'שגיאה בהרשמה: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * יצירת בקשת ייבוא מוולט הממתינה לאישור סופר-אדמין.
     * $rawSelection — JSON מדף בחירת המוצרים (או null אם המשתמש דילג).
     */
    private function createWoltImportRequest(Restaurant $restaurant, string $woltUrl, ?string $rawSelection): WoltImportRequest
    {
        $service = app(WoltMenuImportService::class);

        $selection = null;
        if (! empty($rawSelection)) {
            $decoded = json_decode($rawSelection, true);
            if (is_array($decoded)) {
                $selection = $decoded;
            }
        }

        $slug = null;
        try {
            $slug = $service->extractSlug($woltUrl);
        } catch (\Throwable $e) {
            $slug = is_string($selection['slug'] ?? null) ? $selection['slug'] : null;
        }

        $normalizedCategories = null;
        $normalizedMeta = [];
        if (is_array($selection['categories'] ?? null) && ! empty($selection['categories'])) {
            $normalized = $service->normalizeDraft(
                $selection['categories'],
                is_array($selection['restaurant_meta'] ?? null) ? $selection['restaurant_meta'] : []
            );
            $normalizedCategories = ! empty($normalized['categories']) ? $normalized['categories'] : null;
            $normalizedMeta = $normalized['restaurant_meta'];
        }

        $selectionMode = ($selection['mode'] ?? null) === 'selected' && $normalizedCategories ? 'selected' : 'all';

        $summary = is_array($selection['summary'] ?? null) ? $selection['summary'] : null;
        if (! $summary && $normalizedCategories) {
            $summary = [
                'categories_count' => count($normalizedCategories),
                'items_count' => collect($normalizedCategories)->sum(fn ($cat) => count($cat['items'] ?? [])),
            ];
        }

        return WoltImportRequest::create([
            'restaurant_id' => $restaurant->id,
            'tenant_id' => $restaurant->tenant_id,
            'wolt_url' => $woltUrl,
            'slug' => $slug,
            'selection_mode' => $selectionMode,
            'categories' => $normalizedCategories,
            'restaurant_meta' => ! empty($normalizedMeta) ? $normalizedMeta : null,
            'summary' => $summary,
            'status' => 'pending',
        ]);
    }

    private function formatPhoneForDisplay(string $raw): string
    {
        $phone = preg_replace('/\D/', '', $raw); // רק ספרות

        // נייד: 05X-XXXXXXX (10 ספרות)
        if (strlen($phone) === 10 && str_starts_with($phone, '05')) {
            return substr($phone, 0, 3) . '-' . substr($phone, 3);
        }

        // נייח: 0X-XXXXXXX (9 ספרות)
        if (strlen($phone) === 9 && str_starts_with($phone, '0')) {
            return substr($phone, 0, 2) . '-' . substr($phone, 2);
        }

        return $raw; // החזר מקורי אם לא תואם
    }
}

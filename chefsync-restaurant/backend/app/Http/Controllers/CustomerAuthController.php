<?php

namespace App\Http\Controllers;

use App\Mail\CustomerEmailVerificationMail;
use App\Mail\CustomerShareMail;
use App\Mail\CustomerWelcomeMail;
use App\Models\Customer;
use App\Models\CustomerToken;
use App\Models\Order;
use App\Models\PhoneVerification;
use App\Services\PhoneValidationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

class CustomerAuthController extends Controller
{
    /**
     * בדיקה אם טלפון שכבר אומת שייך ללקוח קיים
     */
    public function checkPhone(Request $request)
    {
        $request->validate(['phone' => 'required|string']);

        $phone = PhoneValidationService::normalizeIsraeliMobileE164($request->phone);
        if (!$phone) {
            return response()->json(['success' => false, 'message' => 'מספר טלפון לא תקין'], 422);
        }

        $verified = PhoneVerification::where('phone', $phone)
            ->whereNotNull('verified_at')
            ->where('verified_at', '>=', now()->subMinutes(10))
            ->exists();

        if (!$verified) {
            return response()->json(['success' => false, 'message' => 'יש לאמת את מספר הטלפון תחילה'], 403);
        }

        $customer = Customer::where('phone', $phone)->first();

        return response()->json([
            'success' => true,
            'exists' => !!$customer,
            'customer_name' => $customer?->name,
        ]);
    }

    /**
     * התחברות/רישום לקוח בעזרת טלפון + OTP
     * אחרי שהלקוח כבר אימת את הטלפון דרך PhoneAuthController
     */
    public function loginWithPhone(Request $request)
    {
        $request->validate([
            'phone' => 'required|string',
            'name' => 'sometimes|string|max:100',
        ]);

        $phone = PhoneValidationService::normalizeIsraeliMobileE164($request->phone);
        if (!$phone) {
            return response()->json([
                'success' => false,
                'message' => 'מספר טלפון לא תקין',
            ], 422);
        }

        // ודא שהטלפון אומת לאחרונה (תוך 10 דקות)
        $verified = PhoneVerification::where('phone', $phone)
            ->whereNotNull('verified_at')
            ->where('verified_at', '>=', now()->subMinutes(10))
            ->exists();

        if (!$verified) {
            return response()->json([
                'success' => false,
                'message' => 'יש לאמת את מספר הטלפון תחילה',
            ], 403);
        }

        $customer = Customer::where('phone', $phone)->first();

        if ($customer) {
            // לקוח קיים — עדכן שם רק אם סופק ושונה
            if ($request->filled('name') && $customer->name !== $request->name) {
                $customer->update(['name' => $request->name]);
            }
        } else {
            // לקוח חדש — שם נדרש
            if (!$request->filled('name')) {
                return response()->json([
                    'success' => false,
                    'message' => 'שם נדרש עבור לקוחות חדשים',
                ], 422);
            }
            $customer = Customer::create([
                'phone' => $phone,
                'name' => $request->name,
                'is_registered' => true,
            ]);
        }

        // קישור הזמנות ישנות ללקוח (backfill)
        Order::withoutGlobalScope('tenant')
            ->whereNull('customer_id')
            ->where('customer_phone', $phone)
            ->update(['customer_id' => $customer->id]);

        // קישור למשתמש מערכת (admin) לפי מספר טלפון
        if (!$customer->user_id) {
            $linkedUser = \App\Models\User::where('phone', $phone)->first();
            if ($linkedUser) {
                $customer->update(['user_id' => $linkedUser->id]);
            }
        }

        // סנכרון מונה הזמנות ותאריך אחרון מהנתונים בפועל
        $this->syncOrderStats($customer);

        // צור טוקן
        $tokenData = $this->createToken($customer, $request->header('User-Agent', 'unknown'));

        return response()->json([
            'success' => true,
            'message' => 'התחברת בהצלחה',
            'data' => [
                'customer' => $this->formatCustomer($customer->fresh()),
                'token' => $tokenData['plain_token'],
                'expires_at' => $tokenData['expires_at'],
            ],
        ]);
    }

    /**
     * התחברות עם Google ID Token
     */
    public function loginWithGoogle(Request $request)
    {
        $request->validate([
            'id_token' => 'required|string',
        ]);

        // Verify Google ID token
        $googleUser = $this->verifyGoogleToken($request->id_token);
        if (!$googleUser) {
            return response()->json([
                'success' => false,
                'message' => 'טוקן Google לא תקין',
            ], 401);
        }

        // מצא לקוח קיים לפי google_id או email
        $customer = Customer::where('google_id', $googleUser['sub'])->first();

        if (!$customer && !empty($googleUser['email'])) {
            $customer = Customer::where('email', $googleUser['email'])->first();
        }

        if ($customer) {
            // עדכון פרטי Google אם חסרים
            $customer->update(array_filter([
                'google_id' => $googleUser['sub'],
                'email' => $googleUser['email'] ?? $customer->email,
                'name' => $customer->name ?: ($googleUser['name'] ?? $customer->name),
                'is_registered' => true,
            ]));
        } else {
            // לקוח חדש — חייב שם
            $customer = Customer::create([
                'phone' => '', // יתמלא בהמשך כשיזמין
                'name' => $googleUser['name'] ?? 'לקוח',
                'email' => $googleUser['email'] ?? null,
                'google_id' => $googleUser['sub'],
                'is_registered' => true,
            ]);
        }

        $this->syncOrderStats($customer);

        $tokenData = $this->createToken($customer, $request->header('User-Agent', 'unknown'));

        return response()->json([
            'success' => true,
            'message' => 'התחברת בהצלחה עם Google',
            'data' => [
                'customer' => $this->formatCustomer($customer->fresh()),
                'token' => $tokenData['plain_token'],
                'expires_at' => $tokenData['expires_at'],
            ],
        ]);
    }

    /**
     * התחברות עם טלפון + PIN
     */
    public function loginWithPin(Request $request)
    {
        $request->validate([
            'phone' => 'required|string',
            'pin' => 'required|string|size:4',
        ]);

        $phone = PhoneValidationService::normalizeIsraeliMobileE164($request->phone);
        if (!$phone) {
            return response()->json([
                'success' => false,
                'message' => 'מספר טלפון לא תקין',
            ], 422);
        }

        $customer = Customer::where('phone', $phone)->first();
        if (!$customer || !$customer->pin_hash) {
            return response()->json([
                'success' => false,
                'message' => 'מספר טלפון או קוד PIN שגוי',
            ], 401);
        }

        if (!Hash::check($request->pin, $customer->pin_hash)) {
            return response()->json([
                'success' => false,
                'message' => 'מספר טלפון או קוד PIN שגוי',
            ], 401);
        }

        $this->syncOrderStats($customer);

        $tokenData = $this->createToken($customer, $request->header('User-Agent', 'unknown'));

        return response()->json([
            'success' => true,
            'message' => 'התחברת בהצלחה',
            'data' => [
                'customer' => $this->formatCustomer($customer->fresh()),
                'token' => $tokenData['plain_token'],
                'expires_at' => $tokenData['expires_at'],
            ],
        ]);
    }

    /**
     * הגדרת PIN (דורש אימות כלקוח)
     */
    public function setPin(Request $request)
    {
        $request->validate([
            'pin' => 'required|string|size:4|regex:/^\d{4}$/',
        ]);

        $customer = $request->customer;
        $customer->update([
            'pin_hash' => Hash::make($request->pin),
            'is_registered' => true,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'קוד PIN נשמר בהצלחה',
        ]);
    }

    /**
     * פרופיל לקוח נוכחי
     */
    public function me(Request $request)
    {
        $customer = $request->customer;
        $this->syncOrderStats($customer);

        return response()->json([
            'success' => true,
            'data' => $this->formatCustomer($customer->fresh()),
        ]);
    }

    /**
     * עדכון פרופיל
     */
    public function update(Request $request)
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:100',
            'email' => 'sometimes|nullable|email|max:255',
            'default_delivery_address' => 'sometimes|nullable|string|max:255',
            'default_delivery_lat' => 'sometimes|nullable|numeric|between:-90,90',
            'default_delivery_lng' => 'sometimes|nullable|numeric|between:-180,180',
            'default_delivery_notes' => 'sometimes|nullable|string|max:500',
            'preferred_payment_method' => 'sometimes|nullable|in:cash,credit_card',
        ]);

        $customer = $request->customer;

        // אם המייל השתנה — שלח אימות מחדש
        $emailChanged = array_key_exists('email', $validated)
            && $validated['email']
            && $validated['email'] !== $customer->email;

        if ($emailChanged) {
            $token = Str::random(64);
            $validated['email_verification_token'] = $token;
            $validated['email_verified_at'] = null;
        }

        $customer->update($validated);

        $emailSendOk = true;
        if ($emailChanged) {
            try {
                Mail::to($validated['email'])->send(new CustomerEmailVerificationMail($customer->fresh(), $token));
                \App\Services\EmailLogService::log($validated['email'], 'email_verification', 'אימות כתובת אימייל', $customer->id, 'sent');
            } catch (\Throwable $e) {
                Log::warning('Failed to send email verification on profile update', ['error' => $e->getMessage()]);
                try { \App\Services\EmailLogService::log($validated['email'], 'email_verification', 'אימות כתובת אימייל', $customer->id, 'failed', $e->getMessage()); } catch (\Throwable $ignore) {}
                $emailSendOk = false;
            }
        }

        $message = 'הפרופיל עודכן בהצלחה';
        if ($emailChanged) {
            $message = $emailSendOk ? 'הפרופיל עודכן — מייל אימות נשלח' : 'הפרופיל עודכן. שליחת מייל אימות נכשלה — ניתן לנסות שוב';
        }
        return response()->json([
            'success' => true,
            'message' => $message,
            'data' => $this->formatCustomer($customer->fresh()),
            'email_verification_sent' => $emailChanged && $emailSendOk,
        ]);
    }

    /**
     * התנתקות — מחיקת הטוקן הנוכחי
     */
    public function logout(Request $request)
    {
        $token = $request->bearerToken();
        if ($token) {
            $hash = hash('sha256', $token);
            CustomerToken::where('token_hash', $hash)->delete();
        }

        return response()->json([
            'success' => true,
            'message' => 'התנתקת בהצלחה',
        ]);
    }

    /**
     * שליחת מייל אימות כתובת אימייל
     */
    public function sendEmailVerification(Request $request)
    {
        $customer = $request->customer;
        $request->validate(['email' => 'required|email']);

        $token = Str::random(64);
        $customer->update([
            'email' => $request->email,
            'email_verification_token' => $token,
            'email_verified_at' => null,
        ]);

        try {
            Mail::to($request->email)->send(new CustomerEmailVerificationMail($customer, $token));
            \App\Services\EmailLogService::log($request->email, 'email_verification', 'אימות כתובת אימייל', $customer->id, 'sent');
            return response()->json(['success' => true, 'message' => 'מייל אימות נשלח']);
        } catch (\Throwable $e) {
            Log::warning('Failed to send email verification', ['error' => $e->getMessage()]);
            try { \App\Services\EmailLogService::log($request->email, 'email_verification', 'אימות כתובת אימייל', $customer->id, 'failed', $e->getMessage()); } catch (\Throwable $ignore) {}
            return response()->json(['success' => false, 'message' => 'שליחת המייל נכשלה. נסה שוב או פנה לתמיכה.'], 500);
        }
    }

    /**
     * אימות כתובת אימייל (ציבורי, ללא צורך באימות לקוח)
     */
    public function verifyEmail(Request $request)
    {
        $request->validate(['token' => 'required|string']);

        $customer = Customer::where('email_verification_token', $request->token)->first();
        if (!$customer) {
            return response()->json(['success' => false, 'message' => 'קישור לא תקין'], 400);
        }

        $customer->update([
            'email_verified_at' => now(),
            'email_verification_token' => null,
        ]);

        try {
            Mail::to($customer->email)->send(new CustomerWelcomeMail($customer));
            \App\Services\EmailLogService::log($customer->email, 'welcome', 'ברוכים הבאים', $customer->id, 'sent');
        } catch (\Throwable $e) {
            Log::warning('Failed to send welcome email after verification', ['customer_id' => $customer->id, 'error' => $e->getMessage()]);
            try { \App\Services\EmailLogService::log($customer->email, 'welcome', 'ברוכים הבאים', $customer->id, 'failed', $e->getMessage()); } catch (\Throwable $ignore) {}
        }

        return response()->json(['success' => true, 'message' => 'האימייל אומת בהצלחה']);
    }

    /**
     * שיתוף המלצה על מסעדה לחבר במייל
     */
    public function shareRestaurant(Request $request)
    {
        $customer = $request->customer;
        $request->validate([
            'friend_email' => 'required|email',
            'restaurant_name' => 'required|string',
            'restaurant_url' => 'required|url',
            'message' => 'nullable|string|max:500',
        ]);

        try {
            Mail::to($request->friend_email)->send(new CustomerShareMail(
                $customer->name,
                $request->restaurant_name,
                $request->restaurant_url,
                $request->message
            ));
            \App\Services\EmailLogService::log($request->friend_email, 'share', "שיתוף: {$request->restaurant_name}", $customer->id);
            return response()->json(['success' => true, 'message' => 'ההמלצה נשלחה']);
        } catch (\Throwable $e) {
            Log::warning('Failed to send share email', ['error' => $e->getMessage()]);
            try { \App\Services\EmailLogService::log($request->friend_email, 'share', "שיתוף: {$request->restaurant_name}", $customer->id, 'failed', $e->getMessage()); } catch (\Throwable $ignore) {}
            return response()->json(['success' => false, 'message' => 'שליחת המייל נכשלה. נסה שוב.'], 500);
        }
    }

    // ===== Private Helpers =====

    /**
     * סנכרון מונה הזמנות ותאריך הזמנה אחרונה מהנתונים בפועל
     */
    private function syncOrderStats(Customer $customer): void
    {
        $query = Order::withoutGlobalScope('tenant')
            ->where(function ($q) use ($customer) {
                $q->where('customer_id', $customer->id);
                if ($customer->phone) {
                    $q->orWhere('customer_phone', $customer->phone);
                }
            });

        $actualCount = $query->count();
        $lastOrderAt = (clone $query)->max('created_at');

        if ($customer->total_orders !== $actualCount || $customer->last_order_at != $lastOrderAt) {
            $customer->update([
                'total_orders' => $actualCount,
                'last_order_at' => $lastOrderAt,
            ]);
        }
    }

    private function createToken(Customer $customer, string $deviceName): array
    {
        $plainToken = Str::random(64);
        $hash = hash('sha256', $plainToken);
        $expiresAt = now()->addDays(90);

        // מחק טוקנים ישנים מאותו מכשיר (יותר מ-5 — שמור 5 אחרונים)
        $existingCount = $customer->tokens()->count();
        if ($existingCount >= 5) {
            $customer->tokens()
                ->orderBy('last_used_at', 'asc')
                ->limit($existingCount - 4)
                ->delete();
        }

        CustomerToken::create([
            'customer_id' => $customer->id,
            'token_hash' => $hash,
            'device_name' => Str::limit($deviceName, 255),
            'expires_at' => $expiresAt,
        ]);

        return [
            'plain_token' => $plainToken,
            'expires_at' => $expiresAt->toIso8601String(),
        ];
    }

    private function formatCustomer(Customer $customer): array
    {
        return [
            'id' => $customer->id,
            'phone' => $customer->phone,
            'name' => $customer->name,
            'email' => $customer->email,
            'email_verified' => !empty($customer->email_verified_at),
            'is_registered' => $customer->is_registered,
            'has_pin' => !empty($customer->pin_hash),
            'has_google' => !empty($customer->google_id),
            'default_delivery_address' => $customer->default_delivery_address,
            'default_delivery_lat' => $customer->default_delivery_lat,
            'default_delivery_lng' => $customer->default_delivery_lng,
            'default_delivery_notes' => $customer->default_delivery_notes,
            'preferred_payment_method' => $customer->preferred_payment_method,
            'total_orders' => $customer->total_orders,
            'last_order_at' => $customer->last_order_at?->toIso8601String(),
        ];
    }

    private function verifyGoogleToken(string $idToken): ?array
    {
        try {
            $response = \Illuminate\Support\Facades\Http::get(
                'https://oauth2.googleapis.com/tokeninfo',
                ['id_token' => $idToken]
            );

            if ($response->successful()) {
                $data = $response->json();
                // אם צריך, ודא aud = Google Client ID שלך
                return $data;
            }
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::warning('Google token verification failed', ['error' => $e->getMessage()]);
        }

        return null;
    }
}

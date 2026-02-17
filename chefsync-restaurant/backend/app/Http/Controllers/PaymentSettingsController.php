<?php

namespace App\Http\Controllers;

use App\Models\Restaurant;
use App\Models\RestaurantSubscription;
use App\Models\PaymentVerification;
use App\Services\RestaurantPaymentService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * PaymentSettingsController - הגדרות תשלום למסעדה
 */
class PaymentSettingsController extends Controller
{
    /**
     * קבלת הגדרות תשלום נוכחיות
     * מחזיר: terminal_id (בלי password!), accepted/available methods, סטטוס אימות
     */
    public function getSettings(Request $request)
    {
        $restaurant = Restaurant::withoutGlobalScope('tenant')
            ->where('tenant_id', $request->header('X-Tenant-ID'))
            ->first();

        if (!$restaurant) {
            return response()->json(['success' => false, 'message' => 'מסעדה לא נמצאה'], 404);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'hyp_terminal_id' => $restaurant->hyp_terminal_id,
                'has_password' => !empty($restaurant->hyp_terminal_password),
                'has_api_key' => !empty($restaurant->hyp_api_key),
                'hyp_terminal_verified' => $restaurant->hyp_terminal_verified,
                'hyp_terminal_verified_at' => $restaurant->hyp_terminal_verified_at,
                'accepted_payment_methods' => $restaurant->accepted_payment_methods ?? ['cash'],
                'available_payment_methods' => $restaurant->getPublicPaymentMethods(),
                'tier' => $restaurant->tier ?? 'basic',
                'hyp_setup_fee_charged' => (bool) $restaurant->hyp_setup_fee_charged,
            ],
        ]);
    }

    /**
     * שמירת הגדרות תשלום
     * שלב 1: מזומן חייב להיות תמיד מסומן
     */
    public function saveSettings(Request $request)
    {
        $validated = $request->validate([
            'hyp_terminal_id' => 'nullable|string|max:100',
            'hyp_terminal_password' => 'nullable|string|max:255',
            'hyp_api_key' => 'nullable|string|max:255',
            'accepted_payment_methods' => 'required|array|min:1',
            'accepted_payment_methods.*' => 'in:cash,credit_card',
            'agree_setup_fee' => 'nullable|boolean',
        ]);

        $restaurant = Restaurant::withoutGlobalScope('tenant')
            ->where('tenant_id', $request->header('X-Tenant-ID'))
            ->first();

        if (!$restaurant) {
            return response()->json(['success' => false, 'message' => 'מסעדה לא נמצאה'], 404);
        }

        $methods = $validated['accepted_payment_methods'];

        // שלב 1: מזומן חייב להיות תמיד מסומן (מניעת נעילה עצמית)
        if (!in_array('cash', $methods)) {
            $methods[] = 'cash';
        }

        // דגל גלובלי: אם אשראי כבוי ברמת המערכת, לא לאפשר הפעלה
        if (in_array('credit_card', $methods) && !config('payment.credit_card_enabled')) {
            return response()->json([
                'success' => false,
                'message' => 'תשלום באשראי עדיין לא זמין במערכת. יופעל בקרוב.',
            ], 422);
        }

        // אם מפעיל אשראי ולא שילם דמי הקמה - חובה לאשר
        $enablingCreditCard = in_array('credit_card', $methods);
        if ($enablingCreditCard && !$restaurant->hyp_setup_fee_charged) {
            if (empty($validated['agree_setup_fee'])) {
                return response()->json([
                    'success' => false,
                    'message' => 'יש לאשר את דמי ההקמה לפני הפעלת אשראי',
                ], 422);
            }

            // חישוב דמי הקמה לפי תוכנית
            $setupFee = ($restaurant->tier === 'pro') ? 100 : 200;

            // הוסף דמי הקמה ל-outstanding_amount של המנוי
            $subscription = RestaurantSubscription::where('restaurant_id', $restaurant->id)->first();
            if ($subscription) {
                $subscription->increment('outstanding_amount', $setupFee);
                $subscription->update([
                    'notes' => trim(($subscription->notes ?? '') . "\n" . now()->format('Y-m-d') . " - דמי הקמת חיבור אשראי: ₪{$setupFee}"),
                ]);
            }

            $restaurant->hyp_setup_fee_charged = true;

            Log::info('HYP setup fee charged', [
                'restaurant_id' => $restaurant->id,
                'tier' => $restaurant->tier,
                'fee' => $setupFee,
            ]);
        }

        $updateData = [
            'accepted_payment_methods' => array_values(array_unique($methods)),
            'hyp_setup_fee_charged' => $restaurant->hyp_setup_fee_charged,
        ];

        // עדכון terminal ID אם סופק
        if (array_key_exists('hyp_terminal_id', $validated)) {
            $updateData['hyp_terminal_id'] = $validated['hyp_terminal_id'];
        }

        // עדכון password אם סופק (יוצפן אוטומטית על ידי encrypted cast)
        if (!empty($validated['hyp_terminal_password'])) {
            $updateData['hyp_terminal_password'] = $validated['hyp_terminal_password'];
            // אם שינו credentials, סמן terminal כ-unverified
            $updateData['hyp_terminal_verified'] = false;
            $updateData['hyp_terminal_verified_at'] = null;
        }

        // עדכון API Key אם סופק (יוצפן אוטומטית על ידי encrypted cast)
        if (!empty($validated['hyp_api_key'])) {
            $updateData['hyp_api_key'] = $validated['hyp_api_key'];
        }

        $restaurant->update($updateData);

        $warnings = [];
        if (in_array('credit_card', $methods) && !$restaurant->hyp_terminal_verified) {
            $warnings[] = 'אשראי לא יוצג ללקוחות עד שהמסוף יאומת';
        }

        Log::info('Payment settings updated', [
            'restaurant_id' => $restaurant->id,
            'tenant_id' => $restaurant->tenant_id,
            'accepted_methods' => $methods,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'הגדרות תשלום עודכנו',
            'warnings' => $warnings,
            'data' => [
                'hyp_terminal_id' => $restaurant->hyp_terminal_id,
                'has_password' => !empty($restaurant->hyp_terminal_password),
                'has_api_key' => !empty($restaurant->hyp_api_key),
                'hyp_terminal_verified' => $restaurant->hyp_terminal_verified,
                'hyp_terminal_verified_at' => $restaurant->hyp_terminal_verified_at,
                'accepted_payment_methods' => $restaurant->accepted_payment_methods,
                'available_payment_methods' => $restaurant->getPublicPaymentMethods(),
                'tier' => $restaurant->tier ?? 'basic',
                'hyp_setup_fee_charged' => (bool) $restaurant->hyp_setup_fee_charged,
            ],
        ]);
    }

    /**
     * אימות מסוף תשלום - בדיקת Masof + PassP מול HYP ללא חיוב
     * שולח soft request עם dummy token — CCode 901-903 = credentials שגויים
     * משתמש ב-Masof של המסעדה (B2C)
     * מוגבל ל-Owner/SuperAdmin בלבד
     */
    public function verifyTerminal(Request $request)
    {
        // משתמש מאומת מתוך Sanctum
        $user = $request->user();
        if (!$user || !in_array($user->role, ['owner']) && !($user->is_super_admin ?? false)) {
            return response()->json([
                'success' => false,
                'message' => 'רק בעל מסעדה או סופר-אדמין יכולים לאמת מסוף',
            ], 403);
        }

        $restaurant = Restaurant::withoutGlobalScope('tenant')
            ->where('tenant_id', $request->header('X-Tenant-ID'))
            ->first();

        if (!$restaurant) {
            return response()->json(['success' => false, 'message' => 'מסעדה לא נמצאה'], 404);
        }

        if (empty($restaurant->hyp_terminal_id)) {
            return response()->json([
                'success' => false,
                'message' => 'נא להזין מזהה מסוף לפני אימות',
            ], 422);
        }

        if (empty($restaurant->hyp_terminal_password)) {
            return response()->json([
                'success' => false,
                'message' => 'נא להזין סיסמת מסוף לפני אימות',
            ], 422);
        }

        $paymentService = app(RestaurantPaymentService::class);

        // אימות credentials ללא חיוב אמיתי
        $result = $paymentService->verifyCredentials($restaurant);

        // לוג בטבלת verifications
        $verification = PaymentVerification::create([
            'restaurant_id' => $restaurant->id,
            'amount' => 0,
            'status' => $result['valid'] ? 'success' : 'failed',
            'initiated_by' => ($user->is_super_admin ?? false) ? 'super_admin' : 'owner',
        ]);

        if ($result['valid']) {
            $restaurant->update([
                'hyp_terminal_verified' => true,
                'hyp_terminal_verified_at' => now(),
            ]);

            Log::info('Terminal verification succeeded', [
                'restaurant_id' => $restaurant->id,
                'verification_id' => $verification->id,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'המסוף אומת בהצלחה',
                'data' => [
                    'hyp_terminal_verified' => true,
                    'hyp_terminal_verified_at' => $restaurant->hyp_terminal_verified_at,
                    'verification_id' => $verification->id,
                ],
            ]);
        }

        Log::warning('Terminal verification failed', [
            'restaurant_id' => $restaurant->id,
            'verification_id' => $verification->id,
            'ccode' => $result['ccode'],
            'error' => $result['error'],
        ]);

        return response()->json([
            'success' => false,
            'message' => 'אימות המסוף נכשל — נא לוודא שמזהה המסוף והסיסמה נכונים.',
            'data' => [
                'verification_id' => $verification->id,
                'error' => $result['error'] ?? 'Unknown error',
            ],
        ], 422);
    }
}

<?php

namespace App\Http\Controllers;

use App\Models\Restaurant;
use App\Models\RestaurantPayment;
use App\Models\RestaurantSubscription;
use App\Services\HypPaymentService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

/**
 * HypSubscriptionCallbackController (B2B)
 *
 * מטפל ב-redirect חזרה מ-HYP אחרי תשלום מנוי.
 * HYP לא שולח webhooks - הוא מעביר redirect ל-success/error URL.
 */
class HypSubscriptionCallbackController extends Controller
{
    public function __construct(
        private HypPaymentService $hypService,
    ) {}

    /**
     * GET /api/payments/hyp/subscription/success
     * HYP מעביר לכאן אחרי תשלום מוצלח
     */
    public function handleSuccess(Request $request)
    {
        $params = $this->hypService->parseRedirectParams($request);
        $restaurantId = $this->extractRestaurantId($params);
        $transactionId = $params['transaction_id'];

        Log::info('[HYP-SUB] Step 1/7: Success redirect received', [
            'restaurant_id'  => $restaurantId,
            'transaction_id' => $transactionId,
            'ccode'          => $params['ccode'],
            'amount'         => $params['amount'],
            'order'          => $params['order'] ?? '',
            'all_params'     => array_keys($params),
        ]);
        // #region agent log
        @file_put_contents(base_path('../.cursor/debug-d93c44.log'), json_encode(['sessionId'=>'d93c44','location'=>'HypSubscriptionCallbackController.php:callback-entry','message'=>'HYP success redirect','data'=>['restaurantId'=>$restaurantId,'order'=>$params['order']??'','rid'=>$params['rid']??''],'hypothesisId'=>'H1','timestamp'=>round(microtime(true)*1000)])."\n", FILE_APPEND | LOCK_EX);
        // #endregion

        if (!$params['success']) {
            Log::warning('[HYP-SUB] Step 2/7: CCode not 0 — payment not approved', $params);
            return $this->redirectToFrontend('error', 'payment_not_approved');
        }
        Log::info('[HYP-SUB] Step 2/7: CCode OK');

        $restaurant = Restaurant::withoutGlobalScope('tenant')->find($restaurantId);

        if (!$restaurant) {
            Log::error('[HYP-SUB] Step 3/7: Restaurant not found', ['id' => $restaurantId]);
            return $this->redirectToFrontend('error', 'restaurant_not_found');
        }
        Log::info('[HYP-SUB] Step 3/7: Restaurant found', [
            'restaurant_id'   => $restaurant->id,
            'current_tier'    => $restaurant->tier,
            'current_status'  => $restaurant->subscription_status,
        ]);

        // Idempotency
        $existingPayment = RestaurantPayment::where('restaurant_id', $restaurant->id)
            ->where('reference', $transactionId)
            ->where('status', 'paid')
            ->first();

        if ($existingPayment) {
            Log::info('[HYP-SUB] Step 4/7: Already processed (idempotent)', [
                'restaurant_id' => $restaurantId,
                'transaction_id' => $transactionId,
            ]);
            // #region agent log
            @file_put_contents(base_path('../.cursor/debug-d93c44.log'), json_encode(['sessionId'=>'d93c44','location'=>'HypSubscriptionCallbackController.php:idempotent','message'=>'Early exit - idempotent','data'=>['restaurantId'=>$restaurantId],'hypothesisId'=>'H1','timestamp'=>round(microtime(true)*1000)])."\n", FILE_APPEND | LOCK_EX);
            // #endregion
            return $this->redirectToFrontend('success');
        }
        Log::info('[HYP-SUB] Step 4/7: Not yet processed — continuing');

        // אימות חתימה — מיפוי מפתחות parseRedirectParams → verifyTransaction
        $verification = $this->hypService->verifyTransaction([
            'Id'     => $params['transaction_id'],
            'CCode'  => (string) $params['ccode'],
            'Amount' => $params['amount'],
        ]);
        if (!$verification['success'] && ($verification['verified'] ?? false)) {
            Log::error('[HYP-SUB] Step 5/7: Verification failed', $verification);
            return $this->redirectToFrontend('error', 'verification_failed');
        }
        Log::info('[HYP-SUB] Step 5/7: Signature verified');

        // קבלת טוקן לחיובים חוזרים
        $tokenResult = $this->hypService->getToken($transactionId);

        if ($tokenResult['success']) {
            $restaurant->update([
                'hyp_card_token'  => $tokenResult['token'],
                'hyp_card_expiry' => $tokenResult['tmonth'] . $tokenResult['tyear'],
                'hyp_card_last4'  => $tokenResult['l4digit'],
            ]);
            Log::info('[HYP-SUB] Step 6/7: Token saved from getToken API');
        } else {
            if (!empty($params['token'])) {
                $restaurant->update([
                    'hyp_card_token'  => $params['token'],
                    'hyp_card_expiry' => $params['tmonth'] . $params['tyear'],
                    'hyp_card_last4'  => $params['l4digit'],
                ]);
                Log::warning('[HYP-SUB] Step 6/7: Token saved from redirect params (getToken failed)', [
                    'token_result' => $tokenResult,
                ]);
            } else {
                Log::error('[HYP-SUB] Step 6/7: No token available!', [
                    'token_result' => $tokenResult,
                    'has_redirect_token' => false,
                ]);
            }
        }

        // שליפת session data (tier, plan_type) מ-cache
        $sessionData = Cache::pull("hyp_session:{$restaurantId}");
        $tier = $sessionData['tier'] ?? ($restaurant->tier ?? 'basic');
        $planType = $sessionData['plan_type'] ?? 'monthly';
        $includesSetupFee = $sessionData['includes_setup_fee'] ?? false;
        $setupFeeAmount = $sessionData['setup_fee_amount'] ?? 0;

        Log::info('[HYP-SUB] Session data retrieved', [
            'session_found'     => $sessionData !== null,
            'tier'              => $tier,
            'plan_type'         => $planType,
            'includes_setup_fee' => $includesSetupFee,
            'setup_fee_amount'  => $setupFeeAmount,
            'previous_tier'     => $restaurant->tier,
        ]);

        // הפעלת מנוי
        $this->activateSubscription($restaurant, $tier, $planType, $transactionId, $includesSetupFee, $setupFeeAmount);

        // #region agent log
        $r = $restaurant->fresh();
        $paymentsCount = RestaurantPayment::where('restaurant_id', $restaurant->id)->where('status', 'paid')->count();
        @file_put_contents(base_path('../.cursor/debug-d93c44.log'), json_encode(['sessionId'=>'d93c44','location'=>'HypSubscriptionCallbackController.php:post-activate','message'=>'Subscription activated','data'=>['restaurantId'=>$restaurant->id,'tenantId'=>$r->tenant_id??'','subscription_status'=>$r->subscription_status??'','subscription_ends_at'=>$r->subscription_ends_at?->toIso8601String()??'','payments_paid_count'=>$paymentsCount],'hypothesisId'=>'H1','timestamp'=>round(microtime(true)*1000)])."\n", FILE_APPEND | LOCK_EX);
        // #endregion

        Log::info('[HYP-SUB] Step 7/7: Subscription activated — redirecting to frontend', [
            'restaurant_id'  => $restaurant->id,
            'tier'           => $tier,
            'plan_type'      => $planType,
            'transaction_id' => $transactionId,
            'frontend_url'   => config('app.frontend_url'),
        ]);

        return $this->redirectToFrontend('success');
    }

    /**
     * GET /api/payments/hyp/subscription/error
     * HYP מעביר לכאן אחרי כשלון תשלום
     */
    public function handleError(Request $request)
    {
        $params = $this->hypService->parseRedirectParams($request);
        $restaurantId = $this->extractRestaurantId($params);

        Log::warning('HYP subscription payment error redirect', [
            'restaurant_id'  => $restaurantId,
            'order'          => $params['order'] ?? '',
            'ccode'          => $params['ccode'],
            'error'          => $params['errMsg'],
        ]);

        $reason = $params['errMsg'] ?: 'payment_declined';

        return $this->redirectToFrontend('error', $reason);
    }

    /**
     * הפעלת מנוי (לוגיקה דומה ל-AdminController::activateSubscription)
     */
    private function activateSubscription(
        Restaurant $restaurant,
        string $tier,
        string $planType,
        string $transactionId,
        bool $includesSetupFee = false,
        float $setupFeeAmount = 0
    ): void {
        $prices = SuperAdminSettingsController::getPricingArray();

        $planAmount = $prices[$tier][$planType === 'yearly' ? 'yearly' : 'monthly'];
        $totalCharged = $planAmount + ($includesSetupFee ? $setupFeeAmount : 0);
        $monthlyFeeForTracking = $planType === 'yearly'
            ? round($planAmount / 12, 2)
            : $planAmount;

        $periodStart = $restaurant->trial_ends_at && now()->lt($restaurant->trial_ends_at)
            ? $restaurant->trial_ends_at->copy()->startOfDay()
            : now()->startOfDay();

        $periodEnd = $planType === 'yearly'
            ? $periodStart->copy()->addYear()
            : $periodStart->copy()->addMonth();

        $subscription = RestaurantSubscription::updateOrCreate(
            ['restaurant_id' => $restaurant->id],
            [
                'plan_type'          => $planType,
                'monthly_fee'        => $monthlyFeeForTracking,
                'billing_day'        => now()->day > 28 ? 28 : now()->day,
                'currency'           => 'ILS',
                'status'             => 'active',
                'outstanding_amount' => 0,
                'next_charge_at'     => $periodEnd,
                'last_paid_at'       => now(),
            ]
        );

        // תשלום עבור המנוי
        RestaurantPayment::create([
            'restaurant_id' => $restaurant->id,
            'amount'        => $planAmount,
            'currency'      => 'ILS',
            'period_start'  => $periodStart,
            'period_end'    => $periodEnd,
            'paid_at'       => now(),
            'method'        => 'hyp_credit_card',
            'reference'     => $transactionId,
            'status'        => 'paid',
        ]);

        // תשלום נפרד עבור דמי הקמה (אם כלול)
        if ($includesSetupFee && $setupFeeAmount > 0) {
            RestaurantPayment::create([
                'restaurant_id' => $restaurant->id,
                'amount'        => $setupFeeAmount,
                'currency'      => 'ILS',
                'period_start'  => now(),
                'period_end'    => now(),
                'paid_at'       => now(),
                'method'        => 'hyp_credit_card',
                'reference'     => $transactionId . '_setup',
                'status'        => 'paid',
            ]);

            $restaurant->hyp_setup_fee_charged = true;

            $subscription->update([
                'notes' => trim(($subscription->notes ?? '') . "\n" . now()->format('Y-m-d') . " - דמי הקמת חיבור אשראי: ₪{$setupFeeAmount} (נגבו בתשלום ראשון)"),
            ]);

            Log::info('[HYP-SUB] Setup fee charged', [
                'restaurant_id' => $restaurant->id,
                'setup_fee'     => $setupFeeAmount,
            ]);
        }

        $restaurant->update([
            'subscription_status'   => 'active',
            'subscription_plan'     => $planType,
            'tier'                  => $tier,
            'ai_credits_monthly'    => $prices[$tier]['ai_credits'],
            'subscription_ends_at'  => $periodEnd,
            'last_payment_at'       => now(),
            'next_payment_at'       => $periodEnd,
            'payment_failed_at'     => null,
            'payment_failure_count' => 0,
        ]);

        // AI Credits
        if ($tier === 'pro' && $prices[$tier]['ai_credits'] > 0) {
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
        } elseif ($tier === 'basic') {
            $aiCredit = \App\Models\AiCredit::where('restaurant_id', $restaurant->id)->first();
            if ($aiCredit) {
                $aiCredit->update([
                    'tier'              => 'basic',
                    'monthly_limit'     => 0,
                    'credits_remaining' => 0,
                ]);
            }
        }
    }

    /**
     * HYP overwrites Fild1/Fild2/Fild3 with customer data.
     * Primary: parse restaurant ID from Order param ("sub_{id}").
     * Fallback: Fild1, then rid (our param in SuccessUrl).
     */
    private function extractRestaurantId(array $params): ?string
    {
        $order = $params['order'] ?? '';
        if (str_starts_with($order, 'sub_')) {
            return substr($order, 4);
        }

        if (!empty($params['fild1']) && is_numeric($params['fild1'])) {
            return $params['fild1'];
        }

        if (!empty($params['rid']) && is_numeric($params['rid'])) {
            return $params['rid'];
        }

        return null;
    }

    private function redirectToFrontend(string $status, string $reason = ''): \Illuminate\Http\RedirectResponse
    {
        $frontendUrl = rtrim(config('app.frontend_url', 'https://www.takeeat.co.il'), '/');
        $url = "{$frontendUrl}/admin/payment/{$status}";

        if ($reason) {
            $url .= '?reason=' . urlencode($reason);
        }

        return redirect()->away($url);
    }
}

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

        Log::info('HYP subscription payment success redirect', [
            'restaurant_id'  => $restaurantId,
            'transaction_id' => $transactionId,
            'ccode'          => $params['ccode'],
            'amount'         => $params['amount'],
            'order'          => $params['order'] ?? '',
        ]);

        if (!$params['success']) {
            Log::warning('HYP subscription callback: CCode not 0', $params);
            return $this->redirectToFrontend('error', 'payment_not_approved');
        }

        $restaurant = Restaurant::withoutGlobalScope('tenant')->find($restaurantId);

        if (!$restaurant) {
            Log::error('HYP subscription callback: restaurant not found', ['id' => $restaurantId]);
            return $this->redirectToFrontend('error', 'restaurant_not_found');
        }

        // Idempotency: אם כבר הופעל מנוי עם אותו transaction — פשוט redirect
        $existingPayment = RestaurantPayment::where('restaurant_id', $restaurant->id)
            ->where('reference', $transactionId)
            ->where('status', 'paid')
            ->first();

        if ($existingPayment) {
            Log::info('HYP subscription callback: already processed (idempotent)', [
                'restaurant_id' => $restaurantId,
                'transaction_id' => $transactionId,
            ]);
            return $this->redirectToFrontend('success');
        }

        // אימות חתימה
        $verification = $this->hypService->verifyTransaction($params);
        if (!$verification['success'] && ($verification['verified'] ?? false)) {
            Log::error('HYP subscription callback: verification failed', $verification);
            return $this->redirectToFrontend('error', 'verification_failed');
        }

        // קבלת טוקן לחיובים חוזרים
        $tokenResult = $this->hypService->getToken($transactionId);

        if ($tokenResult['success']) {
            $restaurant->update([
                'hyp_card_token'  => $tokenResult['token'],
                'hyp_card_expiry' => $tokenResult['tmonth'] . $tokenResult['tyear'],
                'hyp_card_last4'  => $tokenResult['l4digit'],
            ]);
        } else {
            // גם אם getToken נכשל, ננסה מ-redirect params (MoreData)
            if (!empty($params['token'])) {
                $restaurant->update([
                    'hyp_card_token'  => $params['token'],
                    'hyp_card_expiry' => $params['tmonth'] . $params['tyear'],
                    'hyp_card_last4'  => $params['l4digit'],
                ]);
            }

            Log::warning('HYP getToken failed, using redirect params', [
                'token_result' => $tokenResult,
                'has_redirect_token' => !empty($params['token']),
            ]);
        }

        // שליפת session data (tier, plan_type) מ-cache
        $sessionData = Cache::pull("hyp_session:{$restaurantId}");
        $tier = $sessionData['tier'] ?? ($restaurant->tier ?? 'basic');
        $planType = $sessionData['plan_type'] ?? 'monthly';

        // הפעלת מנוי
        $this->activateSubscription($restaurant, $tier, $planType, $transactionId);

        Log::info('HYP subscription activated', [
            'restaurant_id'  => $restaurant->id,
            'tier'           => $tier,
            'plan_type'      => $planType,
            'transaction_id' => $transactionId,
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
    private function activateSubscription(Restaurant $restaurant, string $tier, string $planType, string $transactionId): void
    {
        $prices = SuperAdminSettingsController::getPricingArray();

        $chargeAmount = $prices[$tier][$planType === 'yearly' ? 'yearly' : 'monthly'];
        $monthlyFeeForTracking = $planType === 'yearly'
            ? round($chargeAmount / 12, 2)
            : $chargeAmount;

        $periodStart = $restaurant->trial_ends_at && now()->lt($restaurant->trial_ends_at)
            ? $restaurant->trial_ends_at->copy()->startOfDay()
            : now()->startOfDay();

        $periodEnd = $planType === 'yearly'
            ? $periodStart->copy()->addYear()
            : $periodStart->copy()->addMonth();

        RestaurantSubscription::updateOrCreate(
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

        RestaurantPayment::create([
            'restaurant_id' => $restaurant->id,
            'amount'        => $chargeAmount,
            'currency'      => 'ILS',
            'period_start'  => $periodStart,
            'period_end'    => $periodEnd,
            'paid_at'       => now(),
            'method'        => 'hyp_credit_card',
            'reference'     => $transactionId,
            'status'        => 'paid',
        ]);

        $restaurant->update([
            'subscription_status'  => 'active',
            'subscription_plan'    => $planType,
            'tier'                 => $tier,
            'ai_credits_monthly'   => $prices[$tier]['ai_credits'],
            'subscription_ends_at' => $periodEnd,
            'last_payment_at'      => now(),
            'next_payment_at'      => $periodEnd,
            'payment_failed_at'    => null,
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
        }
    }

    /**
     * HYP overwrites Fild1/Fild2/Fild3 with customer data.
     * Primary: parse restaurant ID from Order param ("sub_{id}").
     * Fallback: try Fild1 (works if HYP didn't overwrite it).
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

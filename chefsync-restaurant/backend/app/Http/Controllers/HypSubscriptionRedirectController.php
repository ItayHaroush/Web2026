<?php

namespace App\Http\Controllers;

use App\Models\Restaurant;
use App\Services\HypPaymentService;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

/**
 * HypSubscriptionRedirectController (B2B)
 *
 * שלב ביניים בין הפרונטאנד ל-HYP Pay Protocol עבור מנוי מסעדה:
 * 1. שולף restaurant + session data מ-cache
 * 2. קורא ל-HYP APISign (server-to-server) לקבלת חתימה עם KEY + PassP + Referer
 * 3. מפנה (redirect) את המשתמש לעמוד תשלום HYP עם כל הפרמטרים + signature
 */
class HypSubscriptionRedirectController extends Controller
{
    public function __construct(
        private HypPaymentService $hypService,
    ) {}

    public function redirect(string $restaurantId)
    {
        $restaurant = Restaurant::withoutGlobalScope('tenant')->find($restaurantId);

        if (!$restaurant) {
            Log::error('HYP subscription redirect: restaurant not found', ['id' => $restaurantId]);
            return response()->view('hyp.order_error', [
                'message' => 'מסעדה לא נמצאה.',
            ], 404);
        }

        if (!$this->hypService->isConfigured()) {
            Log::error('HYP subscription redirect: platform terminal not configured');
            return response()->view('hyp.order_error', [
                'message' => 'מסוף התשלום של הפלטפורמה אינו מוגדר.',
            ], 500);
        }

        $sessionData = Cache::get("hyp_session:{$restaurantId}");

        if (!$sessionData) {
            Log::warning('HYP subscription redirect: no session data in cache', ['restaurant_id' => $restaurantId]);
            return response()->view('hyp.order_error', [
                'message' => 'פג תוקף הבקשה. אנא חזור לדף התשלום ונסה שנית.',
            ], 400);
        }

        $tier = $sessionData['tier'] ?? 'basic';
        $planType = $sessionData['plan_type'] ?? 'monthly';
        $amount = $sessionData['amount'] ?? 0;

        if ($amount <= 0) {
            Log::error('HYP subscription redirect: invalid amount', ['restaurant_id' => $restaurantId, 'amount' => $amount]);
            return response()->view('hyp.order_error', [
                'message' => 'סכום התשלום אינו תקין.',
            ], 400);
        }

        $backendUrl = rtrim(config('app.url', 'http://localhost:8000'), '/');
        $includesSetupFee = $sessionData['includes_setup_fee'] ?? false;
        $setupFeeAmount = $sessionData['setup_fee_amount'] ?? 0;
        $info = "TakeEat - " . ucfirst($tier) . " " . ($planType === 'yearly' ? 'Yearly' : 'Monthly');
        if ($includesSetupFee && $setupFeeAmount > 0) {
            $info .= " + Setup {$setupFeeAmount}";
        }

        $payParams = [
            'Masof'      => $this->hypService->getMasof(),
            'Amount'     => number_format($amount, 2, '.', ''),
            'Order'      => "sub_{$restaurantId}",
            'Info'       => $info,
            'Coin'       => $this->hypService->getCoin(),
            'Tash'       => '1',
            'UserId'     => '000000000',
            'PageLang'   => 'HEB',
            'UTF8'       => 'True',
            'UTF8out'    => 'True',
            'MoreData'   => 'True',
            'Sign'       => 'True',
            'tmp'        => '5',
            'Fild1'      => (string) $restaurantId,
            'Fild2'      => $tier,
            'Fild3'      => $planType,
            'SuccessUrl' => "{$backendUrl}/api/payments/hyp/subscription/success",
            'ErrorUrl'   => "{$backendUrl}/api/payments/hyp/subscription/error",
        ];

        if (!empty($sessionData['client_name'])) {
            $payParams['ClientName'] = $sessionData['client_name'];
        }
        if (!empty($sessionData['email'])) {
            $payParams['email'] = $sessionData['email'];
        }
        if (!empty($sessionData['phone'])) {
            $payParams['cell'] = $sessionData['phone'];
        }

        $signResult = $this->hypService->getSignature($payParams);

        if (!$signResult['success']) {
            Log::error('HYP B2B APISign failed', [
                'restaurant_id' => $restaurantId,
                'error'         => $signResult['error'],
            ]);

            return response()->view('hyp.order_error', [
                'message' => 'שגיאה בקבלת חתימה מ-HYP. נא לנסות שוב או ליצור קשר עם התמיכה.',
            ], 500);
        }

        $payParams['signature'] = $signResult['signature'];
        $payParams['action'] = 'pay';
        $payParams['PassP'] = $this->hypService->getPassp();

        $payUrl = $this->hypService->getBaseUrl() . '?' . http_build_query($payParams);

        return response()->view('hyp.order_redirect', [
            'paymentUrl' => $payUrl,
        ]);
    }
}

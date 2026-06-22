<?php

namespace App\Http\Controllers;

use App\Models\Restaurant;
use App\Services\HypPaymentService;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class HypDomainRedirectController extends Controller
{
    public function __construct(
        private HypPaymentService $hypService,
    ) {}

    public function redirect(string $restaurantId)
    {
        $restaurant = Restaurant::withoutGlobalScope('tenant')->find($restaurantId);

        if (!$restaurant) {
            return response()->view('hyp.order_error', ['message' => 'מסעדה לא נמצאה.'], 404);
        }

        if (!$this->hypService->isConfigured()) {
            return response()->view('hyp.order_error', [
                'message' => 'מסוף התשלום אינו מוגדר.',
            ], 500);
        }

        $sessionData = Cache::get("hyp_domain_session:{$restaurantId}");
        if (!$sessionData) {
            return response()->view('hyp.order_error', [
                'message' => 'פג תוקף הבקשה. אנא חזור ונסה שנית.',
            ], 400);
        }

        $amount = (float) ($sessionData['amount'] ?? 0);
        if ($amount <= 0) {
            return response()->view('hyp.order_error', [
                'message' => 'סכום התשלום אינו תקין.',
            ], 400);
        }

        $typeLabel = ($sessionData['type'] ?? '') === 'full_service'
            ? 'Domain Full Service'
            : 'Domain Connect';

        $backendUrl = rtrim(config('app.url', 'http://localhost:8000'), '/');
        $successUrl = "{$backendUrl}/api/payments/hyp/domain/success?rid={$restaurantId}";
        $errorUrl = "{$backendUrl}/api/payments/hyp/domain/error?rid={$restaurantId}";

        $payParams = [
            'Masof' => $this->hypService->getMasof(),
            'Amount' => number_format($amount, 2, '.', ''),
            'Order' => "domain_{$restaurantId}_takeeat",
            'Info' => "TakeEat - {$typeLabel}",
            'Coin' => $this->hypService->getCoin(),
            'Tash' => '1',
            'UserId' => $restaurant->hypSoftNationalIdDigits(),
            'PageLang' => 'HEB',
            'UTF8' => 'True',
            'UTF8out' => 'True',
            'MoreData' => 'True',
            'Sign' => 'True',
            'tmp' => '5',
            'Fild1' => (string) $restaurantId,
            'Fild2' => (string) ($sessionData['domain_request_id'] ?? ''),
            'Fild3' => (string) ($sessionData['type'] ?? ''),
            'SuccessUrl' => $successUrl,
            'ErrorUrl' => $errorUrl,
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
            Log::error('HYP domain APISign failed', [
                'restaurant_id' => $restaurantId,
                'error' => $signResult['error'],
            ]);
            return response()->view('hyp.order_error', [
                'message' => 'שגיאה בקבלת חתימה מ-HYP.',
            ], 500);
        }

        $payParams['signature'] = $signResult['signature'];
        $payParams['action'] = 'pay';
        $payParams['PassP'] = $this->hypService->getPassp();

        $payUrl = $this->hypService->getBaseUrl() . '?' . http_build_query($payParams);

        return response()->view('hyp.order_redirect', ['paymentUrl' => $payUrl]);
    }
}

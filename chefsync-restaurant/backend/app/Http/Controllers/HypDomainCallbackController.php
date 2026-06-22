<?php

namespace App\Http\Controllers;

use App\Models\DomainRequest;
use App\Models\Restaurant;
use App\Models\RestaurantPayment;
use App\Services\DomainRequestService;
use App\Services\HypPaymentService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class HypDomainCallbackController extends Controller
{
    public function __construct(
        private HypPaymentService $hypService,
        private DomainRequestService $domainService,
    ) {}

    public function handleSuccess(Request $request)
    {
        $params = $this->hypService->parseRedirectParams($request);
        $restaurantId = $this->extractRestaurantId($params);
        $transactionId = $params['transaction_id'];

        if (empty($transactionId)) {
            return $this->redirectToFrontend('error', 'missing_transaction');
        }

        if (!$params['success'] && ((int) $params['ccode']) !== 0) {
            $fallback = $this->hypService->verifyTransaction([
                'Id' => $transactionId,
                'CCode' => '0',
                'Amount' => $params['amount'],
            ]);
            if (!($fallback['success'] ?? false)) {
                return $this->redirectToFrontend('error', 'payment_not_approved');
            }
        } elseif (!$params['success']) {
            return $this->redirectToFrontend('error', 'payment_not_approved');
        }

        $restaurant = Restaurant::withoutGlobalScope('tenant')->find($restaurantId);
        if (!$restaurant) {
            return $this->redirectToFrontend('error', 'restaurant_not_found');
        }

        $sessionData = Cache::pull("hyp_domain_session:{$restaurantId}");
        if (!$sessionData || empty($sessionData['domain_request_id'])) {
            Log::warning('[HYP-DOMAIN] No session data', ['restaurant_id' => $restaurantId]);
            return $this->redirectToFrontend('error', 'session_expired');
        }

        $existing = RestaurantPayment::where('restaurant_id', $restaurant->id)
            ->where('reference', $transactionId)
            ->first();

        if ($existing) {
            return $this->redirectToFrontend('success');
        }

        $domainRequest = DomainRequest::find($sessionData['domain_request_id']);
        if (!$domainRequest || $domainRequest->restaurant_id !== $restaurant->id) {
            return $this->redirectToFrontend('error', 'request_not_found');
        }

        $paymentType = config("domain_services.{$domainRequest->type}.payment_type", 'domain_connect');

        $paidAt = now();
        $periodStart = $paidAt->copy()->startOfMonth()->toDateString();
        $periodEnd = $paidAt->copy()->endOfMonth()->toDateString();

        RestaurantPayment::create([
            'restaurant_id' => $restaurant->id,
            'type' => $paymentType,
            'amount' => (float) $domainRequest->amount,
            'currency' => 'ILS',
            'period_start' => $periodStart,
            'period_end' => $periodEnd,
            'paid_at' => $paidAt,
            'method' => 'hyp_credit_card',
            'reference' => $transactionId,
            'status' => 'paid',
        ]);

        $this->domainService->markPaymentReceived($domainRequest, $transactionId);

        return $this->redirectToFrontend('success');
    }

    public function handleError(Request $request)
    {
        $params = $this->hypService->parseRedirectParams($request);
        $reason = $params['errMsg'] ?: 'payment_declined';
        return $this->redirectToFrontend('error', $reason);
    }

    private function extractRestaurantId(array $params): ?string
    {
        $order = (string) ($params['order'] ?? '');
        if ($order !== '' && preg_match('/domain[_-]?(\d+)/i', $order, $m) === 1) {
            return $m[1];
        }
        if (!empty($params['rid'])) {
            return (string) $params['rid'];
        }
        return null;
    }

    private function redirectToFrontend(string $status, string $reason = ''): \Illuminate\Http\RedirectResponse
    {
        $frontendUrl = rtrim(config('app.frontend_url', 'http://localhost:5173'), '/');
        $url = "{$frontendUrl}/admin/custom-domain?payment={$status}";
        if ($reason) {
            $url .= '&reason=' . urlencode($reason);
        }
        return redirect()->away($url);
    }
}

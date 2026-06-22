<?php

namespace App\Http\Controllers;

use App\Models\DomainRequest;
use App\Models\RestaurantPayment;
use App\Services\DomainRequestService;
use App\Services\DomainVerificationService;
use App\Services\HypPaymentService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class DomainRequestController extends Controller
{
    public function __construct(
        private DomainRequestService $domainService,
        private DomainVerificationService $verification,
        private HypPaymentService $hypService,
    ) {}

    public function index(Request $request)
    {
        $user = $request->user();
        if (!$user->isOwner() && !$user->is_super_admin) {
            return response()->json(['success' => false, 'message' => 'רק בעל המסעדה'], 403);
        }

        $restaurant = $user->restaurant;
        if (!$restaurant) {
            return response()->json(['success' => false, 'message' => 'מסעדה לא נמצאה'], 404);
        }

        $overview = $this->domainService->getRestaurantOverview($restaurant);

        return response()->json([
            'success' => true,
            'data' => $overview,
        ]);
    }

    public function verifyDomain(Request $request)
    {
        $validated = $request->validate([
            'domain_name' => 'required|string|max:255',
        ]);

        $restaurant = $request->user()->restaurant;
        $result = $this->verification->verifyAvailable(
            $validated['domain_name'],
            $restaurant?->id
        );

        return response()->json([
            'success' => $result['ok'],
            'message' => $result['message'] ?? null,
            'domain' => $result['domain'] ?? null,
        ], $result['ok'] ? 200 : 422);
    }

    public function storeExisting(Request $request)
    {
        return $this->storeConnectRequest($request, 'existing');
    }

    public function storeFullService(Request $request)
    {
        $validated = $request->validate([
            'business_name' => 'required|string|max:255',
            'domain_name' => 'required|string|max:255',
            'domain_name_alt_2' => 'nullable|string|max:255',
            'domain_name_alt_3' => 'nullable|string|max:255',
            'customer_notes' => 'nullable|string|max:2000',
        ]);

        return $this->storeConnectRequest($request, 'full_service', $validated);
    }

    private function storeConnectRequest(Request $request, string $kind, ?array $fullServiceData = null)
    {
        $user = $request->user();
        if (!$user->isOwner() && !$user->is_super_admin) {
            return response()->json(['success' => false, 'message' => 'רק בעל המסעדה'], 403);
        }

        $restaurant = $user->restaurant;
        if (!$restaurant) {
            return response()->json(['success' => false, 'message' => 'מסעדה לא נמצאה'], 404);
        }

        if ($kind === 'existing') {
            $validated = $request->validate([
                'domain_name' => 'required|string|max:255',
                'registrar' => 'nullable|string|max:255',
                'customer_notes' => 'nullable|string|max:2000',
            ]);
        } else {
            $validated = $fullServiceData;
        }

        try {
            $domainRequest = $kind === 'existing'
                ? $this->domainService->createExistingDomainRequest($restaurant, $user, $validated, $request)
                : $this->domainService->createFullServiceRequest($restaurant, $user, $validated, $request);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 422);
        }

        if (!$this->hypService->isConfigured()) {
            return response()->json([
                'success' => true,
                'data' => $domainRequest,
                'hyp_ready' => false,
                'message' => 'HYP לא מוגדר — פנה לצוות TakeEat',
            ]);
        }

        $this->putPaymentSession($restaurant->id, $domainRequest, $user, $restaurant);

        return response()->json([
            'success' => true,
            'data' => $domainRequest,
            'hyp_ready' => true,
            'payment_url' => rtrim(config('app.url'), '/') . "/pay/hyp/domain/{$restaurant->id}",
            'amount' => $domainRequest->amount,
        ]);
    }

    public function createPaymentSession(Request $request)
    {
        $user = $request->user();
        if (!$user->isOwner() && !$user->is_super_admin) {
            return response()->json(['success' => false, 'message' => 'רק בעל המסעדה'], 403);
        }

        $validated = $request->validate([
            'domain_request_id' => 'required|integer|exists:domain_requests,id',
        ]);

        $restaurant = $user->restaurant;
        $domainRequest = DomainRequest::where('id', $validated['domain_request_id'])
            ->where('restaurant_id', $restaurant->id)
            ->where('payment_status', DomainRequest::PAYMENT_AWAITING)
            ->firstOrFail();

        if (!$this->hypService->isConfigured()) {
            return response()->json([
                'success' => true,
                'hyp_ready' => false,
                'amount' => $domainRequest->amount,
            ]);
        }

        $this->putPaymentSession($restaurant->id, $domainRequest, $user, $restaurant);

        return response()->json([
            'success' => true,
            'hyp_ready' => true,
            'payment_url' => rtrim(config('app.url'), '/') . "/pay/hyp/domain/{$restaurant->id}",
            'amount' => $domainRequest->amount,
        ]);
    }

    public function storeChange(Request $request)
    {
        $validated = $request->validate(['customer_notes' => 'nullable|string|max:2000']);
        return $this->storeSimpleRequest($request, DomainRequest::TYPE_CHANGE, $validated['customer_notes'] ?? null);
    }

    public function storeDisconnect(Request $request)
    {
        $validated = $request->validate(['customer_notes' => 'nullable|string|max:2000']);
        return $this->storeSimpleRequest($request, DomainRequest::TYPE_DISCONNECT, $validated['customer_notes'] ?? null);
    }

    private function storeSimpleRequest(Request $request, string $type, ?string $notes)
    {
        $user = $request->user();
        if (!$user->isOwner() && !$user->is_super_admin) {
            return response()->json(['success' => false, 'message' => 'רק בעל המסעדה'], 403);
        }

        $restaurant = $user->restaurant;
        if (!$restaurant?->custom_domain) {
            return response()->json(['success' => false, 'message' => 'אין דומיין פעיל'], 422);
        }

        try {
            $domainRequest = $this->domainService->createChangeOrDisconnectRequest(
                $restaurant,
                $user,
                $type,
                $notes,
                $request
            );
        } catch (\InvalidArgumentException $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 422);
        }

        return response()->json([
            'success' => true,
            'message' => 'הבקשה נשלחה לצוות TakeEat',
            'data' => $domainRequest,
        ]);
    }

    public function dnsInstructions(Request $request, int $id)
    {
        $user = $request->user();
        $restaurant = $user->restaurant;

        $domainRequest = DomainRequest::where('id', $id)
            ->where('restaurant_id', $restaurant->id)
            ->firstOrFail();

        return response()->json([
            'success' => true,
            'data' => [
                'domain' => $domainRequest->domain_name,
                'dns_records' => $domainRequest->dns_records ?? [],
                'status' => $domainRequest->status,
            ],
        ]);
    }

    private function putPaymentSession(int $restaurantId, DomainRequest $domainRequest, $user, $restaurant): void
    {
        Cache::put("hyp_domain_session:{$restaurantId}", [
            'domain_request_id' => $domainRequest->id,
            'type' => $domainRequest->type,
            'amount' => (float) $domainRequest->amount,
            'domain_name' => $domainRequest->domain_name,
            'source_app' => 'takeeat',
            'client_name' => $user->name ?? '',
            'email' => $user->email ?? '',
            'phone' => $restaurant->phone ?? '',
        ], now()->addMinutes(15));
    }
}

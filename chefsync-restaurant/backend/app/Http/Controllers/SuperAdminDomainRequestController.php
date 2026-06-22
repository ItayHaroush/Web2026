<?php

namespace App\Http\Controllers;

use App\Models\DomainRequest;
use App\Services\DomainActivationService;
use App\Services\DomainRequestService;
use App\Services\VercelDomainService;
use Illuminate\Http\Request;

class SuperAdminDomainRequestController extends Controller
{
    public function __construct(
        private DomainRequestService $domainService,
        private DomainActivationService $activationService,
        private VercelDomainService $vercelService,
    ) {}

    public function index(Request $request)
    {
        $query = DomainRequest::with(['restaurant', 'requestedBy'])
            ->orderByDesc('created_at');

        if ($request->boolean('pending')) {
            $query->whereIn('status', DomainRequest::BLOCKING_STATUSES);
        } elseif ($request->filled('status')) {
            $query->where('status', $request->status);
        }
        if ($request->filled('type')) {
            $query->where('type', $request->type);
        }
        if ($request->filled('search')) {
            $s = '%' . $request->search . '%';
            $query->where(function ($q) use ($s) {
                $q->where('request_number', 'like', $s)
                    ->orWhere('domain_name', 'like', $s)
                    ->orWhereHas('restaurant', fn ($r) => $r->where('name', 'like', $s));
            });
        }

        $perPage = min(max($request->integer('per_page', 20), 1), 50);

        return response()->json([
            'success' => true,
            'data' => $query->paginate($perPage),
            'stats' => $this->buildStats(),
        ]);
    }

    public function stats()
    {
        return response()->json(['success' => true, 'data' => $this->buildStats()]);
    }

    public function show(int $id)
    {
        $domainRequest = DomainRequest::with([
            'restaurant.restaurantDomains',
            'requestedBy',
            'handler',
            'auditLogs.user',
        ])->findOrFail($id);

        return response()->json(['success' => true, 'data' => $domainRequest]);
    }

    public function updateStatus(Request $request, int $id)
    {
        $validated = $request->validate([
            'status' => 'required|string|in:' . implode(',', [
                DomainRequest::STATUS_PENDING,
                DomainRequest::STATUS_IN_PROGRESS,
                DomainRequest::STATUS_AWAITING_CUSTOMER,
                DomainRequest::STATUS_AWAITING_DNS,
                DomainRequest::STATUS_SSL_SETUP,
                DomainRequest::STATUS_REJECTED,
                DomainRequest::STATUS_COMPLETED,
            ]),
            'note' => 'nullable|string|max:2000',
        ]);

        $domainRequest = DomainRequest::findOrFail($id);

        if ($validated['status'] === DomainRequest::STATUS_ACTIVE) {
            return response()->json([
                'success' => false,
                'message' => 'להפעלת דומיין השתמש בכפתור Activate Domain',
            ], 422);
        }

        $domainRequest = $this->domainService->updateStatus(
            $domainRequest,
            $validated['status'],
            $request->user(),
            $validated['note'] ?? null,
            $request
        );

        $domainRequest->update(['handled_by' => $request->user()->id]);

        return response()->json([
            'success' => true,
            'data' => $domainRequest->fresh(['restaurant', 'requestedBy']),
        ]);
    }

    public function addNote(Request $request, int $id)
    {
        $validated = $request->validate(['note' => 'required|string|max:2000']);
        $domainRequest = DomainRequest::findOrFail($id);
        $existing = trim($domainRequest->admin_notes ?? '');
        $domainRequest->update([
            'admin_notes' => $existing !== '' ? $existing . "\n---\n" . $validated['note'] : $validated['note'],
            'handled_by' => $request->user()->id,
        ]);
        $this->domainService->logAudit($domainRequest, 'note_added', $request->user(), null, $validated['note'], $request);

        return response()->json(['success' => true, 'data' => $domainRequest->fresh()]);
    }

    public function updatePaymentStatus(Request $request, int $id)
    {
        $validated = $request->validate([
            'payment_status' => 'required|in:' . implode(',', DomainRequest::PAYMENT_STATUSES),
            'note' => 'nullable|string|max:2000',
        ]);

        $domainRequest = DomainRequest::findOrFail($id);
        $old = $domainRequest->payment_status;
        $updates = ['payment_status' => $validated['payment_status']];

        if (in_array($validated['payment_status'], [DomainRequest::PAYMENT_WAIVED, DomainRequest::PAYMENT_INCLUDED], true)
            && $domainRequest->status === DomainRequest::STATUS_AWAITING_PAYMENT) {
            $updates['status'] = DomainRequest::STATUS_PENDING;
            $updates['amount'] = 0;
        }

        $domainRequest->update($updates);
        $this->domainService->logAudit($domainRequest, 'payment_status_changed', $request->user(), ['from' => $old, 'to' => $validated['payment_status']], $validated['note'] ?? null, $request);

        return response()->json(['success' => true, 'data' => $domainRequest->fresh()]);
    }

    public function createForRestaurant(Request $request, int $restaurantId)
    {
        $validated = $request->validate([
            'type' => 'nullable|in:existing_domain,full_service',
            'domain_name' => 'required|string|max:255',
            'business_name' => 'nullable|string|max:255',
            'registrar' => 'nullable|string|max:255',
            'customer_notes' => 'nullable|string|max:2000',
            'admin_notes' => 'nullable|string|max:2000',
        ]);

        $restaurant = \App\Models\Restaurant::withoutGlobalScopes()->findOrFail($restaurantId);

        try {
            $domainRequest = $this->domainService->createIncludedInSetupRequest(
                $restaurant,
                $request->user(),
                array_merge($validated, ['type' => $validated['type'] ?? DomainRequest::TYPE_EXISTING]),
                $request
            );
        } catch (\InvalidArgumentException $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 422);
        }

        return response()->json(['success' => true, 'message' => 'בקשת דומיין נוצרה (כלול בהקמה)', 'data' => $domainRequest]);
    }

    /** Register domain in Vercel + return DNS instructions (no activation) */
    public function prepareVercel(Request $request, int $id)
    {
        $domainRequest = DomainRequest::with('restaurant')->findOrFail($id);
        $domain = $domainRequest->domain_name;

        if (!$domain) {
            return response()->json(['success' => false, 'message' => 'אין דומיין בבקשה'], 422);
        }

        $result = $this->activationService->prepareInVercel($domainRequest, $domain);
        if (!$result['ok']) {
            return response()->json(['success' => false, 'message' => $result['message'], 'dns_records' => $result['dns_records'] ?? []], 422);
        }

        $readiness = $this->vercelService->checkActivationReadiness($domain);
        $domainRequest->update(['status' => $readiness['suggested_request_status'] ?? DomainRequest::STATUS_AWAITING_DNS]);

        if ($domainRequest->status === DomainRequest::STATUS_AWAITING_DNS) {
            $this->domainService->notifyCustomer($domainRequest->fresh(), 'awaiting_dns', [
                'dns_records' => $domainRequest->fresh()->dns_records ?? $result['dns_records'] ?? [],
            ]);
        }

        $this->domainService->logAudit($domainRequest, 'vercel_prepared', $request->user(), $readiness, null, $request);

        return response()->json([
            'success' => true,
            'message' => 'הדומיין נוסף ל-Vercel',
            'dns_records' => $result['dns_records'],
            'readiness' => $readiness,
            'data' => $domainRequest->fresh(),
        ]);
    }

    /** Poll Vercel + update health on request and restaurant_domains */
    public function syncVercel(Request $request, int $id)
    {
        $domainRequest = DomainRequest::with('restaurant')->findOrFail($id);
        $domain = $domainRequest->active_domain ?? $domainRequest->domain_name;

        if (!$domain) {
            return response()->json(['success' => false, 'message' => 'אין דומיין'], 422);
        }

        $readiness = $this->vercelService->checkActivationReadiness($domain);

        $domainRequest->update([
            'ssl_status' => $readiness['ssl_status'] ?? 'pending',
            'dns_records' => $readiness['dns_records'] ?? $domainRequest->dns_records,
            'status' => $readiness['can_activate']
                ? $domainRequest->status
                : ($readiness['suggested_request_status'] ?? $domainRequest->status),
        ]);

        \App\Models\RestaurantDomain::where('domain', $domain)->update([
            'health_status' => $readiness['health_status'],
            'health_checked_at' => now(),
            'ssl_status' => $readiness['ssl_status'] ?? 'pending',
        ]);

        $this->domainService->logAudit($domainRequest, 'vercel_sync', $request->user(), $readiness, null, $request);

        return response()->json([
            'success' => true,
            'readiness' => $readiness,
            'can_activate' => $readiness['can_activate'],
            'data' => $domainRequest->fresh(),
        ]);
    }

    public function activateDomain(Request $request, int $id)
    {
        $validated = $request->validate([
            'active_domain' => 'nullable|string|max:255',
            'domain_type' => 'nullable|in:primary,redirect,legacy',
        ]);

        $domainRequest = DomainRequest::with('restaurant')->findOrFail($id);
        $domain = $validated['active_domain'] ?? $domainRequest->domain_name;

        $result = $this->activationService->activate(
            $domainRequest,
            $domainRequest->restaurant,
            $domain,
            $request->user(),
            $validated['domain_type'] ?? \App\Models\RestaurantDomain::TYPE_PRIMARY,
            $request
        );

        if (!$result['success']) {
            return response()->json($result, 422);
        }

        return response()->json($result);
    }

    public function executeDisconnect(Request $request, int $id)
    {
        $domainRequest = DomainRequest::with('restaurant')->findOrFail($id);

        if ($domainRequest->type !== DomainRequest::TYPE_DISCONNECT) {
            return response()->json(['success' => false, 'message' => 'בקשה זו אינה בקשת ניתוק'], 422);
        }

        $result = $this->activationService->safeDisconnect(
            $domainRequest,
            $domainRequest->restaurant,
            $request->user(),
            $request
        );

        if (!$result['success']) {
            return response()->json($result, 422);
        }

        return response()->json($result);
    }

    public function reject(Request $request, int $id)
    {
        $validated = $request->validate(['rejection_reason' => 'required|string|max:2000']);
        $domainRequest = DomainRequest::findOrFail($id);
        $domainRequest->update([
            'status' => DomainRequest::STATUS_REJECTED,
            'rejected_at' => now(),
            'rejection_reason' => $validated['rejection_reason'],
            'handled_by' => $request->user()->id,
        ]);
        $this->domainService->logAudit($domainRequest, 'rejected', $request->user(), ['reason' => $validated['rejection_reason']], null, $request);
        $this->domainService->notifyCustomer($domainRequest->fresh(), 'request_rejected', [
            'rejection_reason' => $validated['rejection_reason'],
        ]);

        return response()->json(['success' => true, 'data' => $domainRequest->fresh()]);
    }

    private function buildStats(): array
    {
        $open = DomainRequest::whereIn('status', DomainRequest::BLOCKING_STATUSES)->count();
        $month = DomainRequest::where('created_at', '>=', now()->startOfMonth())->count();
        $activeDomains = \App\Models\RestaurantDomain::active()->count();
        $revenue = (float) \App\Models\RestaurantPayment::whereIn('type', ['domain_connect', 'domain_full_service'])->where('status', 'paid')->sum('amount');

        $completed = DomainRequest::where('status', DomainRequest::STATUS_ACTIVE)->whereNotNull('connected_at')->where('created_at', '>=', now()->subDays(90))->get(['created_at', 'connected_at']);
        $avgHours = null;
        if ($completed->isNotEmpty()) {
            $avgHours = round($completed->sum(fn ($r) => $r->created_at->diffInMinutes($r->connected_at) / 60) / $completed->count(), 1);
        }

        return [
            'open_requests' => $open,
            'requests_this_month' => $month,
            'active_domains' => $activeDomains,
            'domain_revenue' => $revenue,
            'avg_resolution_hours' => $avgHours,
        ];
    }
}

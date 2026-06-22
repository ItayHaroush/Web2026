<?php

namespace App\Services;

use App\Mail\DomainRequestAdminMail;
use App\Mail\DomainRequestCustomerMail;
use App\Models\DomainRequest;
use App\Models\DomainRequestAuditLog;
use App\Models\MonitoringAlert;
use App\Models\NotificationLog;
use App\Models\Restaurant;
use App\Models\RestaurantDomain;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class DomainRequestService
{
    public function __construct(
        private DomainVerificationService $verification,
    ) {}

    public function generateRequestNumber(): string
    {
        $year = now()->format('Y');
        $count = DomainRequest::whereYear('created_at', $year)->count() + 1;

        return sprintf('DOM-%s-%05d', $year, $count);
    }

    public function canCreateConnectRequest(int $restaurantId): array
    {
        $blocking = DomainRequest::where('restaurant_id', $restaurantId)
            ->whereIn('status', DomainRequest::BLOCKING_STATUSES)
            ->whereIn('type', [DomainRequest::TYPE_EXISTING, DomainRequest::TYPE_FULL_SERVICE])
            ->exists();

        if ($blocking) {
            return [
                'ok' => false,
                'message' => 'קיימת בקשת דומיין פתוחה — יש להמתין לסיום הטיפול',
            ];
        }

        return ['ok' => true];
    }

    public function logAudit(
        DomainRequest $request,
        string $action,
        ?User $user = null,
        ?array $payload = null,
        ?string $note = null,
        ?Request $httpRequest = null,
    ): DomainRequestAuditLog {
        return DomainRequestAuditLog::create([
            'domain_request_id' => $request->id,
            'user_id' => $user?->id,
            'action' => $action,
            'payload' => $payload,
            'note' => $note,
            'ip_address' => $httpRequest?->ip(),
            'created_at' => now(),
        ]);
    }

    public function createExistingDomainRequest(
        Restaurant $restaurant,
        User $user,
        array $data,
        ?Request $httpRequest = null,
    ): DomainRequest {
        $check = $this->canCreateConnectRequest($restaurant->id);
        if (!$check['ok']) {
            throw new \InvalidArgumentException($check['message']);
        }

        $verified = $this->verification->verifyAvailable($data['domain_name'], $restaurant->id);
        if (!$verified['ok']) {
            throw new \InvalidArgumentException($verified['message']);
        }

        $price = config('domain_services.existing_domain.price', 390);

        return DB::transaction(function () use ($restaurant, $user, $data, $verified, $price, $httpRequest) {
            $request = DomainRequest::create([
                'request_number' => $this->generateRequestNumber(),
                'restaurant_id' => $restaurant->id,
                'tenant_id' => $restaurant->tenant_id,
                'requested_by_user_id' => $user->id,
                'type' => DomainRequest::TYPE_EXISTING,
                'status' => DomainRequest::STATUS_AWAITING_PAYMENT,
                'payment_status' => DomainRequest::PAYMENT_AWAITING,
                'amount' => $price,
                'domain_name' => $verified['domain'],
                'domain_type' => DomainRequest::DOMAIN_TYPE_PRIMARY,
                'registrar' => $data['registrar'] ?? null,
                'customer_notes' => $data['customer_notes'] ?? null,
            ]);

            $this->logAudit($request, 'created', $user, [
                'type' => DomainRequest::TYPE_EXISTING,
                'domain' => $verified['domain'],
            ], null, $httpRequest);

            $this->notifyCustomer($request, 'request_received');

            return $request;
        });
    }

    public function createFullServiceRequest(
        Restaurant $restaurant,
        User $user,
        array $data,
        ?Request $httpRequest = null,
    ): DomainRequest {
        $check = $this->canCreateConnectRequest($restaurant->id);
        if (!$check['ok']) {
            throw new \InvalidArgumentException($check['message']);
        }

        $primary = $this->verification->verifyAvailable($data['domain_name'], $restaurant->id);
        if (!$primary['ok']) {
            throw new \InvalidArgumentException($primary['message']);
        }

        $price = config('domain_services.full_service.price', 890);

        return DB::transaction(function () use ($restaurant, $user, $data, $primary, $price, $httpRequest) {
            $request = DomainRequest::create([
                'request_number' => $this->generateRequestNumber(),
                'restaurant_id' => $restaurant->id,
                'tenant_id' => $restaurant->tenant_id,
                'requested_by_user_id' => $user->id,
                'type' => DomainRequest::TYPE_FULL_SERVICE,
                'status' => DomainRequest::STATUS_AWAITING_PAYMENT,
                'payment_status' => DomainRequest::PAYMENT_AWAITING,
                'amount' => $price,
                'domain_name' => $primary['domain'],
                'domain_name_alt_2' => isset($data['domain_name_alt_2'])
                    ? $this->verification->normalize($data['domain_name_alt_2'])
                    : null,
                'domain_name_alt_3' => isset($data['domain_name_alt_3'])
                    ? $this->verification->normalize($data['domain_name_alt_3'])
                    : null,
                'domain_type' => DomainRequest::DOMAIN_TYPE_PRIMARY,
                'business_name' => $data['business_name'] ?? $restaurant->name,
                'customer_notes' => $data['customer_notes'] ?? null,
            ]);

            $this->logAudit($request, 'created', $user, [
                'type' => DomainRequest::TYPE_FULL_SERVICE,
                'domain' => $primary['domain'],
            ], null, $httpRequest);

            $this->notifyCustomer($request, 'request_received');

            return $request;
        });
    }

    public function createIncludedInSetupRequest(
        Restaurant $restaurant,
        User $admin,
        array $data,
        ?Request $httpRequest = null,
    ): DomainRequest {
        $check = $this->canCreateConnectRequest($restaurant->id);
        if (!$check['ok']) {
            throw new \InvalidArgumentException($check['message']);
        }

        $verified = $this->verification->verifyAvailable($data['domain_name'], $restaurant->id);
        if (!$verified['ok']) {
            throw new \InvalidArgumentException($verified['message']);
        }

        $type = $data['type'] ?? DomainRequest::TYPE_EXISTING;

        return DB::transaction(function () use ($restaurant, $admin, $data, $verified, $type, $httpRequest) {
            $request = DomainRequest::create([
                'request_number' => $this->generateRequestNumber(),
                'restaurant_id' => $restaurant->id,
                'tenant_id' => $restaurant->tenant_id,
                'requested_by_user_id' => $admin->id,
                'type' => $type,
                'status' => DomainRequest::STATUS_PENDING,
                'payment_status' => DomainRequest::PAYMENT_INCLUDED,
                'amount' => 0,
                'domain_name' => $verified['domain'],
                'domain_type' => DomainRequest::DOMAIN_TYPE_PRIMARY,
                'business_name' => $data['business_name'] ?? null,
                'registrar' => $data['registrar'] ?? null,
                'customer_notes' => $data['customer_notes'] ?? null,
                'admin_notes' => $data['admin_notes'] ?? 'כלול בהקמה',
            ]);

            $this->logAudit($request, 'included_in_setup', $admin, [
                'domain' => $verified['domain'],
            ], $data['admin_notes'] ?? null, $httpRequest);

            $this->notifySuperAdmins($request, 'included_in_setup');
            $this->notifyCustomer($request, 'request_received');

            return $request;
        });
    }

    public function createChangeOrDisconnectRequest(
        Restaurant $restaurant,
        User $user,
        string $type,
        ?string $notes,
        ?Request $httpRequest = null,
    ): DomainRequest {
        if (!in_array($type, [DomainRequest::TYPE_CHANGE, DomainRequest::TYPE_DISCONNECT], true)) {
            throw new \InvalidArgumentException('סוג בקשה לא תקין');
        }

        return DB::transaction(function () use ($restaurant, $user, $type, $notes, $httpRequest) {
            $request = DomainRequest::create([
                'request_number' => $this->generateRequestNumber(),
                'restaurant_id' => $restaurant->id,
                'tenant_id' => $restaurant->tenant_id,
                'requested_by_user_id' => $user->id,
                'type' => $type,
                'status' => DomainRequest::STATUS_PENDING,
                'payment_status' => DomainRequest::PAYMENT_WAIVED,
                'amount' => 0,
                'domain_name' => $restaurant->custom_domain,
                'customer_notes' => $notes,
            ]);

            $this->logAudit($request, 'created', $user, ['type' => $type], $notes, $httpRequest);
            $this->notifySuperAdmins($request, $type);

            return $request;
        });
    }

    public function markPaymentReceived(
        DomainRequest $request,
        string $reference,
        ?User $user = null,
        ?Request $httpRequest = null,
    ): DomainRequest {
        $request->update([
            'payment_status' => DomainRequest::PAYMENT_PAID,
            'payment_reference' => $reference,
            'status' => DomainRequest::STATUS_PENDING,
        ]);

        $this->logAudit($request, 'payment_received', $user, [
            'reference' => $reference,
            'amount' => $request->amount,
        ], null, $httpRequest);

        $this->notifySuperAdmins($request, 'payment_received');
        $this->notifyCustomer($request, 'payment_received');

        return $request->fresh();
    }

    public function updateStatus(
        DomainRequest $request,
        string $newStatus,
        User $admin,
        ?string $note = null,
        ?Request $httpRequest = null,
    ): DomainRequest {
        $oldStatus = $request->status;
        $request->update(['status' => $newStatus]);

        if ($newStatus === DomainRequest::STATUS_REJECTED) {
            $request->update(['rejected_at' => now()]);
        }

        $this->logAudit($request, 'status_changed', $admin, [
            'status_from' => $oldStatus,
            'status_to' => $newStatus,
        ], $note, $httpRequest);

        if ($newStatus === DomainRequest::STATUS_AWAITING_DNS) {
            $this->notifyCustomer($request, 'awaiting_dns', [
                'dns_records' => $request->dns_records ?? [],
            ]);
        }

        return $request->fresh();
    }

    public function getRestaurantOverview(Restaurant $restaurant): array
    {
        $openRequest = DomainRequest::where('restaurant_id', $restaurant->id)
            ->whereIn('status', DomainRequest::BLOCKING_STATUSES)
            ->latest()
            ->first();

        $activeDomain = RestaurantDomain::where('restaurant_id', $restaurant->id)
            ->active()
            ->primary()
            ->first();

        $history = DomainRequest::where('restaurant_id', $restaurant->id)
            ->whereNotIn('status', DomainRequest::BLOCKING_STATUSES)
            ->orderByDesc('created_at')
            ->limit(20)
            ->get();

        $pricing = [
            'existing_domain' => config('domain_services.existing_domain'),
            'full_service' => config('domain_services.full_service'),
        ];

        return [
            'open_request' => $openRequest,
            'active_domain' => $activeDomain,
            'restaurant_custom_domain' => $restaurant->custom_domain,
            'restaurant_ssl_status' => $restaurant->custom_domain_ssl_status,
            'restaurant_connected_at' => $restaurant->custom_domain_connected_at,
            'history' => $history,
            'can_create' => $this->canCreateConnectRequest($restaurant->id)['ok'],
            'pricing' => $pricing,
        ];
    }

    public function notifySuperAdmins(DomainRequest $request, string $event): void
    {
        $restaurant = $request->restaurant;
        $typeLabel = match ($request->type) {
            DomainRequest::TYPE_EXISTING => 'חיבור דומיין קיים',
            DomainRequest::TYPE_FULL_SERVICE => 'שירות מלא',
            DomainRequest::TYPE_CHANGE => 'שינוי דומיין',
            DomainRequest::TYPE_DISCONNECT => 'ניתוק דומיין',
            default => $request->type,
        };

        $title = "בקשת דומיין: {$restaurant->name}";
        $body = "{$typeLabel} — {$request->request_number}. דומיין: " . ($request->domain_name ?: '—');

        try {
            MonitoringAlert::withoutGlobalScopes()->create([
                'tenant_id' => $restaurant->tenant_id,
                'restaurant_id' => $restaurant->id,
                'alert_type' => 'domain_request',
                'title' => $title,
                'body' => $body,
                'severity' => 'info',
                'metadata' => [
                    'domain_request_id' => $request->id,
                    'event' => $event,
                ],
                'is_read' => false,
            ]);
        } catch (\Throwable $e) {
            Log::warning('DomainRequestService: MonitoringAlert failed', ['error' => $e->getMessage()]);
        }

        try {
            NotificationLog::create([
                'channel' => 'system',
                'type' => 'domain_request',
                'title' => $title,
                'body' => $body,
                'sender_id' => $request->requested_by_user_id,
                'target_restaurant_ids' => [$restaurant->id],
                'tokens_targeted' => 0,
                'sent_ok' => 0,
                'metadata' => [
                    'domain_request_id' => $request->id,
                    'event' => $event,
                ],
            ]);
        } catch (\Throwable $e) {
            Log::warning('DomainRequestService: NotificationLog failed', ['error' => $e->getMessage()]);
        }

        $emails = User::where('is_super_admin', true)
            ->whereNotNull('email')
            ->where('email', '!=', '')
            ->pluck('email');

        foreach ($emails as $email) {
            try {
                Mail::to($email)->send(new DomainRequestAdminMail($request, $event));
            } catch (\Throwable $e) {
                Log::warning('DomainRequestService: admin mail failed', ['email' => $email, 'error' => $e->getMessage()]);
            }
        }
    }

    public function notifyCustomer(DomainRequest $request, string $event, array $context = []): void
    {
        $request->loadMissing(['restaurant', 'requestedBy']);

        $emails = collect();
        if ($request->requestedBy?->email) {
            $emails->push($request->requestedBy->email);
        }

        User::query()
            ->where('restaurant_id', $request->restaurant_id)
            ->where('role', 'owner')
            ->whereNotNull('email')
            ->where('email', '!=', '')
            ->pluck('email')
            ->each(fn ($email) => $emails->push($email));

        foreach ($emails->unique()->filter() as $email) {
            try {
                Mail::to($email)->send(new DomainRequestCustomerMail($request, $event, $context));
            } catch (\Throwable $e) {
                Log::warning('DomainRequestService: customer mail failed', [
                    'email' => $email,
                    'event' => $event,
                    'error' => $e->getMessage(),
                ]);
            }
        }
    }
}

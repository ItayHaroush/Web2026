<?php

namespace App\Services;

use App\Models\DomainRequest;
use App\Models\Restaurant;
use App\Models\RestaurantDomain;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Strict activation + safe disconnect orchestration.
 */
class DomainActivationService
{
    public function __construct(
        private VercelDomainService $vercel,
        private DomainRequestService $domainRequestService,
        private DomainVerificationService $verification,
    ) {}

    /**
     * Ensure domain is registered in Vercel and DNS records are stored on the request.
     */
    public function prepareInVercel(DomainRequest $request, string $domain): array
    {
        if (!$this->vercel->isConfigured()) {
            return [
                'ok' => false,
                'message' => 'Vercel לא מוגדר — הוסף VERCEL_TOKEN ו-VERCEL_PROJECT_ID',
            ];
        }

        $exists = $this->vercel->domainExistsInProject($domain);
        if (!$exists) {
            $add = $this->vercel->addDomain($domain);
            if (!$add['success']) {
                return [
                    'ok' => false,
                    'message' => $add['error'] ?? 'שגיאה בהוספת דומיין ל-Vercel',
                    'dns_records' => $add['dns_records'] ?? [],
                ];
            }
            $request->update([
                'dns_records' => $add['dns_records'] ?? [],
                'vercel_domain_id' => $add['vercel_domain_id'] ?? $domain,
            ]);
        } else {
            $status = $this->vercel->getDomainStatus($domain);
            $request->update([
                'dns_records' => $status['dns_records'] ?? $request->dns_records,
                'vercel_domain_id' => $status['vercel_domain_id'] ?? $domain,
            ]);
        }

        return [
            'ok' => true,
            'dns_records' => $request->fresh()->dns_records ?? [],
        ];
    }

    /**
     * Domain Activation Lock — DB writes only when all gates pass.
     */
    public function activate(
        DomainRequest $request,
        Restaurant $restaurant,
        string $domain,
        User $admin,
        string $domainType = RestaurantDomain::TYPE_PRIMARY,
        ?Request $httpRequest = null,
    ): array {
        $domain = $this->verification->normalize($domain) ?? $domain;

        $available = $this->verification->verifyAvailable($domain, $restaurant->id);
        if (!$available['ok']) {
            return ['success' => false, 'message' => $available['message']];
        }

        $prepare = $this->prepareInVercel($request, $domain);
        if (!$prepare['ok']) {
            return [
                'success' => false,
                'message' => $prepare['message'],
                'dns_records' => $prepare['dns_records'] ?? [],
            ];
        }

        $readiness = $this->vercel->checkActivationReadiness($domain);

        if (!$readiness['can_activate']) {
            $blockedStatus = $readiness['suggested_request_status'] ?? DomainRequest::STATUS_AWAITING_DNS;
            $request->update([
                'status' => $blockedStatus,
                'ssl_status' => $readiness['ssl_status'] ?? 'pending',
                'dns_records' => $readiness['dns_records'] ?? $request->dns_records,
            ]);

            $this->upsertPendingDomainRecord($request, $restaurant, $domain, $readiness);

            $this->domainRequestService->logAudit(
                $request,
                'activate_blocked',
                $admin,
                $readiness,
                $readiness['message'] ?? 'Activation lock',
                $httpRequest
            );

            return [
                'success' => false,
                'message' => $readiness['message'],
                'dns_records' => $readiness['dns_records'] ?? [],
                'status' => $blockedStatus,
                'readiness' => $readiness,
            ];
        }

        return DB::transaction(function () use ($request, $restaurant, $domain, $domainType, $admin, $readiness, $httpRequest) {
            if ($domainType === RestaurantDomain::TYPE_PRIMARY) {
                RestaurantDomain::where('restaurant_id', $restaurant->id)
                    ->where('domain_type', RestaurantDomain::TYPE_PRIMARY)
                    ->where('is_active', true)
                    ->each(fn (RestaurantDomain $d) => $d->markLegacy());
            }

            $restaurantDomain = RestaurantDomain::updateOrCreate(
                ['domain' => $domain],
                [
                    'restaurant_id' => $restaurant->id,
                    'tenant_id' => $restaurant->tenant_id,
                    'domain_type' => $domainType,
                    'domain_request_id' => $request->id,
                    'vercel_domain_id' => $readiness['vercel_domain_id'] ?? $domain,
                    'ssl_status' => 'active',
                    'health_status' => RestaurantDomain::HEALTH_HEALTHY,
                    'health_checked_at' => now(),
                    'connected_at' => now(),
                    'is_active' => true,
                    'deleted_at' => null,
                ]
            );

            if ($domainType === RestaurantDomain::TYPE_PRIMARY) {
                $restaurant->update([
                    'custom_domain' => $domain,
                    'custom_domain_connected_at' => now(),
                    'custom_domain_ssl_status' => 'active',
                ]);
            }

            $request->update([
                'active_domain' => $domain,
                'status' => DomainRequest::STATUS_ACTIVE,
                'ssl_status' => 'active',
                'connected_at' => now(),
                'handled_by' => $admin->id,
                'vercel_domain_id' => $readiness['vercel_domain_id'] ?? $domain,
            ]);

            $this->domainRequestService->logAudit(
                $request,
                'domain_activated',
                $admin,
                [
                    'domain' => $domain,
                    'domain_type' => $domainType,
                    'restaurant_domain_id' => $restaurantDomain->id,
                    'readiness' => $readiness,
                ],
                null,
                $httpRequest
            );

            $this->domainRequestService->notifyCustomer($request->fresh(), 'domain_active');

            return [
                'success' => true,
                'message' => 'הדומיין הופעל בהצלחה',
                'data' => $request->fresh(['restaurant']),
            ];
        });
    }

    /**
     * Safe disconnect — Vercel remove + legacy + clear restaurant cache. No hard deletes.
     */
    public function safeDisconnect(
        DomainRequest $request,
        Restaurant $restaurant,
        User $admin,
        ?Request $httpRequest = null,
    ): array {
        $domain = $restaurant->custom_domain
            ?: RestaurantDomain::where('restaurant_id', $restaurant->id)
                ->active()
                ->primary()
                ->value('domain');

        if (!$domain) {
            return ['success' => false, 'message' => 'אין דומיין פעיל לניתוק'];
        }

        return DB::transaction(function () use ($request, $restaurant, $domain, $admin, $httpRequest) {
            if ($this->vercel->isConfigured()) {
                $removed = $this->vercel->removeDomain($domain);
                if (!$removed['success']) {
                    $this->domainRequestService->logAudit(
                        $request,
                        'disconnect_vercel_warning',
                        $admin,
                        $removed,
                        $removed['error'] ?? null,
                        $httpRequest
                    );
                }
            }

            RestaurantDomain::where('restaurant_id', $restaurant->id)
                ->where('domain', $domain)
                ->each(function (RestaurantDomain $rd) {
                    $rd->markLegacy();
                    $rd->update([
                        'health_status' => RestaurantDomain::HEALTH_ERROR,
                        'health_checked_at' => now(),
                        'ssl_status' => 'removed',
                    ]);
                });

            $restaurant->update([
                'custom_domain' => null,
                'custom_domain_connected_at' => null,
                'custom_domain_ssl_status' => null,
            ]);

            $request->update([
                'status' => DomainRequest::STATUS_COMPLETED,
                'handled_by' => $admin->id,
            ]);

            $this->domainRequestService->logAudit(
                $request,
                'domain_disconnected',
                $admin,
                ['domain' => $domain],
                null,
                $httpRequest
            );

            return [
                'success' => true,
                'message' => 'הדומיין נותק בהצלחה (היסטוריה נשמרה)',
                'domain' => $domain,
            ];
        });
    }

    /** Track in-flight domain without activating */
    private function upsertPendingDomainRecord(
        DomainRequest $request,
        Restaurant $restaurant,
        string $domain,
        array $readiness,
    ): void {
        RestaurantDomain::updateOrCreate(
            ['domain' => $domain],
            [
                'restaurant_id' => $restaurant->id,
                'tenant_id' => $restaurant->tenant_id,
                'domain_request_id' => $request->id,
                'domain_type' => RestaurantDomain::TYPE_PRIMARY,
                'vercel_domain_id' => $readiness['vercel_domain_id'] ?? null,
                'ssl_status' => $readiness['ssl_status'] ?? 'pending',
                'health_status' => $readiness['health_status'] ?? RestaurantDomain::HEALTH_PENDING,
                'health_checked_at' => now(),
                'is_active' => false,
            ]
        );
    }
}

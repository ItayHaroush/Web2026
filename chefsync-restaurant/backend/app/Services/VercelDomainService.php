<?php

namespace App\Services;

use App\Models\DomainRequest;
use App\Models\RestaurantDomain;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Vercel Domains API — add / remove / list / status + activation readiness.
 */
class VercelDomainService
{
    public function isConfigured(): bool
    {
        return !empty(config('services.vercel.token'))
            && !empty(config('services.vercel.project_id'));
    }

    public function addDomain(string $domain): array
    {
        if (!$this->isConfigured()) {
            return $this->notConfiguredResponse($domain);
        }

        try {
            $response = Http::withToken(config('services.vercel.token'))
                ->post($this->projectUrl('/domains'), ['name' => $domain]);

            if ($response->status() === 409) {
                return $this->getDomainStatus($domain);
            }

            if (!$response->successful()) {
                Log::warning('Vercel addDomain failed', [
                    'domain' => $domain,
                    'status' => $response->status(),
                    'body' => $response->json(),
                ]);

                return [
                    'success' => false,
                    'error' => $response->json('error.message') ?? 'שגיאה בהוספת דומיין ב-Vercel',
                    'dns_records' => $this->defaultDnsRecords($domain),
                ];
            }

            $data = $response->json();

            return array_merge($this->normalizeStatusPayload($domain, $data), [
                'success' => true,
            ]);
        } catch (\Throwable $e) {
            Log::error('Vercel addDomain exception', ['domain' => $domain, 'error' => $e->getMessage()]);

            return [
                'success' => false,
                'error' => $e->getMessage(),
                'dns_records' => $this->defaultDnsRecords($domain),
            ];
        }
    }

    public function removeDomain(string $domain): array
    {
        if (!$this->isConfigured()) {
            return ['success' => false, 'error' => 'Vercel לא מוגדר'];
        }

        try {
            $encoded = rawurlencode($domain);
            $response = Http::withToken(config('services.vercel.token'))
                ->delete($this->projectUrl("/domains/{$encoded}"));

            if ($response->status() === 404) {
                return ['success' => true, 'message' => 'דומיין לא היה ב-Vercel'];
            }

            if (!$response->successful()) {
                return [
                    'success' => false,
                    'error' => $response->json('error.message') ?? 'שגיאה בהסרת דומיין',
                ];
            }

            return ['success' => true];
        } catch (\Throwable $e) {
            Log::error('Vercel removeDomain exception', ['domain' => $domain, 'error' => $e->getMessage()]);

            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    public function getDomainStatus(string $domain): array
    {
        if (!$this->isConfigured()) {
            return [
                'success' => false,
                'exists' => false,
                'verified' => false,
                'ssl_status' => 'unknown',
                'health_status' => RestaurantDomain::HEALTH_PENDING,
                'dns_records' => $this->defaultDnsRecords($domain),
            ];
        }

        try {
            $encoded = rawurlencode($domain);
            $response = Http::withToken(config('services.vercel.token'))
                ->get($this->projectUrl("/domains/{$encoded}"));

            if ($response->status() === 404) {
                return [
                    'success' => true,
                    'exists' => false,
                    'verified' => false,
                    'ssl_status' => 'pending',
                    'health_status' => RestaurantDomain::HEALTH_PENDING,
                    'dns_records' => $this->defaultDnsRecords($domain),
                ];
            }

            if (!$response->successful()) {
                return [
                    'success' => false,
                    'exists' => false,
                    'verified' => false,
                    'ssl_status' => 'unknown',
                    'health_status' => RestaurantDomain::HEALTH_ERROR,
                    'dns_records' => $this->defaultDnsRecords($domain),
                    'error' => $response->json('error.message'),
                ];
            }

            return array_merge($this->normalizeStatusPayload($domain, $response->json()), [
                'success' => true,
            ]);
        } catch (\Throwable $e) {
            Log::warning('Vercel getDomainStatus failed', ['domain' => $domain, 'error' => $e->getMessage()]);

            return [
                'success' => false,
                'exists' => false,
                'verified' => false,
                'ssl_status' => 'unknown',
                'health_status' => RestaurantDomain::HEALTH_ERROR,
                'dns_records' => $this->defaultDnsRecords($domain),
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * @return array{domains: array<int, array>, success: bool}
     */
    public function listDomains(): array
    {
        if (!$this->isConfigured()) {
            return ['success' => false, 'domains' => []];
        }

        try {
            $response = Http::withToken(config('services.vercel.token'))
                ->get($this->projectUrl('/domains'));

            if (!$response->successful()) {
                return [
                    'success' => false,
                    'domains' => [],
                    'error' => $response->json('error.message'),
                ];
            }

            $domains = collect($response->json('domains') ?? [])
                ->map(fn ($d) => is_string($d) ? $d : ($d['name'] ?? null))
                ->filter()
                ->values()
                ->all();

            return ['success' => true, 'domains' => $domains];
        } catch (\Throwable $e) {
            Log::warning('Vercel listDomains failed', ['error' => $e->getMessage()]);

            return ['success' => false, 'domains' => [], 'error' => $e->getMessage()];
        }
    }

    public function domainExistsInProject(string $domain): bool
    {
        $status = $this->getDomainStatus($domain);

        return (bool) ($status['exists'] ?? false);
    }

    /**
     * Activation lock — all must be true before DB activation writes.
     */
    public function checkActivationReadiness(string $domain): array
    {
        $status = $this->getDomainStatus($domain);
        $exists = (bool) ($status['exists'] ?? false);
        $verified = (bool) ($status['verified'] ?? false);
        $sslStatus = $status['ssl_status'] ?? 'pending';
        $sslActive = $sslStatus === 'active';
        $health = $this->resolveHealthStatus($exists, $verified, $sslActive, $status['success'] ?? false);

        $canActivate = $exists && $verified && $sslActive;

        $message = match (true) {
            !$exists => 'הדומיין לא קיים בפרויקט Vercel — יש להוסיף אותו תחילה',
            !$verified => 'ה-DNS עדיין לא מצביע ל-TakeEat — לא ניתן להפעיל',
            !$sslActive => 'תעודת SSL עדיין לא פעילה — המתן לסיום ההנפקה',
            default => 'מוכן להפעלה',
        };

        $suggestedRequestStatus = match (true) {
            !$exists, !$verified => DomainRequest::STATUS_AWAITING_DNS,
            !$sslActive => DomainRequest::STATUS_SSL_SETUP,
            default => DomainRequest::STATUS_ACTIVE,
        };

        return [
            'can_activate' => $canActivate,
            'exists' => $exists,
            'verified' => $verified,
            'ssl_status' => $sslStatus,
            'ssl_active' => $sslActive,
            'health_status' => $health,
            'message' => $message,
            'suggested_request_status' => $suggestedRequestStatus,
            'dns_records' => $status['dns_records'] ?? [],
            'vercel_domain_id' => $status['vercel_domain_id'] ?? $domain,
        ];
    }

    public function resolveHealthStatus(bool $exists, bool $verified, bool $sslActive, bool $apiOk = true): string
    {
        if (!$apiOk) {
            return RestaurantDomain::HEALTH_ERROR;
        }
        if (!$exists) {
            return RestaurantDomain::HEALTH_PENDING;
        }
        if (!$verified) {
            return RestaurantDomain::HEALTH_DNS_PENDING;
        }
        if (!$sslActive) {
            return RestaurantDomain::HEALTH_SSL_PENDING;
        }

        return RestaurantDomain::HEALTH_HEALTHY;
    }

    /** @deprecated use checkActivationReadiness */
    public function verifyDnsOwnership(string $domain, array $expectedRecords): array
    {
        $readiness = $this->checkActivationReadiness($domain);

        return [
            'verified' => $readiness['can_activate'],
            'message' => $readiness['message'],
            'records' => $readiness['dns_records'] ?? $expectedRecords,
        ];
    }

    private function normalizeStatusPayload(string $domain, array $data): array
    {
        $verified = (bool) ($data['verified'] ?? false);
        $exists = true;
        $sslStatus = $this->resolveSslStatus($domain, $verified);
        $sslActive = $sslStatus === 'active';

        return [
            'exists' => $exists,
            'verified' => $verified,
            'vercel_domain_id' => $data['name'] ?? $domain,
            'dns_records' => $this->parseDnsRecords($data, $domain),
            'ssl_status' => $sslStatus,
            'ssl_active' => $sslActive,
            'health_status' => $this->resolveHealthStatus($exists, $verified, $sslActive, true),
        ];
    }

    private function resolveSslStatus(string $domain, bool $verified): string
    {
        if (!$verified) {
            return 'pending';
        }

        if (!$this->isConfigured()) {
            return 'pending';
        }

        try {
            $encoded = rawurlencode($domain);
            $response = Http::withToken(config('services.vercel.token'))
                ->get($this->apiUrl("/v6/domains/{$encoded}/config") . $this->teamQuery());

            if ($response->successful()) {
                $misconfigured = (bool) ($response->json('misconfigured') ?? true);
                return $misconfigured ? 'pending' : 'active';
            }
        } catch (\Throwable $e) {
            Log::debug('Vercel SSL config check failed', ['domain' => $domain, 'error' => $e->getMessage()]);
        }

        return $verified ? 'active' : 'pending';
    }

    private function projectUrl(string $path): string
    {
        $projectId = config('services.vercel.project_id');

        return $this->apiUrl("/v9/projects/{$projectId}{$path}") . $this->teamQuery();
    }

    private function apiUrl(string $path): string
    {
        return 'https://api.vercel.com' . $path;
    }

    private function teamQuery(): string
    {
        $teamId = config('services.vercel.team_id');
        return $teamId ? ('?' . http_build_query(['teamId' => $teamId])) : '';
    }

    private function notConfiguredResponse(string $domain): array
    {
        return [
            'success' => false,
            'error' => 'Vercel לא מוגדר',
            'dns_records' => $this->defaultDnsRecords($domain),
        ];
    }

    private function defaultDnsRecords(string $domain): array
    {
        return [
            [
                'type' => 'CNAME',
                'name' => $domain,
                'value' => 'cname.vercel-dns.com',
            ],
        ];
    }

    private function parseDnsRecords(array $data, string $domain): array
    {
        if (!empty($data['verification']) && is_array($data['verification'])) {
            $records = collect($data['verification'])
                ->map(fn ($v) => [
                    'type' => $v['type'] ?? 'TXT',
                    'name' => $v['domain'] ?? ($v['name'] ?? ''),
                    'value' => $v['value'] ?? '',
                ])
                ->values()
                ->all();

            if ($records !== []) {
                return $records;
            }
        }

        return $this->defaultDnsRecords($data['name'] ?? $domain);
    }
}

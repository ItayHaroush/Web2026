<?php

namespace App\Services;

use App\Models\Restaurant;
use App\Models\RestaurantDomain;

class HostTenantResolver
{
    public function __construct(
        private DomainVerificationService $verification,
    ) {}

    public function normalizeHost(?string $host): string
    {
        $host = strtolower(trim((string) $host));
        $host = preg_replace('#:\d+$#', '', $host) ?? $host;

        return $host;
    }

    public function isPlatformHost(?string $host): bool
    {
        return $this->verification->isPlatformDomain($this->normalizeHost($host));
    }

    /**
     * Resolve active primary restaurant for a custom domain host.
     * Returns null if unknown — callers must abort(404), never fallback.
     */
    public function resolveRestaurantByHost(?string $host): ?Restaurant
    {
        $host = $this->normalizeHost($host);

        if ($host === '' || $this->isPlatformHost($host)) {
            return null;
        }

        $domainRow = RestaurantDomain::query()
            ->where('domain', $host)
            ->where('is_active', true)
            ->where('domain_type', RestaurantDomain::TYPE_PRIMARY)
            ->whereNull('deleted_at')
            ->first();

        if ($domainRow) {
            return Restaurant::withoutGlobalScopes()->find($domainRow->restaurant_id);
        }

        return Restaurant::withoutGlobalScopes()
            ->where('custom_domain', $host)
            ->first();
    }

    public function resolvePayload(?string $host): ?array
    {
        $restaurant = $this->resolveRestaurantByHost($host);

        if (!$restaurant) {
            return null;
        }

        $host = $this->normalizeHost($host);
        $domainRow = RestaurantDomain::query()
            ->where('domain', $host)
            ->where('is_active', true)
            ->first();

        return [
            'tenant_id' => $restaurant->tenant_id,
            'slug' => $restaurant->slug,
            'restaurant_id' => $restaurant->id,
            'restaurant_name' => $restaurant->name,
            'custom_domain' => $host,
            'domain_type' => $domainRow?->domain_type ?? RestaurantDomain::TYPE_PRIMARY,
            'health_status' => $domainRow?->health_status,
            'ssl_status' => $domainRow?->ssl_status ?? $restaurant->custom_domain_ssl_status,
        ];
    }
}

<?php

namespace App\Services;

use App\Models\DomainRequest;
use App\Models\Restaurant;
use App\Models\RestaurantDomain;
use Illuminate\Support\Str;

class DomainVerificationService
{
    /**
     * Normalize domain: lowercase, strip protocol/www, trim trailing dot.
     */
    public function normalize(?string $domain): ?string
    {
        if ($domain === null || trim($domain) === '') {
            return null;
        }

        $domain = strtolower(trim($domain));
        $domain = preg_replace('#^https?://#', '', $domain) ?? $domain;
        $domain = preg_replace('#/.*$#', '', $domain) ?? $domain;
        $domain = preg_replace('#^www\.#', '', $domain) ?? $domain;
        $domain = rtrim($domain, '.');

        return $domain !== '' ? $domain : null;
    }

    public function isValidFormat(?string $domain): bool
    {
        if (!$domain) {
            return false;
        }

        return (bool) preg_match(
            '/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i',
            $domain
        );
    }

    /**
     * Block platform hosts and *.takeeat.co.il / *.chefsync.co.il subdomains.
     */
    public function isPlatformDomain(string $domain): bool
    {
        $domain = $this->normalize($domain) ?? $domain;

        // Local dev loopback — never a restaurant custom domain (start.sh API uses 127.0.0.1)
        if (in_array($domain, ['127.0.0.1', '::1', '[::1]'], true)) {
            return true;
        }

        $platformHosts = config('domain_services.platform_hosts', []);
        $rootDomains = config('domain_services.platform_root_domains', []);

        if (in_array($domain, $platformHosts, true)) {
            return true;
        }

        foreach ($rootDomains as $root) {
            $root = strtolower(trim($root));
            if ($root === '') {
                continue;
            }
            // Exact match or any subdomain (*.takeeat.co.il)
            if ($domain === $root || str_ends_with($domain, '.' . $root)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Full availability check before payment / activation.
     *
     * @return array{ok: bool, message?: string, domain?: string}
     */
    public function verifyAvailable(string $rawDomain, ?int $excludeRestaurantId = null): array
    {
        $domain = $this->normalize($rawDomain);

        if (!$domain) {
            return ['ok' => false, 'message' => 'יש להזין שם דומיין'];
        }

        if (!$this->isValidFormat($domain)) {
            return ['ok' => false, 'message' => 'פורמט דומיין לא תקין'];
        }

        if ($this->isPlatformDomain($domain)) {
            return ['ok' => false, 'message' => 'לא ניתן להשתמש בדומיין של הפלטפורמה'];
        }

        if ($this->isConnectedElsewhere($domain, $excludeRestaurantId)) {
            return ['ok' => false, 'message' => 'הדומיין כבר מחובר למסעדה אחרת'];
        }

        if ($this->isInOpenRequestElsewhere($domain, $excludeRestaurantId)) {
            return ['ok' => false, 'message' => 'קיימת בקשה פעילה לדומיין זה'];
        }

        return ['ok' => true, 'domain' => $domain];
    }

    public function isConnectedElsewhere(string $domain, ?int $excludeRestaurantId = null): bool
    {
        $domain = $this->normalize($domain) ?? $domain;

        $onRestaurant = Restaurant::withoutGlobalScopes()
            ->where('custom_domain', $domain)
            ->when($excludeRestaurantId, fn ($q) => $q->where('id', '!=', $excludeRestaurantId))
            ->exists();

        if ($onRestaurant) {
            return true;
        }

        return RestaurantDomain::query()
            ->where('domain', $domain)
            ->where('is_active', true)
            ->when($excludeRestaurantId, fn ($q) => $q->where('restaurant_id', '!=', $excludeRestaurantId))
            ->exists();
    }

    public function isInOpenRequestElsewhere(string $domain, ?int $excludeRestaurantId = null): bool
    {
        $domain = $this->normalize($domain) ?? $domain;

        return DomainRequest::query()
            ->whereIn('status', DomainRequest::BLOCKING_STATUSES)
            ->when($excludeRestaurantId, fn ($q) => $q->where('restaurant_id', '!=', $excludeRestaurantId))
            ->where(function ($q) use ($domain) {
                $q->where('domain_name', $domain)
                    ->orWhere('domain_name_alt_2', $domain)
                    ->orWhere('domain_name_alt_3', $domain)
                    ->orWhere('active_domain', $domain);
            })
            ->exists();
    }

    /**
     * Domain Ownership Lock — DNS must point to TakeEat/Vercel before activate.
     * Sprint 2: full Vercel verification; Sprint 1: stub returns not verified.
     *
     * @return array{verified: bool, message: string, records?: array}
     */
    public function verifyOwnership(string $domain, ?array $expectedRecords = null): array
    {
        $domain = $this->normalize($domain) ?? $domain;

        if ($expectedRecords === null || $expectedRecords === []) {
            return [
                'verified' => false,
                'message' => 'לא נמצאו רשומות DNS — יש להוסיף את הדומיין ב-Vercel תחילה',
            ];
        }

        // Sprint 2: compare live DNS against expectedRecords via VercelDomainService
        return app(VercelDomainService::class)->verifyDnsOwnership($domain, $expectedRecords);
    }
}

<?php

namespace App\Http\Middleware;

use App\Services\HostTenantResolver;
use Closure;
use Illuminate\Http\Request;

/**
 * Resolves tenant from Host on custom domains.
 * Unknown custom domains → 404 (no TakeEat fallback).
 */
class ResolveTenantFromHost
{
    public function __construct(
        private HostTenantResolver $resolver,
    ) {}

    public function handle(Request $request, Closure $next)
    {
        $host = $this->resolver->normalizeHost($request->getHost());

        if ($this->resolver->isPlatformHost($host)) {
            return $next($request);
        }

        $restaurant = $this->resolver->resolveRestaurantByHost($host);

        if (!$restaurant) {
            abort(404, 'Domain not found');
        }

        $tenantId = $restaurant->tenant_id;

        app()['tenant_id'] = $tenantId;
        app()['resolved_from_host'] = true;
        $request->merge(['tenant_id' => $tenantId]);

        $headerTenant = $request->header('X-Tenant-ID');
        if ($headerTenant && $headerTenant !== $tenantId) {
            $request->headers->set('X-Tenant-ID', $tenantId);
        }

        return $next($request);
    }
}

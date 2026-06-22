<?php

namespace App\Http\Controllers;

use App\Services\HostTenantResolver;
use Illuminate\Http\Request;

class PublicHostController extends Controller
{
    public function __construct(
        private HostTenantResolver $resolver,
    ) {}

    /**
     * GET /api/public/resolve-host?host=
     * Platform hosts → { platform: true }. Custom domains → tenant payload or 404.
     */
    public function resolveHost(Request $request)
    {
        $host = $this->resolver->normalizeHost(
            $request->query('host') ?: $request->getHost()
        );

        if ($host === '') {
            abort(404);
        }

        if ($this->resolver->isPlatformHost($host)) {
            return response()->json([
                'success' => true,
                'data' => [
                    'platform' => true,
                    'host' => $host,
                ],
            ]);
        }

        $payload = $this->resolver->resolvePayload($host);

        if (!$payload) {
            abort(404, 'Domain not found');
        }

        return response()->json([
            'success' => true,
            'data' => array_merge($payload, [
                'platform' => false,
                'host' => $host,
            ]),
        ]);
    }
}

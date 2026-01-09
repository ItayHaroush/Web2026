<?php

namespace App\Http\Controllers;

use App\Models\City;
use App\Models\FcmToken;
use App\Models\Restaurant;
use App\Services\FcmService;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Collection;

class SuperAdminNotificationController extends Controller
{
    public function filters(Request $request)
    {
        // No tenant middleware here; super-admin is allowed to see cross-tenant filters.
        $cuisineTypes = Restaurant::query()
            ->whereNotNull('cuisine_type')
            ->where('cuisine_type', '!=', '')
            ->distinct()
            ->orderBy('cuisine_type')
            ->pluck('cuisine_type')
            ->values();

        $regions = City::query()
            ->whereNotNull('region')
            ->where('region', '!=', '')
            ->distinct()
            ->orderBy('region')
            ->pluck('region')
            ->values();

        $cities = City::query()
            ->select(['name', 'hebrew_name', 'region'])
            ->orderBy('hebrew_name')
            ->get()
            ->map(fn($c) => [
                'name' => $c->name,
                'hebrew_name' => $c->hebrew_name,
                'region' => $c->region,
            ]);

        $restaurants = Restaurant::query()
            ->select(['id', 'tenant_id', 'name', 'city', 'cuisine_type'])
            ->orderBy('name')
            ->get();

        return response()->json([
            'success' => true,
            'data' => [
                'cuisine_types' => $cuisineTypes,
                'regions' => $regions,
                'cities' => $cities,
                'restaurants' => $restaurants,
            ],
        ]);
    }

    public function send(Request $request)
    {
        $payload = $request->validate([
            'title' => 'required|string|max:80',
            'body' => 'required|string|max:200',
            'filters' => 'nullable|array',
            'filters.tenant_ids' => 'nullable|array',
            'filters.tenant_ids.*' => 'string|max:100',
            'filters.restaurant_ids' => 'nullable|array',
            'filters.restaurant_ids.*' => 'integer',
            'filters.cuisine_types' => 'nullable|array',
            'filters.cuisine_types.*' => 'string|max:100',
            'filters.regions' => 'nullable|array',
            'filters.regions.*' => 'string|max:100',
            'filters.cities' => 'nullable|array',
            'filters.cities.*' => 'string|max:100',
            'filters.user_ids' => 'nullable|array',
            'filters.user_ids.*' => 'integer',
            'filters.device_labels' => 'nullable|array',
            'filters.device_labels.*' => 'string|max:100',
            'dry_run' => 'nullable|boolean',
            'data' => 'nullable|array',
        ]);

        $filters = Arr::get($payload, 'filters', []);
        $tenantIds = $this->resolveTenantIds($filters);

        $tokenQuery = FcmToken::query();

        if ($tenantIds->isNotEmpty()) {
            $tokenQuery->whereIn('tenant_id', $tenantIds->all());
        }

        $userIds = collect(Arr::get($filters, 'user_ids', []))->filter();
        if ($userIds->isNotEmpty()) {
            $tokenQuery->whereIn('user_id', $userIds->all());
        }

        $deviceLabels = collect(Arr::get($filters, 'device_labels', []))->filter();
        if ($deviceLabels->isNotEmpty()) {
            $tokenQuery->whereIn('device_label', $deviceLabels->all());
        }

        $tokens = $tokenQuery->pluck('token');

        $dryRun = (bool) ($payload['dry_run'] ?? false);
        if ($dryRun) {
            return response()->json([
                'success' => true,
                'dry_run' => true,
                'data' => [
                    'tenants_targeted' => $tenantIds,
                    'tokens_targeted' => $tokens->count(),
                ],
            ]);
        }

        $fcm = app(FcmService::class);
        $extraData = array_merge(
            [
                'type' => 'super_admin_broadcast',
                'url' => (string) (Arr::get($payload, 'data.url', '/')),
            ],
            Arr::get($payload, 'data', [])
        );

        $sent = 0;
        foreach ($tokens as $token) {
            $ok = $fcm->sendToToken($token, $payload['title'], $payload['body'], $extraData);
            if ($ok) {
                $sent++;
            }
        }

        return response()->json([
            'success' => true,
            'data' => [
                'tenants_targeted' => $tenantIds,
                'tokens_targeted' => $tokens->count(),
                'sent_ok' => $sent,
            ],
        ]);
    }

    private function resolveTenantIds(array $filters): Collection
    {
        $tenantIds = collect(Arr::get($filters, 'tenant_ids', []))
            ->filter()
            ->map(fn($t) => (string) $t);

        $restaurantIds = collect(Arr::get($filters, 'restaurant_ids', []))->filter();
        if ($restaurantIds->isNotEmpty()) {
            $tenantIds = $tenantIds->merge(
                Restaurant::query()->whereIn('id', $restaurantIds->all())->pluck('tenant_id')
            );
        }

        $cuisineTypes = collect(Arr::get($filters, 'cuisine_types', []))->filter();
        if ($cuisineTypes->isNotEmpty()) {
            $tenantIds = $tenantIds->merge(
                Restaurant::query()->whereIn('cuisine_type', $cuisineTypes->all())->pluck('tenant_id')
            );
        }

        $cities = collect(Arr::get($filters, 'cities', []))->filter();
        if ($cities->isNotEmpty()) {
            $tenantIds = $tenantIds->merge(
                Restaurant::query()->whereIn('city', $cities->all())->pluck('tenant_id')
            );
        }

        $regions = collect(Arr::get($filters, 'regions', []))->filter();
        if ($regions->isNotEmpty()) {
            $regionCityNames = City::query()
                ->whereIn('region', $regions->all())
                ->get(['name', 'hebrew_name'])
                ->flatMap(function ($c) {
                    return array_values(array_filter([(string) $c->name, (string) $c->hebrew_name]));
                })
                ->unique();

            if ($regionCityNames->isNotEmpty()) {
                $tenantIds = $tenantIds->merge(
                    Restaurant::query()->whereIn('city', $regionCityNames->all())->pluck('tenant_id')
                );
            }
        }

        return $tenantIds->filter()->unique()->values();
    }
}

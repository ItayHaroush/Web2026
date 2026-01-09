<?php

namespace App\Http\Controllers;

use App\Models\City;
use App\Models\FcmToken;
use App\Models\Restaurant;
use App\Services\FcmService;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
 

class SuperAdminNotificationController extends Controller
{
    public function filters(Request $request)
    {
        // No tenant middleware here; super-admin is allowed to see cross-tenant restaurants.
        // We keep filtering UX intentionally simple: select restaurants by name only.
        $restaurants = Restaurant::query()
            ->select(['id', 'tenant_id', 'name'])
            ->orderBy('name')
            ->get();

        return response()->json([
            'success' => true,
            'data' => [
                'restaurants' => $restaurants,
            ],
        ]);
    }

    public function send(Request $request)
    {
        $payload = $request->validate([
            'title' => 'required|string|max:80',
            'body' => 'required|string|max:200',
            'filters' => 'required|array',
            'filters.restaurant_ids' => 'required|array|min:1',
            'filters.restaurant_ids.*' => 'integer',
            'dry_run' => 'nullable|boolean',
            'data' => 'nullable|array',
        ]);

        $restaurantIds = collect(Arr::get($payload, 'filters.restaurant_ids', []))->filter();
        $tenantIds = Restaurant::query()
            ->whereIn('id', $restaurantIds->all())
            ->pluck('tenant_id')
            ->filter()
            ->unique()
            ->values();

        if ($tenantIds->isEmpty()) {
            return response()->json([
                'success' => false,
                'message' => 'לא נמצאו מסעדות תואמות לבחירה. לא נשלח כדי למנוע שידור לכל התפוצה.',
                'data' => [
                    'tenants_targeted' => $tenantIds,
                    'tokens_targeted' => 0,
                ],
            ], 422);
        }

        $tokenQuery = FcmToken::query();

        $tokenQuery->whereIn('tenant_id', $tenantIds->all());

        $tokens = $tokenQuery->distinct()->pluck('token');

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
}

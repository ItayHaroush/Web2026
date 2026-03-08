<?php

namespace App\Http\Controllers;

use App\Models\City;
use App\Models\FcmToken;
use App\Models\NotificationLog;
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

        // שמירת לוג
        NotificationLog::create([
            'channel' => 'push',
            'type' => 'broadcast',
            'title' => $payload['title'],
            'body' => $payload['body'],
            'sender_id' => $request->user()?->id,
            'target_restaurant_ids' => $restaurantIds->values()->toArray(),
            'tokens_targeted' => $tokens->count(),
            'sent_ok' => $sent,
        ]);

        // יצירת התראות למסעדות המקבלות
        foreach ($restaurantIds as $rId) {
            $rest = Restaurant::find($rId);
            if ($rest) {
                \App\Models\MonitoringAlert::create([
                    'tenant_id' => $rest->tenant_id,
                    'restaurant_id' => $rId,
                    'alert_type' => 'super_admin_broadcast',
                    'title' => $payload['title'],
                    'body' => $payload['body'],
                    'severity' => 'info',
                    'is_read' => false,
                ]);
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

    /**
     * היסטוריית התראות שנשלחו
     * GET /super-admin/notifications/log
     */
    public function log(Request $request)
    {
        $request->validate([
            'type' => 'nullable|string',
            'page' => 'nullable|integer|min:1',
            'per_page' => 'nullable|integer|min:1|max:100',
        ]);

        $query = NotificationLog::with('sender:id,name')
            ->orderBy('created_at', 'desc');

        if ($request->filled('type')) {
            $query->where('type', $request->input('type'));
        }

        $logs = $query->paginate($request->integer('per_page', 30));

        return response()->json([
            'success' => true,
            'data' => $logs,
        ]);
    }
}

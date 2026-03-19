<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use App\Models\CustomerPushToken;
use App\Models\CustomerToken;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;

class CustomerPwaController extends Controller
{
    /**
     * עבור SQLite (עמודה NOT NULL) — שומרים מחרוזת ריקה במקום NULL.
     */
    private function normalizeTenantForStorage(?string $tenantId): ?string
    {
        $t = $tenantId !== null && trim($tenantId) !== '' ? trim($tenantId) : null;
        if ($t === null && Schema::getConnection()->getDriverName() === 'sqlite') {
            return '';
        }

        return $t;
    }

    /**
     * לקוח אופציונלי מ-Bearer (בלי להחזיר 401).
     */
    private function resolveCustomerFromBearer(Request $request): ?Customer
    {
        $token = $request->bearerToken();
        if (!$token) {
            return null;
        }

        $hash = hash('sha256', $token);
        $record = CustomerToken::where('token_hash', $hash)->first();
        if (!$record || $record->expires_at <= now()) {
            return null;
        }

        return $record->customer;
    }

    /**
     * עדכון פעילות PWA — X-Tenant-ID אופציונלי.
     */
    public function ping(Request $request)
    {
        $validated = $request->validate([
            'standalone' => 'required|boolean',
            'push_permission' => 'nullable|string|in:granted,denied,default',
        ]);

        $customer = $this->resolveCustomerFromBearer($request);
        if (!$customer) {
            return response()->json([
                'success' => true,
                'data' => ['updated' => false, 'reason' => 'not_authenticated'],
            ]);
        }

        $now = now();
        $updates = [
            'last_app_open_at' => $now,
        ];

        if (!empty($validated['standalone'])) {
            if (!$customer->pwa_installed_at) {
                $updates['pwa_installed_at'] = $now;
            }
        }

        if (!empty($validated['push_permission'])) {
            $updates['push_permission'] = $validated['push_permission'];
            if ($validated['push_permission'] === 'granted') {
                $updates['push_opt_in_at'] = $now;
            }
        }

        $customer->update($updates);

        return response()->json([
            'success' => true,
            'data' => ['updated' => true, 'customer_id' => $customer->id],
        ]);
    }

    /**
     * רישום FCM — tenant אופציונלי (טוקן גלובלי למכשיר).
     */
    public function registerFcm(Request $request)
    {
        /** @var Customer $customer */
        $customer = $request->customer;
        $rawTenant = $request->header('X-Tenant-ID');
        $tenantId = $this->normalizeTenantForStorage($rawTenant);

        $data = $request->validate([
            'token' => 'required|string',
            'device_label' => 'nullable|string|max:100',
            'platform' => 'nullable|string|max:50',
        ]);

        $deviceLabel = $data['device_label'] ?? 'pwa';

        CustomerPushToken::query()
            ->where('customer_id', $customer->id)
            ->where('device_label', $deviceLabel)
            ->where('token', '!=', $data['token'])
            ->delete();

        CustomerPushToken::updateOrCreate(
            ['token' => $data['token']],
            [
                'customer_id' => $customer->id,
                'tenant_id' => $tenantId,
                'device_label' => $deviceLabel,
                'platform' => $data['platform'] ?? 'web',
            ]
        );

        $profile = [
            'push_permission' => 'granted',
            'push_opt_in_at' => now(),
            'last_app_open_at' => now(),
        ];
        if (!$customer->pwa_installed_at) {
            $profile['pwa_installed_at'] = now();
        }
        $customer->update($profile);

        return response()->json(['success' => true]);
    }

    /**
     * ביטול FCM ללקוח.
     */
    public function unregisterFcm(Request $request)
    {
        /** @var Customer $customer */
        $customer = $request->customer;
        $data = $request->validate([
            'token' => 'required|string',
        ]);

        CustomerPushToken::query()
            ->where('customer_id', $customer->id)
            ->where('token', $data['token'])
            ->delete();

        return response()->json(['success' => true]);
    }
}

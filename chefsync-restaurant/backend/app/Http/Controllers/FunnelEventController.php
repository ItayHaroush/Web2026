<?php

namespace App\Http\Controllers;

use App\Models\FunnelEvent;
use App\Models\Restaurant;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * קליטת אירועי משפך (Funnel) מהלקוח — ציבורי, batch, מוגבל קצב.
 *
 * הלקוח שולח מנה (batch) של אירועים עם "מעטפת" משותפת (session/device)
 * ומערך אירועים. שגיאות באירוע בודד לא מפילות את כל המנה — אנליטיקה
 * לעולם לא צריכה להחזיר 500 ולשבור את חוויית המשתמש.
 */
class FunnelEventController extends Controller
{
    private const MAX_EVENTS_PER_BATCH = 60;

    /**
     * POST /api/analytics/events
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'session_id' => 'required|uuid',
            'visitor_uuid' => 'nullable|uuid',
            'customer_id' => 'nullable|integer',
            'tenant_id' => 'nullable|string|max:64',
            'device' => 'nullable|string|max:16',
            'os' => 'nullable|string|max:24',
            'browser' => 'nullable|string|max:32',
            'is_native' => 'nullable|boolean',
            'events' => 'required|array|min:1|max:'.self::MAX_EVENTS_PER_BATCH,
        ]);

        $tenantId = $validated['tenant_id'] ?? $request->header('X-Tenant-ID');
        $tenantId = is_string($tenantId) && $tenantId !== '' ? mb_substr($tenantId, 0, 64) : null;

        $snapshot = $this->resolveRestaurantSnapshot($tenantId);
        $now = now();
        $ip = $request->ip();

        $device = $this->clampNullable($validated['device'] ?? null, 16);
        $os = $this->clampNullable($validated['os'] ?? null, 24);
        $browser = $this->clampNullable($validated['browser'] ?? null, 32);
        $isNative = (bool) ($validated['is_native'] ?? false);
        $visitorUuid = $validated['visitor_uuid'] ?? null;
        $customerId = $validated['customer_id'] ?? null;

        $rows = [];
        foreach ($request->input('events', []) as $raw) {
            if (! is_array($raw)) {
                continue;
            }

            $eventName = is_string($raw['event_name'] ?? null) ? $raw['event_name'] : null;
            if (! $eventName || ! in_array($eventName, FunnelEvent::ALLOWED_EVENTS, true)) {
                continue;
            }

            $blockReason = is_string($raw['block_reason'] ?? null) ? $raw['block_reason'] : null;
            if ($blockReason !== null && ! in_array($blockReason, FunnelEvent::ALLOWED_BLOCK_REASONS, true)) {
                $blockReason = 'other';
            }

            $rows[] = [
                'tenant_id' => $tenantId,
                'restaurant_id' => $snapshot['id'],
                'restaurant_name' => $snapshot['name'],
                'session_id' => $validated['session_id'],
                'visitor_uuid' => $visitorUuid,
                'customer_id' => $customerId,
                'event_name' => $eventName,
                'funnel_stage' => $this->clampStage($raw['funnel_stage'] ?? 0),
                'page_key' => $this->clampNullable($raw['page_key'] ?? null, 64),
                'path' => $this->clampNullable($raw['path'] ?? null, 512),
                'block_reason' => $blockReason,
                'error_type' => $this->clampNullable($raw['error_type'] ?? null, 32),
                'error_message' => $this->clampNullable($raw['error_message'] ?? null, 1000),
                'duration_ms' => $this->clampUnsigned($raw['duration_ms'] ?? null),
                'device' => $device,
                'os' => $os,
                'browser' => $browser,
                'is_native' => $isNative,
                'order_id' => $this->clampUnsigned($raw['order_id'] ?? null),
                'cart_session_id' => null,
                'amount' => $this->clampAmount($raw['amount'] ?? null),
                'payload' => isset($raw['payload']) && is_array($raw['payload'])
                    ? json_encode($raw['payload'])
                    : null,
                'ip_address' => $ip,
                'occurred_at' => $this->resolveOccurredAt($raw['ts'] ?? null, $now),
                'created_at' => $now,
            ];
        }

        if ($rows !== []) {
            // הכנסה מרובה ביעילות — ללא Eloquent events לכל שורה
            FunnelEvent::insert($rows);
        }

        return response()->json(['success' => true, 'stored' => count($rows)]);
    }

    /**
     * @return array{id: ?int, name: ?string}
     */
    private function resolveRestaurantSnapshot(?string $tenantId): array
    {
        if (! $tenantId) {
            return ['id' => null, 'name' => null];
        }

        $row = Restaurant::withoutGlobalScope('tenant')
            ->where('tenant_id', $tenantId)
            ->first(['id', 'name']);

        if (! $row) {
            return ['id' => null, 'name' => null];
        }

        return ['id' => (int) $row->id, 'name' => $row->name];
    }

    private function clampStage($value): int
    {
        $n = (int) $value;
        if ($n < 0) {
            return 0;
        }

        return $n > 20 ? 20 : $n;
    }

    private function clampUnsigned($value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }
        $n = (int) $value;

        return $n > 0 ? $n : null;
    }

    private function clampAmount($value): ?float
    {
        if ($value === null || $value === '' || ! is_numeric($value)) {
            return null;
        }
        $f = (float) $value;
        if ($f < 0) {
            return null;
        }

        return round(min($f, 99999999.99), 2);
    }

    private function clampNullable($value, int $max): ?string
    {
        if ($value === null) {
            return null;
        }
        if (! is_string($value)) {
            $value = (string) $value;
        }
        $value = trim($value);

        return $value !== '' ? mb_substr($value, 0, $max) : null;
    }

    private function resolveOccurredAt($ts, Carbon $fallback): Carbon
    {
        if (is_numeric($ts)) {
            $ms = (int) $ts;
            // אפוק במילישניות סביר (אחרי 2020, לפני 2100)
            if ($ms > 1_577_836_800_000 && $ms < 4_102_444_800_000) {
                return Carbon::createFromTimestampMs($ms);
            }
        }

        return $fallback->copy();
    }
}

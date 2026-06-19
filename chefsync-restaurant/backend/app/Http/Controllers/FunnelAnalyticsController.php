<?php

namespace App\Http\Controllers;

use App\Models\FunnelEvent;
use Carbon\Carbon;
use Illuminate\Http\Request;

/**
 * אגרגציות משפך ההמרה ל-Super Admin:
 * - משפך + נשירה בין שלבים
 * - "הסיבה מספר 1" לנטישה (block_reason)
 * - בדיקות תקינות (Health Check) — js_error / api_error לפי עמוד
 * - מדידת זמן בכל שלב
 * - פילוח לפי מכשיר/מערכת הפעלה
 */
class FunnelAnalyticsController extends Controller
{
    /** מעבר זמן מקסימלי בין שלבים שנחשב תקין (שעה) — מעבר לכך זה "דליפת session" */
    private const MAX_STAGE_GAP_SECONDS = 3600;

    /**
     * GET /super-admin/funnel/summary
     */
    public function summary(Request $request)
    {
        $user = $request->user();
        if (! $user?->is_super_admin) {
            return response()->json(['success' => false, 'message' => 'לא מורשה'], 403);
        }

        $window = $this->resolveWindow($request);
        $restaurantId = $request->filled('restaurant_id') ? (int) $request->query('restaurant_id') : null;
        $device = in_array($request->query('device'), ['mobile', 'tablet', 'desktop'], true)
            ? $request->query('device')
            : null;

        $base = fn () => FunnelEvent::query()
            ->where('created_at', '>=', $window['since'])
            ->where('created_at', '<=', $window['until'])
            ->when($restaurantId, fn ($q) => $q->where('restaurant_id', $restaurantId))
            ->when($device, fn ($q) => $q->where('device', $device));

        // --- אגרגציה ראשית ברמת ה-session ---
        $sessionRows = $base()
            ->selectRaw('session_id, MAX(funnel_stage) as furthest, MAX(device) as device, MAX(os) as os, MAX(browser) as browser')
            ->groupBy('session_id')
            ->get();

        $totalSessions = $sessionRows->count();
        $furthestBySession = [];
        foreach ($sessionRows as $row) {
            $furthestBySession[(string) $row->session_id] = (int) $row->furthest;
        }

        // --- משפך + נשירה ---
        $funnel = [];
        $prevCount = null;
        for ($stage = FunnelEvent::STAGE_MENU_VIEW; $stage <= FunnelEvent::STAGE_PAYMENT_SUCCESS; $stage++) {
            $count = 0;
            foreach ($furthestBySession as $furthest) {
                if ($furthest >= $stage) {
                    $count++;
                }
            }
            $funnel[] = [
                'stage' => $stage,
                'label' => FunnelEvent::STAGE_LABELS[$stage] ?? (string) $stage,
                'sessions' => $count,
                'pct_of_total' => $totalSessions > 0 ? round($count / $totalSessions * 100, 1) : 0.0,
                'drop_from_prev' => $prevCount === null ? 0 : max(0, $prevCount - $count),
                'drop_pct_from_prev' => ($prevCount && $prevCount > 0) ? round(($prevCount - $count) / $prevCount * 100, 1) : 0.0,
            ];
            $prevCount = $count;
        }

        $orders = $this->countAtLeast($furthestBySession, FunnelEvent::STAGE_ORDER_CREATED);
        $paid = $this->countAtLeast($furthestBySession, FunnelEvent::STAGE_PAYMENT_SUCCESS);
        $reachedCart = $this->countAtLeast($furthestBySession, FunnelEvent::STAGE_CART_VIEW);
        $reachedCheckout = $this->countAtLeast($furthestBySession, FunnelEvent::STAGE_CHECKOUT_STARTED);

        $totals = [
            'sessions' => $totalSessions,
            'reached_cart' => $reachedCart,
            'reached_checkout' => $reachedCheckout,
            'orders' => $orders,
            'paid' => $paid,
            'conversion_rate' => $totalSessions > 0 ? round($orders / $totalSessions * 100, 1) : 0.0,
            'cart_to_order_rate' => $reachedCart > 0 ? round($orders / $reachedCart * 100, 1) : 0.0,
            'abandon_rate' => $totalSessions > 0 ? round(($totalSessions - $orders) / $totalSessions * 100, 1) : 0.0,
        ];

        // --- "הסיבה מספר 1": block_reason האחרון של כל session נטוש ---
        $abandoned = [];
        foreach ($furthestBySession as $sid => $furthest) {
            if ($furthest < FunnelEvent::STAGE_ORDER_CREATED) {
                $abandoned[$sid] = true;
            }
        }

        $blockEvents = $base()
            ->where('event_name', 'checkout_blocked')
            ->whereNotNull('block_reason')
            ->orderBy('occurred_at')
            ->orderBy('id')
            ->get(['session_id', 'block_reason', 'funnel_stage', 'page_key']);

        $lastReasonBySession = [];   // session => reason
        $lastStageBySession = [];    // session => stage
        foreach ($blockEvents as $ev) {
            $sid = (string) $ev->session_id;
            if (! isset($abandoned[$sid])) {
                continue; // הזמין בסוף — לא נטישה
            }
            $lastReasonBySession[$sid] = $ev->block_reason;
            $lastStageBySession[$sid] = (int) $ev->funnel_stage;
        }

        $reasonCounts = [];
        $reasonStageCounts = [];
        foreach ($lastReasonBySession as $sid => $reason) {
            $reasonCounts[$reason] = ($reasonCounts[$reason] ?? 0) + 1;
            $stage = $lastStageBySession[$sid] ?? 0;
            $key = $reason.'|'.$stage;
            $reasonStageCounts[$key] = ($reasonStageCounts[$key] ?? 0) + 1;
        }
        arsort($reasonCounts);

        $abandonedCount = count($abandoned);
        $explicitBlocked = count($lastReasonBySession);
        $silentAbandon = max(0, $abandonedCount - $explicitBlocked);

        $topBlockReasons = [];
        foreach ($reasonCounts as $reason => $cnt) {
            $topBlockReasons[] = [
                'reason' => $reason,
                'label' => FunnelEvent::BLOCK_REASON_LABELS[$reason] ?? $reason,
                'sessions' => $cnt,
                'pct_of_abandoned' => $abandonedCount > 0 ? round($cnt / $abandonedCount * 100, 1) : 0.0,
            ];
        }

        $blockByStage = [];
        foreach ($reasonStageCounts as $key => $cnt) {
            [$reason, $stage] = explode('|', $key, 2);
            $stage = (int) $stage;
            $blockByStage[] = [
                'reason' => $reason,
                'label' => FunnelEvent::BLOCK_REASON_LABELS[$reason] ?? $reason,
                'stage' => $stage,
                'stage_label' => FunnelEvent::STAGE_LABELS[$stage] ?? '—',
                'sessions' => $cnt,
            ];
        }
        usort($blockByStage, fn ($a, $b) => $b['sessions'] <=> $a['sessions']);

        $primaryReason = $topBlockReasons[0] ?? null;

        // --- Health Check: שגיאות JS / API לפי עמוד ---
        $errorEvents = $base()
            ->whereNotNull('error_type')
            ->get(['session_id', 'error_type', 'page_key', 'path', 'error_message', 'funnel_stage']);

        $errorAgg = []; // key => stats
        foreach ($errorEvents as $ev) {
            $pageKey = $ev->page_key ?: ($ev->path ?: 'unknown');
            $key = $ev->error_type.'|'.$pageKey;
            if (! isset($errorAgg[$key])) {
                $errorAgg[$key] = [
                    'error_type' => $ev->error_type,
                    'page_key' => $pageKey,
                    'sessions' => [],
                    'not_converted' => [],
                    'sample_message' => null,
                    'sample_count' => [],
                ];
            }
            $sid = (string) $ev->session_id;
            $errorAgg[$key]['sessions'][$sid] = true;
            if (isset($abandoned[$sid])) {
                $errorAgg[$key]['not_converted'][$sid] = true;
            }
            $msg = trim((string) ($ev->error_message ?? ''));
            if ($msg !== '') {
                $errorAgg[$key]['sample_count'][$msg] = ($errorAgg[$key]['sample_count'][$msg] ?? 0) + 1;
            }
        }

        $topErrors = [];
        foreach ($errorAgg as $agg) {
            $sampleMessage = null;
            if ($agg['sample_count'] !== []) {
                arsort($agg['sample_count']);
                $sampleMessage = array_key_first($agg['sample_count']);
            }
            $topErrors[] = [
                'error_type' => $agg['error_type'],
                'page_key' => $agg['page_key'],
                'sessions' => count($agg['sessions']),
                'sessions_abandoned' => count($agg['not_converted']),
                'sample_message' => $sampleMessage,
            ];
        }
        usort($topErrors, fn ($a, $b) => $b['sessions'] <=> $a['sessions']);
        $topErrors = array_slice($topErrors, 0, 20);

        // --- זמן בכל שלב (dwell) ---
        $timePerStage = $this->computeTimePerStage($base());

        // --- פילוח לפי מכשיר / מערכת הפעלה ---
        $byDevice = $this->breakdownBy($sessionRows, 'device', $furthestBySession);
        $byOs = $this->breakdownBy($sessionRows, 'os', $furthestBySession);

        // --- פילוח לפי מסעדה (רק כשאין סינון מסעדה) ---
        $byRestaurant = null;
        if (! $restaurantId) {
            $byRestaurant = $this->breakdownByRestaurant($base());
        }

        return response()->json([
            'success' => true,
            'data' => [
                'since' => $window['since']->toIso8601String(),
                'until' => $window['until']->toIso8601String(),
                'period' => $window['period'],
                'days' => $window['days'],
                'restaurant_id' => $restaurantId,
                'device' => $device,
                'totals' => $totals,
                'funnel' => $funnel,
                'primary_reason' => $primaryReason,
                'silent_abandon' => [
                    'sessions' => $silentAbandon,
                    'pct_of_abandoned' => $abandonedCount > 0 ? round($silentAbandon / $abandonedCount * 100, 1) : 0.0,
                ],
                'top_block_reasons' => $topBlockReasons,
                'block_by_stage' => array_slice($blockByStage, 0, 12),
                'top_errors' => $topErrors,
                'time_per_stage' => $timePerStage,
                'by_device' => $byDevice,
                'by_os' => $byOs,
                'by_restaurant' => $byRestaurant,
            ],
        ]);
    }

    /**
     * GET /super-admin/funnel/restaurants — רשימת מסעדות עם נתוני משפך (לסינון)
     */
    public function restaurants(Request $request)
    {
        $user = $request->user();
        if (! $user?->is_super_admin) {
            return response()->json(['success' => false, 'message' => 'לא מורשה'], 403);
        }

        $rows = FunnelEvent::query()
            ->where('created_at', '>=', Carbon::now()->subDays(90))
            ->whereNotNull('restaurant_id')
            ->selectRaw('restaurant_id, MAX(restaurant_name) as restaurant_name, COUNT(*) as events')
            ->groupBy('restaurant_id')
            ->orderByDesc('events')
            ->get()
            ->map(fn ($r) => [
                'restaurant_id' => (int) $r->restaurant_id,
                'restaurant_name' => $r->restaurant_name ?: ('מסעדה #'.$r->restaurant_id),
            ])
            ->values()
            ->all();

        return response()->json(['success' => true, 'data' => $rows]);
    }

    /**
     * @param  array<string, int>  $furthestBySession
     */
    private function countAtLeast(array $furthestBySession, int $stage): int
    {
        $c = 0;
        foreach ($furthestBySession as $furthest) {
            if ($furthest >= $stage) {
                $c++;
            }
        }

        return $c;
    }

    /**
     * זמן ממוצע/חציוני בכל שלב — מחושב מהפרשי occurred_at של כל session.
     */
    private function computeTimePerStage($query): array
    {
        $rows = $query
            ->where('funnel_stage', '>=', FunnelEvent::STAGE_MENU_VIEW)
            ->where('funnel_stage', '<=', FunnelEvent::STAGE_PAYMENT_SUCCESS)
            ->whereNotNull('occurred_at')
            ->orderBy('occurred_at')
            ->orderBy('id')
            ->get(['session_id', 'funnel_stage', 'occurred_at']);

        // session => [stage => first epoch seconds]
        $firstAt = [];
        foreach ($rows as $r) {
            $sid = (string) $r->session_id;
            $stage = (int) $r->funnel_stage;
            $ts = $r->occurred_at ? $r->occurred_at->getTimestamp() : null;
            if ($ts === null) {
                continue;
            }
            if (! isset($firstAt[$sid][$stage])) {
                $firstAt[$sid][$stage] = $ts;
            }
        }

        // אוסף זמני שהייה לכל שלב (מעבר משלב N לשלב הבא הקיים)
        $gaps = []; // stage => [seconds...]
        foreach ($firstAt as $stages) {
            ksort($stages);
            $entries = array_keys($stages);
            for ($i = 0; $i < count($entries) - 1; $i++) {
                $stage = $entries[$i];
                $nextStage = $entries[$i + 1];
                $gap = $stages[$nextStage] - $stages[$stage];
                if ($gap >= 0 && $gap <= self::MAX_STAGE_GAP_SECONDS) {
                    $gaps[$stage][] = $gap;
                }
            }
        }

        $out = [];
        for ($stage = FunnelEvent::STAGE_MENU_VIEW; $stage < FunnelEvent::STAGE_PAYMENT_SUCCESS; $stage++) {
            $list = $gaps[$stage] ?? [];
            if ($list === []) {
                continue;
            }
            sort($list);
            $count = count($list);
            $avg = array_sum($list) / $count;
            $median = $count % 2 === 1
                ? $list[intdiv($count, 2)]
                : ($list[$count / 2 - 1] + $list[$count / 2]) / 2;
            $out[] = [
                'stage' => $stage,
                'label' => FunnelEvent::STAGE_LABELS[$stage] ?? (string) $stage,
                'avg_seconds' => round($avg, 1),
                'median_seconds' => round($median, 1),
                'samples' => $count,
            ];
        }

        return $out;
    }

    /**
     * פילוח sessions + המרה לפי שדה (device / os).
     *
     * @param  array<string, int>  $furthestBySession
     */
    private function breakdownBy($sessionRows, string $field, array $furthestBySession): array
    {
        $agg = [];
        foreach ($sessionRows as $row) {
            $key = $row->{$field} ?: 'unknown';
            if (! isset($agg[$key])) {
                $agg[$key] = ['sessions' => 0, 'orders' => 0];
            }
            $agg[$key]['sessions']++;
            if ((int) $row->furthest >= FunnelEvent::STAGE_ORDER_CREATED) {
                $agg[$key]['orders']++;
            }
        }

        $out = [];
        foreach ($agg as $key => $stats) {
            $out[] = [
                'key' => $key,
                'sessions' => $stats['sessions'],
                'orders' => $stats['orders'],
                'conversion_rate' => $stats['sessions'] > 0 ? round($stats['orders'] / $stats['sessions'] * 100, 1) : 0.0,
            ];
        }
        usort($out, fn ($a, $b) => $b['sessions'] <=> $a['sessions']);

        return $out;
    }

    private function breakdownByRestaurant($query): array
    {
        $rows = $query
            ->selectRaw('restaurant_id, MAX(restaurant_name) as restaurant_name, session_id, MAX(funnel_stage) as furthest')
            ->groupBy('restaurant_id', 'session_id')
            ->get();

        $agg = [];
        foreach ($rows as $r) {
            $rid = $r->restaurant_id !== null ? (int) $r->restaurant_id : 0;
            if (! isset($agg[$rid])) {
                $agg[$rid] = [
                    'restaurant_id' => $rid ?: null,
                    'restaurant_name' => $r->restaurant_name ?: ($rid ? 'מסעדה #'.$rid : 'לא משויך'),
                    'sessions' => 0,
                    'orders' => 0,
                ];
            }
            $agg[$rid]['sessions']++;
            if ((int) $r->furthest >= FunnelEvent::STAGE_ORDER_CREATED) {
                $agg[$rid]['orders']++;
            }
            if ($r->restaurant_name) {
                $agg[$rid]['restaurant_name'] = $r->restaurant_name;
            }
        }

        $out = array_map(function ($a) {
            $a['conversion_rate'] = $a['sessions'] > 0 ? round($a['orders'] / $a['sessions'] * 100, 1) : 0.0;

            return $a;
        }, array_values($agg));

        usort($out, fn ($a, $b) => $b['sessions'] <=> $a['sessions']);

        return array_slice($out, 0, 50);
    }

    /**
     * @return array{period: string, since: Carbon, until: Carbon, days: int|null}
     */
    private function resolveWindow(Request $request): array
    {
        $period = (string) $request->query('period', '');
        if ($period === 'today') {
            return ['period' => 'today', 'since' => Carbon::today(), 'until' => Carbon::now(), 'days' => null];
        }
        if ($period === 'month') {
            return ['period' => 'month', 'since' => Carbon::now()->startOfMonth(), 'until' => Carbon::now(), 'days' => null];
        }

        $days = min(90, max(1, (int) $request->query('days', 7)));

        return [
            'period' => 'days',
            'since' => Carbon::now()->subDays($days)->startOfDay(),
            'until' => Carbon::now(),
            'days' => $days,
        ];
    }
}

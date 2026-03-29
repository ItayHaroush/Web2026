<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use App\Models\PageVisit;
use App\Models\User;
use App\Services\PhoneValidationService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;

class SuperAdminAnalyticsController extends Controller
{
    private const VISITOR_FILTER_MODES = ['all', 'exclude_owner', 'owner_only'];

    private const MAX_FOCUS_IDS = 8;

    private const SUPER_ADMIN_PAGE_KEYS = [
        'super_admin_dashboard',
        'super_admin_notification_center',
        'super_admin_reports',
        'super_admin_invoices',
        'super_admin_manual_billing',
        'super_admin_settings',
        'super_admin_regional_settings',
        'super_admin_billing_settings',
        'super_admin_security_settings',
        'super_admin_notification_settings',
        'super_admin_policy_settings',
        'super_admin_database',
        'super_admin_order_debug',
        'super_admin_debug_auth',
        'super_admin_abandoned_carts',
        'super_admin_customers',
        'super_admin_customer_detail',
        'super_admin_email_management',
        'super_admin_analytics',
        'super_admin_profile',
    ];

    /**
     * POST /super-admin/analytics/page-view
     */
    public function record(Request $request)
    {
        $user = $request->user();
        if (! $user?->is_super_admin) {
            return response()->json(['success' => false, 'message' => 'לא מורשה'], 403);
        }

        $validated = $request->validate([
            'page_key' => 'required|string|max:64',
            'visitor_uuid' => 'nullable|uuid',
            'path' => 'nullable|string|max:512',
            'referrer' => 'nullable|string|max:512',
        ]);

        if (! in_array($validated['page_key'], self::SUPER_ADMIN_PAGE_KEYS, true)) {
            return response()->json(['success' => false, 'message' => 'page_key לא חוקי'], 422);
        }

        PageVisit::create([
            'page_key' => $validated['page_key'],
            'tenant_id' => null,
            'restaurant_id' => null,
            'restaurant_name' => null,
            'visitor_uuid' => $validated['visitor_uuid'] ?? null,
            'customer_id' => null,
            'visitor_kind' => PageVisit::KIND_ADMIN,
            'visitor_display_hint' => null,
            'admin_user_id' => $user->id,
            'path' => $validated['path'] ?? null,
            'referrer' => $validated['referrer'] ?? null,
        ]);

        return response()->json(['success' => true]);
    }

    /**
     * GET /super-admin/analytics/entity-suggestions?query=...
     */
    public function entitySuggestions(Request $request)
    {
        $user = $request->user();
        if (! $user?->is_super_admin) {
            return response()->json(['success' => false, 'message' => 'לא מורשה'], 403);
        }

        $q = trim((string) $request->query('query', ''));
        if (mb_strlen($q) < 2) {
            return response()->json([
                'success' => true,
                'data' => ['users' => [], 'customers' => []],
            ]);
        }

        $like = '%'.addcslashes($q, '%_\\').'%';

        $users = User::query()
            ->where(function ($w) use ($like) {
                $w->where('email', 'like', $like)
                    ->orWhere('name', 'like', $like);
            })
            ->orderBy('id')
            ->limit(12)
            ->get(['id', 'name', 'email'])
            ->map(fn ($u) => [
                'type' => 'admin',
                'id' => $u->id,
                'label' => trim((string) ($u->name ?? '')) !== '' ? trim((string) $u->name) : $this->maskEmail((string) $u->email),
                'sub' => $this->maskEmail((string) $u->email),
            ])
            ->values()
            ->all();

        $customers = Customer::query()
            ->where(function ($w) use ($like) {
                $w->where('phone', 'like', $like)
                    ->orWhere('name', 'like', $like)
                    ->orWhere('email', 'like', $like);
            })
            ->orderBy('id')
            ->limit(12)
            ->get(['id', 'name', 'phone', 'email'])
            ->map(fn ($c) => [
                'type' => 'customer',
                'id' => $c->id,
                'label' => trim((string) ($c->name ?? '')) !== '' ? trim((string) $c->name) : 'לקוח #'.$c->id,
                'sub' => $this->maskPhone($c->phone ?? '').(trim((string) ($c->email ?? '')) !== '' ? ' · '.$this->maskEmail((string) $c->email) : ''),
            ])
            ->values()
            ->all();

        return response()->json([
            'success' => true,
            'data' => [
                'users' => $users,
                'customers' => $customers,
            ],
        ]);
    }

    /**
     * GET /super-admin/analytics/summary?days=7&visitor_filter=all|exclude_owner|owner_only
     */
    public function summary(Request $request)
    {
        $window = $this->resolveAnalyticsWindow($request);
        $since = $window['since'];
        $until = $window['until'];
        $mode = $this->visitorFilterMode($request);
        $ownerId = $this->resolvePlatformOwnerId();
        $ownerCustomerId = $this->resolvePlatformOwnerCustomerId();
        $ownerEmail = trim((string) config('platform.owner_email', ''));
        $ownerPhoneRaw = trim((string) config('platform.owner_customer_phone', ''));
        [$focusAdmins, $focusCustomers] = $this->parseFocusEntityIds($request);

        $base = PageVisit::query()
            ->where('created_at', '>=', $since)
            ->where('created_at', '<=', $until);
        $this->applyOwnerVisitorScope($base, $mode, $ownerId, $ownerCustomerId);
        $this->applyFocusEntityScope($base, $focusAdmins, $focusCustomers);

        $total = (clone $base)->count();

        $byPage = (clone $base)
            ->selectRaw('page_key, COUNT(*) as c')
            ->groupBy('page_key')
            ->orderByDesc('c')
            ->pluck('c', 'page_key')
            ->all();

        $byKind = (clone $base)
            ->selectRaw('visitor_kind, COUNT(*) as c')
            ->groupBy('visitor_kind')
            ->orderByDesc('c')
            ->pluck('c', 'visitor_kind')
            ->all();

        $uniqueVisitors = (int) (clone $base)->whereNotNull('visitor_uuid')->selectRaw('COUNT(DISTINCT visitor_uuid) as c')->value('c');
        $uniqueCustomers = (int) (clone $base)->whereNotNull('customer_id')->selectRaw('COUNT(DISTINCT customer_id) as c')->value('c');
        $uniqueAdmins = (int) (clone $base)->whereNotNull('admin_user_id')->selectRaw('COUNT(DISTINCT admin_user_id) as c')->value('c');

        $menuVisits = (int) (clone $base)->where('page_key', 'menu')->count();
        $menuDistinctRestaurants = (int) (clone $base)->where('page_key', 'menu')->whereNotNull('restaurant_id')->selectRaw('COUNT(DISTINCT restaurant_id) as c')->value('c');

        $adminVisitSplit = null;
        if ($ownerId !== null) {
            $adminVisitSplit = [
                'platform_owner' => (int) (clone $base)
                    ->where('visitor_kind', PageVisit::KIND_ADMIN)
                    ->where('admin_user_id', $ownerId)
                    ->count(),
                'other_admins' => (int) (clone $base)
                    ->where('visitor_kind', PageVisit::KIND_ADMIN)
                    ->where(function ($q) use ($ownerId) {
                        $q->whereNull('admin_user_id')->orWhere('admin_user_id', '!=', $ownerId);
                    })
                    ->count(),
            ];
        }

        $registeredVisitSplit = null;
        if ($ownerCustomerId !== null) {
            $registeredVisitSplit = [
                'platform_owner' => (int) (clone $base)
                    ->where('visitor_kind', PageVisit::KIND_CUSTOMER_REGISTERED)
                    ->where('customer_id', $ownerCustomerId)
                    ->count(),
                'other_registered' => (int) (clone $base)
                    ->where('visitor_kind', PageVisit::KIND_CUSTOMER_REGISTERED)
                    ->where(function ($q) use ($ownerCustomerId) {
                        $q->whereNull('customer_id')->orWhere('customer_id', '!=', $ownerCustomerId);
                    })
                    ->count(),
            ];
        }

        $ownerUser = $ownerId ? User::query()->find($ownerId) : null;
        $ownerPhoneE164 = $ownerPhoneRaw !== '' ? PhoneValidationService::normalizeIsraeliMobileE164($ownerPhoneRaw) : null;

        $byHour = $this->aggregateVisitsByHour(clone $base, DB::getDriverName());

        $compareYesterday = null;
        if ($window['period'] === 'today') {
            $todayStart = Carbon::today();
            $elapsed = max(1, $todayStart->diffInSeconds($until));
            $yStart = Carbon::yesterday()->startOfDay();
            $yEnd = $yStart->copy()->addSeconds($elapsed);
            $baseY = PageVisit::query()
                ->where('created_at', '>=', $yStart)
                ->where('created_at', '<=', $yEnd);
            $this->applyOwnerVisitorScope($baseY, $mode, $ownerId, $ownerCustomerId);
            $this->applyFocusEntityScope($baseY, $focusAdmins, $focusCustomers);
            $yTotal = (clone $baseY)->count();
            $compareYesterday = [
                'total_today' => $total,
                'total_yesterday_same_window' => $yTotal,
                'delta' => $total - $yTotal,
            ];
        }

        return response()->json([
            'success' => true,
            'data' => [
                'since' => $since->toIso8601String(),
                'until' => $until->toIso8601String(),
                'period' => $window['period'],
                'days' => $window['days'],
                'focus_admin_ids' => $focusAdmins,
                'focus_customer_ids' => $focusCustomers,
                'visitor_filter' => $mode,
                'by_hour' => $byHour,
                'compare_yesterday' => $compareYesterday,
                'platform_owner' => [
                    'email_configured' => $ownerEmail !== '',
                    'email_masked' => $ownerEmail !== '' ? $this->maskEmail($ownerEmail) : null,
                    'user_resolved' => $ownerId !== null,
                    'user_id' => $ownerId,
                    'email_in_db_masked' => $ownerUser ? $this->maskEmail((string) $ownerUser->email) : null,
                    'customer_phone_configured' => $ownerPhoneRaw !== '',
                    'customer_phone_masked' => $ownerPhoneE164 ? $this->maskPhone($ownerPhoneE164) : ($ownerPhoneRaw !== '' ? $this->maskPhone($ownerPhoneRaw) : null),
                    'customer_resolved' => $ownerCustomerId !== null,
                    'customer_id' => $ownerCustomerId,
                ],
                'admin_visit_split' => $adminVisitSplit,
                'registered_visit_split' => $registeredVisitSplit,
                'total_visits' => $total,
                'unique_visitor_uuids' => $uniqueVisitors,
                'unique_customer_ids' => $uniqueCustomers,
                'unique_admin_user_ids' => $uniqueAdmins,
                'by_page_key' => $byPage,
                'by_visitor_kind' => $byKind,
                'menu_visits' => $menuVisits,
                'menu_distinct_restaurants' => $menuDistinctRestaurants,
            ],
        ]);
    }

    /**
     * GET /super-admin/analytics/menu-insights?days=7&limit_recent=80&visitor_filter=...
     */
    public function menuInsights(Request $request)
    {
        $window = $this->resolveAnalyticsWindow($request);
        $since = $window['since'];
        $until = $window['until'];
        $limitRecent = min(200, max(10, (int) $request->query('limit_recent', 80)));
        $mode = $this->visitorFilterMode($request);
        $ownerId = $this->resolvePlatformOwnerId();
        $ownerCustomerId = $this->resolvePlatformOwnerCustomerId();
        [$focusAdmins, $focusCustomers] = $this->parseFocusEntityIds($request);

        $recentRows = PageVisit::query()
            ->where('created_at', '>=', $since)
            ->where('created_at', '<=', $until)
            ->where('page_key', 'menu');
        $this->applyOwnerVisitorScope($recentRows, $mode, $ownerId, $ownerCustomerId);
        $this->applyFocusEntityScope($recentRows, $focusAdmins, $focusCustomers);
        $recentRows = $recentRows
            ->orderByDesc('id')
            ->limit($limitRecent)
            ->get([
                'id', 'created_at', 'tenant_id', 'restaurant_id', 'restaurant_name',
                'visitor_uuid', 'customer_id', 'visitor_kind', 'visitor_display_hint', 'path',
            ]);

        $customerIds = $recentRows->pluck('customer_id')->filter()->unique()->values()->all();
        $customers = collect();
        if ($customerIds !== []) {
            $customers = Customer::whereIn('id', $customerIds)->get(['id', 'name', 'phone'])->keyBy('id');
        }

        $recent = $recentRows->map(function ($v) use ($customers) {
            $uuid = (string) ($v->visitor_uuid ?? '');
            $uuidShort = $uuid !== '' ? substr($uuid, 0, 8) : null;
            $row = [
                'id' => $v->id,
                'created_at' => $v->created_at?->toIso8601String(),
                'tenant_id' => $v->tenant_id,
                'restaurant_id' => $v->restaurant_id,
                'restaurant_name' => $v->restaurant_name,
                'visitor_kind' => $v->visitor_kind,
                'visitor_uuid_short' => $uuidShort,
                'visitor_display_hint' => $v->visitor_display_hint,
                'path' => $v->path,
                'customer_id' => $v->customer_id,
                'customer_name' => null,
                'customer_phone_masked' => null,
                'detail_label' => '',
            ];
            if ($v->customer_id && $customers->has($v->customer_id)) {
                $c = $customers->get($v->customer_id);
                $masked = $this->maskPhone($c->phone ?? '');
                $row['customer_name'] = $c->name;
                $row['customer_phone_masked'] = $masked;
                $nm = trim((string) ($c->name ?? ''));
                $row['detail_label'] = ($nm !== '' ? $nm : 'לקוח').' (# '.$v->customer_id.') · '.$masked;
            } elseif ($v->visitor_display_hint) {
                $row['detail_label'] = trim((string) $v->visitor_display_hint).' · UUID …'.$uuidShort;
            } else {
                $kindHe = match ($v->visitor_kind) {
                    'customer_guest' => 'לקוח (לא רשום)',
                    'customer_registered' => 'לקוח רשום',
                    default => 'אנונימי',
                };
                $row['detail_label'] = 'מבקר '.$kindHe.' · UUID …'.$uuidShort;
            }

            return $row;
        })->values()->all();

        $allMenu = PageVisit::query()
            ->where('created_at', '>=', $since)
            ->where('created_at', '<=', $until)
            ->where('page_key', 'menu');
        $this->applyOwnerVisitorScope($allMenu, $mode, $ownerId, $ownerCustomerId);
        $this->applyFocusEntityScope($allMenu, $focusAdmins, $focusCustomers);
        $allMenu = $allMenu->get(['restaurant_id', 'tenant_id', 'restaurant_name', 'visitor_uuid']);

        $byRestaurant = [];
        foreach ($allMenu as $v) {
            $rid = $v->restaurant_id;
            $key = $rid !== null ? (string) $rid : '_none';
            if (! isset($byRestaurant[$key])) {
                $byRestaurant[$key] = [
                    'restaurant_id' => $rid,
                    'tenant_id' => $v->tenant_id,
                    'restaurant_name' => $v->restaurant_name,
                    'visits' => 0,
                    'unique_visitor_uuids' => [],
                ];
            }
            $byRestaurant[$key]['visits']++;
            if ($v->visitor_uuid) {
                $byRestaurant[$key]['unique_visitor_uuids'][(string) $v->visitor_uuid] = true;
            }
            if ($v->restaurant_name) {
                $byRestaurant[$key]['restaurant_name'] = $v->restaurant_name;
            }
            if ($v->tenant_id) {
                $byRestaurant[$key]['tenant_id'] = $v->tenant_id;
            }
        }

        $byRestaurantList = [];
        foreach ($byRestaurant as $agg) {
            $byRestaurantList[] = [
                'restaurant_id' => $agg['restaurant_id'],
                'tenant_id' => $agg['tenant_id'],
                'restaurant_name' => $agg['restaurant_name'] ?: ($agg['restaurant_id'] === null ? 'לא צוין מסעדה' : null),
                'visits' => $agg['visits'],
                'unique_visitors' => count($agg['unique_visitor_uuids']),
            ];
        }
        usort($byRestaurantList, fn ($a, $b) => $b['visits'] <=> $a['visits']);

        return response()->json([
            'success' => true,
            'data' => [
                'since' => $since->toIso8601String(),
                'until' => $until->toIso8601String(),
                'period' => $window['period'],
                'days' => $window['days'],
                'visitor_filter' => $mode,
                'by_restaurant' => $byRestaurantList,
                'recent_menu_views' => $recent,
            ],
        ]);
    }

    /**
     * GET /super-admin/analytics/top-entities?days=7&limit=40&visitor_filter=...
     */
    public function topEntities(Request $request)
    {
        $window = $this->resolveAnalyticsWindow($request);
        $since = $window['since'];
        $until = $window['until'];
        $limit = min(100, max(5, (int) $request->query('limit', 40)));
        $mode = $this->visitorFilterMode($request);
        $ownerId = $this->resolvePlatformOwnerId();
        $ownerCustomerId = $this->resolvePlatformOwnerCustomerId();
        [$focusAdmins, $focusCustomers] = $this->parseFocusEntityIds($request);

        $driver = DB::getDriverName();
        if ($driver === 'sqlite') {
            $rows = $this->topEntitiesSqlite($since, $until, $limit, $mode, $ownerId, $ownerCustomerId, $focusAdmins, $focusCustomers);
        } else {
            $rows = $this->topEntitiesMysql($since, $until, $limit, $mode, $ownerId, $ownerCustomerId, $focusAdmins, $focusCustomers);
        }

        $adminIds = [];
        foreach ($rows as $r) {
            if (($r['entity_type'] ?? '') === 'admin' && ! empty($r['entity_id'])) {
                $adminIds[] = (int) $r['entity_id'];
            }
        }
        $adminIds = array_values(array_unique($adminIds));
        $adminEmails = [];
        if ($adminIds !== []) {
            $adminEmails = User::whereIn('id', $adminIds)->pluck('email', 'id')->all();
        }

        $customerIds = [];
        foreach ($rows as $r) {
            if (($r['entity_type'] ?? '') === 'customer' && ! empty($r['entity_id'])) {
                $customerIds[] = (int) $r['entity_id'];
            }
        }
        $customerIds = array_values(array_unique($customerIds));
        $customerRows = [];
        if ($customerIds !== []) {
            $customerRows = Customer::whereIn('id', $customerIds)->get(['id', 'name', 'phone'])->keyBy('id')->all();
        }

        foreach ($rows as &$r) {
            if (($r['entity_type'] ?? '') === 'admin' && ! empty($r['entity_id'])) {
                $aid = (int) $r['entity_id'];
                $email = $adminEmails[$aid] ?? '';
                if ($ownerId !== null && $aid === $ownerId) {
                    $r['label'] = 'בעל המערכת · '.$this->maskEmail($email);
                    $r['is_platform_owner'] = true;
                } else {
                    $r['label'] = $this->maskEmail($email);
                    $r['is_platform_owner'] = false;
                }
            } elseif (($r['entity_type'] ?? '') === 'customer' && ! empty($r['entity_id'])) {
                $cid = (int) $r['entity_id'];
                $c = $customerRows[$cid] ?? null;
                if ($c) {
                    $nm = trim((string) ($c->name ?? ''));
                    $masked = $this->maskPhone($c->phone ?? '');
                    $r['label'] = ($nm !== '' ? $nm : 'לקוח').' (# '.$cid.') · '.$masked;
                } else {
                    $r['label'] = 'לקוח # '.$cid;
                }
                if ($ownerCustomerId !== null && $cid === $ownerCustomerId) {
                    $r['label'] = 'בעל המערכת · לקוח רשום · '.$r['label'];
                    $r['is_platform_owner'] = true;
                } else {
                    $r['is_platform_owner'] = false;
                }
            } else {
                $r['label'] = 'מבקר אנונימי …'.substr((string) ($r['entity_id'] ?? ''), 0, 8);
                $r['is_platform_owner'] = false;
            }
        }
        unset($r);

        return response()->json([
            'success' => true,
            'data' => [
                'since' => $since->toIso8601String(),
                'until' => $until->toIso8601String(),
                'period' => $window['period'],
                'days' => $window['days'],
                'visitor_filter' => $mode,
                'rows' => $rows,
            ],
        ]);
    }

    private function topEntitiesMysql(Carbon $since, Carbon $until, int $limit, string $mode, ?int $ownerId, ?int $ownerCustomerId, array $focusAdmins, array $focusCustomers): array
    {
        $expr = "CASE
            WHEN admin_user_id IS NOT NULL THEN CONCAT('admin:', admin_user_id)
            WHEN customer_id IS NOT NULL THEN CONCAT('customer:', customer_id)
            ELSE CONCAT('anon:', visitor_uuid)
        END";

        $q = PageVisit::query()
            ->where('created_at', '>=', $since)
            ->where('created_at', '<=', $until);
        $this->applyOwnerVisitorScope($q, $mode, $ownerId, $ownerCustomerId);
        $this->applyFocusEntityScope($q, $focusAdmins, $focusCustomers);

        return $q
            ->selectRaw("$expr as entity_key")
            ->selectRaw('MAX(visitor_kind) as visitor_kind')
            ->selectRaw('COUNT(*) as visit_count')
            ->groupByRaw($expr)
            ->orderByDesc('visit_count')
            ->limit($limit)
            ->get()
            ->map(function ($row) {
                $key = $row->entity_key;
                [$type, $id] = explode(':', $key, 2);

                return [
                    'entity_type' => $type,
                    'entity_id' => $id,
                    'visitor_kind' => $row->visitor_kind,
                    'visit_count' => (int) $row->visit_count,
                ];
            })
            ->values()
            ->all();
    }

    private function topEntitiesSqlite(Carbon $since, Carbon $until, int $limit, string $mode, ?int $ownerId, ?int $ownerCustomerId, array $focusAdmins, array $focusCustomers): array
    {
        $rawQ = PageVisit::query()
            ->where('created_at', '>=', $since)
            ->where('created_at', '<=', $until);
        $this->applyOwnerVisitorScope($rawQ, $mode, $ownerId, $ownerCustomerId);
        $this->applyFocusEntityScope($rawQ, $focusAdmins, $focusCustomers);
        $raw = $rawQ->select([
            'visitor_kind',
            'admin_user_id',
            'customer_id',
            'visitor_uuid',
        ])
            ->get();

        $counts = [];
        foreach ($raw as $visit) {
            if ($visit->admin_user_id) {
                $k = 'admin:'.$visit->admin_user_id;
            } elseif ($visit->customer_id) {
                $k = 'customer:'.$visit->customer_id;
            } else {
                $k = 'anon:'.($visit->visitor_uuid ?? 'unknown');
            }
            if (! isset($counts[$k])) {
                $counts[$k] = ['visitor_kind' => $visit->visitor_kind, 'n' => 0];
            }
            $counts[$k]['n']++;
        }

        uasort($counts, fn ($a, $b) => $b['n'] <=> $a['n']);
        $counts = array_slice($counts, 0, $limit, true);

        $out = [];
        foreach ($counts as $key => $meta) {
            [$type, $id] = explode(':', $key, 2);
            $out[] = [
                'entity_type' => $type,
                'entity_id' => $id,
                'visitor_kind' => $meta['visitor_kind'],
                'visit_count' => $meta['n'],
            ];
        }

        return $out;
    }

    private function maskEmail(string $email): string
    {
        if ($email === '' || ! str_contains($email, '@')) {
            return 'מנהל';
        }
        [$local, $domain] = explode('@', $email, 2);
        $keep = max(1, min(3, strlen($local)));
        $masked = substr($local, 0, $keep).'***@'.$domain;

        return $masked;
    }

    private function maskPhone(?string $phone): string
    {
        if ($phone === null || $phone === '') {
            return '—';
        }
        $digits = preg_replace('/\D+/', '', $phone) ?? '';
        if (strlen($digits) < 4) {
            return '***';
        }

        return '***'.substr($digits, -4);
    }


    /**
     * @param  \Illuminate\Database\Eloquent\Builder<\App\Models\PageVisit>  $base
     * @return list<array{hour: int, count: int}>
     */
    private function aggregateVisitsByHour($base, string $driver): array
    {
        $q = clone $base;
        if ($driver === 'sqlite') {
            $rows = (clone $q)
                ->selectRaw("cast(strftime('%H', created_at) as integer) as h")
                ->selectRaw('count(*) as c')
                ->groupBy('h')
                ->orderBy('h')
                ->get();
        } else {
            $rows = (clone $q)
                ->selectRaw('HOUR(created_at) as h')
                ->selectRaw('count(*) as c')
                ->groupBy('h')
                ->orderBy('h')
                ->get();
        }

        $map = array_fill(0, 24, 0);
        foreach ($rows as $row) {
            $h = (int) $row->h;
            if ($h >= 0 && $h <= 23) {
                $map[$h] = (int) $row->c;
            }
        }

        $out = [];
        for ($h = 0; $h < 24; $h++) {
            $out[] = ['hour' => $h, 'count' => $map[$h]];
        }

        return $out;
    }

    /**
     * @return array{period: string, since: Carbon, until: Carbon, days: int|null}
     */
    private function resolveAnalyticsWindow(Request $request): array
    {
        $period = (string) $request->query('period', '');
        if ($period === 'today') {
            return [
                'period' => 'today',
                'since' => Carbon::today(),
                'until' => Carbon::now(),
                'days' => null,
            ];
        }

        $days = min(90, max(1, (int) $request->query('days', 7)));

        return [
            'period' => 'days',
            'since' => Carbon::now()->subDays($days)->startOfDay(),
            'until' => Carbon::now(),
            'days' => $days,
        ];
    }

    /**
     * @return array{0: list<int>, 1: list<int>}
     */
    private function parseFocusEntityIds(Request $request): array
    {
        $adminRaw = $request->query('focus_admin_ids', []);
        $custRaw = $request->query('focus_customer_ids', []);

        $adminIds = $this->normalizeIdList($adminRaw);
        $customerIds = $this->normalizeIdList($custRaw);

        if ($adminIds !== []) {
            $adminIds = User::query()->whereIn('id', $adminIds)->pluck('id')->map(fn ($id) => (int) $id)->all();
        }
        if ($customerIds !== []) {
            $customerIds = Customer::query()->whereIn('id', $customerIds)->pluck('id')->map(fn ($id) => (int) $id)->all();
        }

        return [$adminIds, $customerIds];
    }

    /**
     * @param  mixed  $raw
     * @return list<int>
     */
    private function normalizeIdList($raw): array
    {
        $items = Arr::wrap($raw);
        $flat = [];
        foreach ($items as $item) {
            if (is_string($item) && str_contains($item, ',')) {
                foreach (explode(',', $item) as $part) {
                    $flat[] = trim($part);
                }
            } else {
                $flat[] = $item;
            }
        }

        $ids = [];
        foreach ($flat as $x) {
            $n = (int) $x;
            if ($n > 0) {
                $ids[] = $n;
            }
        }

        return array_values(array_unique(array_slice($ids, 0, self::MAX_FOCUS_IDS)));
    }

    /**
     * @param  \Illuminate\Database\Eloquent\Builder<\App\Models\PageVisit>  $query
     * @param  list<int>  $focusAdminIds
     * @param  list<int>  $focusCustomerIds
     */
    private function applyFocusEntityScope($query, array $focusAdminIds, array $focusCustomerIds): void
    {
        if ($focusAdminIds === [] && $focusCustomerIds === []) {
            return;
        }
        if ($focusAdminIds !== [] && $focusCustomerIds !== []) {
            $query->where(function ($q) use ($focusAdminIds, $focusCustomerIds) {
                $q->whereIn('admin_user_id', $focusAdminIds)
                    ->orWhereIn('customer_id', $focusCustomerIds);
            });

            return;
        }
        if ($focusAdminIds !== []) {
            $query->whereIn('admin_user_id', $focusAdminIds);

            return;
        }
        $query->whereIn('customer_id', $focusCustomerIds);
    }

    private function visitorFilterMode(Request $request): string
    {
        $m = (string) $request->query('visitor_filter', 'all');

        return in_array($m, self::VISITOR_FILTER_MODES, true) ? $m : 'all';
    }

    private function resolvePlatformOwnerId(): ?int
    {
        $email = trim((string) config('platform.owner_email', ''));
        if ($email === '') {
            return null;
        }

        return User::query()->where('email', $email)->value('id');
    }

    private function resolvePlatformOwnerCustomerId(): ?int
    {
        $raw = trim((string) config('platform.owner_customer_phone', ''));
        if ($raw === '') {
            return null;
        }
        $e164 = PhoneValidationService::normalizeIsraeliMobileE164($raw);
        if ($e164 === null) {
            return null;
        }

        return Customer::query()->where('phone', $e164)->value('id');
    }

    /**
     * @param  \Illuminate\Database\Eloquent\Builder<\App\Models\PageVisit>  $query
     */
    private function applyOwnerVisitorScope($query, string $mode, ?int $ownerUserId, ?int $ownerCustomerId): void
    {
        if ($mode === 'all') {
            return;
        }
        if ($ownerUserId === null && $ownerCustomerId === null) {
            return;
        }
        if ($mode === 'exclude_owner') {
            $query->where(function ($outer) use ($ownerUserId, $ownerCustomerId) {
                $outer->where(function ($q) use ($ownerUserId) {
                    if ($ownerUserId === null) {
                        $q->whereRaw('1 = 1');
                    } else {
                        $q->whereNull('admin_user_id')->orWhere('admin_user_id', '!=', $ownerUserId);
                    }
                })->where(function ($q) use ($ownerCustomerId) {
                    if ($ownerCustomerId === null) {
                        $q->whereRaw('1 = 1');
                    } else {
                        $q->whereNull('customer_id')->orWhere('customer_id', '!=', $ownerCustomerId);
                    }
                });
            });

            return;
        }
        if ($mode === 'owner_only') {
            $query->where(function ($q) use ($ownerUserId, $ownerCustomerId) {
                if ($ownerUserId !== null && $ownerCustomerId !== null) {
                    $q->where('admin_user_id', $ownerUserId)->orWhere('customer_id', $ownerCustomerId);
                } elseif ($ownerUserId !== null) {
                    $q->where('admin_user_id', $ownerUserId);
                } else {
                    $q->where('customer_id', $ownerCustomerId);
                }
            });
        }
    }
}

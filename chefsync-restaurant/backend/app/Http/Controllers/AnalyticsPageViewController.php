<?php

namespace App\Http\Controllers;

use App\Models\PageVisit;
use App\Models\Restaurant;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class AnalyticsPageViewController extends Controller
{
    /** כניסות ציבוריות (לקוח / PWA) */
    private const PUBLIC_PAGE_KEYS = [
        'home',
        'landing',
        'register_restaurant',
        'menu',
        'cart',
        'restaurant_share',
        'kiosk',
        'screen',
        'order_status',
        'my_orders',
        'verify_email',
        'payment_callback',
        'legal_privacy',
        'legal_terms_end_user',
        'legal_terms_restaurant',
    ];

    /** כניסות פאנל מנהל מסעדה */
    private const RESTAURANT_ADMIN_PAGE_KEYS = [
        'admin_dashboard',
        'admin_orders',
        'admin_menu_management',
        'admin_restaurant',
        'admin_employees',
        'admin_payment_settings',
        'admin_preview_menu',
        'admin_preview_cart',
        'admin_preview_order_status',
        'admin_delivery_zones',
        'admin_paywall',
        'admin_payment_demo',
        'admin_terminal',
        'admin_coupons',
        'admin_devices',
        'admin_simulator',
        'admin_qr_code',
        'admin_reports_center',
        'admin_pos',
        'admin_auth_debug',
        'admin_settings_hub',
        'admin_user_settings',
        'admin_abandoned_cart_reminders',
        'admin_payment_success',
        'admin_payment_error',
    ];

    /**
     * POST /api/analytics/page-view — ציבורי, מוגבל קצב
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'page_key' => 'required|string|max:64',
            'tenant_id' => 'nullable|string|max:64',
            'visitor_uuid' => 'required|uuid',
            'customer_id' => 'nullable|integer',
            'visitor_kind' => 'required|string|in:anonymous,customer_guest,customer_registered',
            'visitor_display_hint' => 'nullable|string|max:120',
            'path' => 'nullable|string|max:512',
            'referrer' => 'nullable|string|max:512',
        ]);

        if (! in_array($validated['page_key'], self::PUBLIC_PAGE_KEYS, true)) {
            return response()->json(['success' => false, 'message' => 'page_key לא חוקי'], 422);
        }

        $tenantId = $validated['tenant_id'] ?? $request->header('X-Tenant-ID');
        $tenantId = is_string($tenantId) && $tenantId !== '' ? $tenantId : null;

        $snapshot = $this->resolveRestaurantSnapshot($tenantId);
        $hint = isset($validated['visitor_display_hint']) ? trim((string) $validated['visitor_display_hint']) : '';
        $hint = $hint !== '' ? mb_substr($hint, 0, 120) : null;

        PageVisit::create([
            'page_key' => $validated['page_key'],
            'tenant_id' => $tenantId,
            'restaurant_id' => $snapshot['id'],
            'restaurant_name' => $snapshot['name'],
            'visitor_uuid' => $validated['visitor_uuid'],
            'customer_id' => $validated['customer_id'] ?? null,
            'visitor_kind' => $validated['visitor_kind'],
            'visitor_display_hint' => $hint,
            'admin_user_id' => null,
            'path' => $validated['path'] ?? null,
            'referrer' => $validated['referrer'] ?? null,
        ]);

        return response()->json(['success' => true]);
    }

    /**
     * POST /api/admin/analytics/page-view — מנהל מסעדה (מאומת + tenant)
     */
    public function storeRestaurantAdmin(Request $request)
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['success' => false, 'message' => 'לא מורשה'], 403);
        }

        $validated = $request->validate([
            'page_key' => 'required|string|max:64',
            'visitor_uuid' => 'nullable|uuid',
            'path' => 'nullable|string|max:512',
            'referrer' => 'nullable|string|max:512',
        ]);

        if (! in_array($validated['page_key'], self::RESTAURANT_ADMIN_PAGE_KEYS, true)) {
            return response()->json(['success' => false, 'message' => 'page_key לא חוקי'], 422);
        }

        $tenantId = app('tenant_id');
        $restaurantId = $user->restaurant_id ?? $this->resolveRestaurantSnapshot($tenantId)['id'];
        $restaurantName = null;
        if ($restaurantId) {
            $restaurantName = Restaurant::withoutGlobalScope('tenant')->where('id', $restaurantId)->value('name');
        }
        if ($restaurantName === null && $tenantId) {
            $restaurantName = $this->resolveRestaurantSnapshot($tenantId)['name'];
        }

        $visitorUuid = $validated['visitor_uuid'] ?? null;
        if (! $visitorUuid && $request->hasHeader('X-Visitor-UUID')) {
            $raw = (string) $request->header('X-Visitor-UUID');
            $visitorUuid = Str::isUuid($raw) ? $raw : null;
        }

        PageVisit::create([
            'page_key' => $validated['page_key'],
            'tenant_id' => $tenantId,
            'restaurant_id' => $restaurantId,
            'restaurant_name' => $restaurantName,
            'visitor_uuid' => $visitorUuid,
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
}

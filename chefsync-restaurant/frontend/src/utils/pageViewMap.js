const RESERVED = new Set(['admin', 'super-admin']);

function tenantLikeSegment(seg) {
    return seg && !RESERVED.has(seg.toLowerCase());
}

/**
 * דפי לקוח / ציבור — לא כולל /admin או /super-admin
 */
export function resolvePublicPageKey(pathname) {
    const p = pathname || '';
    if (p.startsWith('/admin') || p.startsWith('/super-admin')) {
        return null;
    }

    if (p === '/' || p === '') return 'home';
    if (p === '/landing') return 'landing';
    if (p === '/register-restaurant') return 'register_restaurant';
    if (p === '/menu') return 'menu';
    if (p === '/cart') return 'cart';
    if (p.startsWith('/order-status/')) return 'order_status';
    if (p === '/my-orders') return 'my_orders';
    if (p === '/verify-email') return 'verify_email';
    if (p.startsWith('/payment/')) return 'payment_callback';
    if (p.startsWith('/legal/privacy')) return 'legal_privacy';
    if (p.startsWith('/legal/end-user')) return 'legal_terms_end_user';
    if (p.startsWith('/legal/restaurant')) return 'legal_terms_restaurant';

    const m = p.match(/^\/([^/]+)\/(menu|cart|order-status)\/?/);
    if (m && tenantLikeSegment(m[1])) {
        if (m[2] === 'menu') return 'menu';
        if (m[2] === 'cart') return 'cart';
        if (m[2] === 'order-status') return 'order_status';
    }

    if (p.startsWith('/r/')) return 'restaurant_share';
    if (p.startsWith('/kiosk/')) return 'kiosk';
    if (p.startsWith('/screen/')) return 'screen';

    return null;
}

const ADMIN_RULES = [
    [/^\/admin\/dashboard\/?$/, 'admin_dashboard'],
    [/^\/admin\/orders\/?$/, 'admin_orders'],
    [/^\/admin\/menu-management\/?$/, 'admin_menu_management'],
    [/^\/admin\/restaurant\/?$/, 'admin_restaurant'],
    [/^\/admin\/employees\/?$/, 'admin_employees'],
    [/^\/admin\/payment-settings\/?$/, 'admin_payment_settings'],
    [/^\/admin\/preview-menu\/?$/, 'admin_preview_menu'],
    [/^\/admin\/preview-cart\/?$/, 'admin_preview_cart'],
    [/^\/admin\/preview-order-status\//, 'admin_preview_order_status'],
    [/^\/admin\/delivery-zones\/?$/, 'admin_delivery_zones'],
    [/^\/admin\/paywall\/?$/, 'admin_paywall'],
    [/^\/admin\/payment\/?$/, 'admin_payment_demo'],
    [/^\/admin\/payment\/success\/?$/, 'admin_payment_success'],
    [/^\/admin\/payment\/error\/?$/, 'admin_payment_error'],
    [/^\/admin\/terminal\/?$/, 'admin_terminal'],
    [/^\/admin\/coupons\/?$/, 'admin_coupons'],
    [/^\/admin\/devices\/?$/, 'admin_devices'],
    [/^\/admin\/simulator\/?$/, 'admin_simulator'],
    [/^\/admin\/qr-code\/?$/, 'admin_qr_code'],
    [/^\/admin\/reports-center\/?$/, 'admin_reports_center'],
    [/^\/admin\/pos\/?$/, 'admin_pos'],
    [/^\/admin\/auth-debug\/?$/, 'admin_auth_debug'],
    [/^\/admin\/settings-hub\/?$/, 'admin_settings_hub'],
    [/^\/admin\/settings\/?$/, 'admin_user_settings'],
    [/^\/admin\/abandoned-cart-reminders\/?$/, 'admin_abandoned_cart_reminders'],
];

export function resolveRestaurantAdminPageKey(pathname) {
    const p = pathname || '';
    if (!p.startsWith('/admin')) return null;
    for (const [re, key] of ADMIN_RULES) {
        if (re.test(p)) return key;
    }
    return null;
}

const SUPER_RULES = [
    [/^\/super-admin\/dashboard\/?$/, 'super_admin_dashboard'],
    [/^\/super-admin\/notification-center\/?$/, 'super_admin_notification_center'],
    [/^\/super-admin\/reports\/?$/, 'super_admin_reports'],
    [/^\/super-admin\/invoices\/?$/, 'super_admin_invoices'],
    [/^\/super-admin\/billing-manual\/?$/, 'super_admin_manual_billing'],
    [/^\/super-admin\/settings\/?$/, 'super_admin_settings'],
    [/^\/super-admin\/settings\/regional\/?$/, 'super_admin_regional_settings'],
    [/^\/super-admin\/settings\/billing\/?$/, 'super_admin_billing_settings'],
    [/^\/super-admin\/settings\/security\/?$/, 'super_admin_security_settings'],
    [/^\/super-admin\/settings\/notifications\/?$/, 'super_admin_notification_settings'],
    [/^\/super-admin\/settings\/policies\/?$/, 'super_admin_policy_settings'],
    [/^\/super-admin\/settings\/database\/?$/, 'super_admin_database'],
    [/^\/super-admin\/settings\/auth-debug\/?$/, 'super_admin_debug_auth'],
    [/^\/super-admin\/order-debug\/?$/, 'super_admin_order_debug'],
    [/^\/super-admin\/abandoned-carts\/?$/, 'super_admin_abandoned_carts'],
    [/^\/super-admin\/customers\/[^/]+\/?$/, 'super_admin_customer_detail'],
    [/^\/super-admin\/customers\/?$/, 'super_admin_customers'],
    [/^\/super-admin\/email-management\/?$/, 'super_admin_email_management'],
    [/^\/super-admin\/analytics\/?$/, 'super_admin_analytics'],
    [/^\/super-admin\/profile\/?$/, 'super_admin_profile'],
];

export function resolveSuperAdminPageKey(pathname) {
    const p = pathname || '';
    if (!p.startsWith('/super-admin')) return null;
    for (const [re, key] of SUPER_RULES) {
        if (re.test(p)) return key;
    }
    return null;
}

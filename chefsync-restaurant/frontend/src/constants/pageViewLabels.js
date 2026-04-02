/**
 * תוויות עבריות ל-page_key (אנליטיקות סופר־אדמין)
 */
export const PAGE_VIEW_LABELS = {
    // ציבור
    home: 'דף הבית (פלטפורמה)',
    landing: 'דף נחיתה',
    register_restaurant: 'הרשמת מסעדה',
    menu: 'תפריט מסעדה (לקוח)',
    cart: 'סל קניות',
    restaurant_share: 'דף שיתוף מסעדה',
    kiosk: 'קיוסק',
    screen: 'מסך תצוגה',
    order_status: 'מעקב הזמנה',
    my_orders: 'ההזמנות שלי',
    verify_email: 'אימות אימייל',
    payment_callback: 'חזרה מתשלום',
    legal_privacy: 'מדיניות פרטיות',
    legal_terms_end_user: 'תנאי שימוש (לקוח)',
    legal_terms_restaurant: 'תנאי שימוש (מסעדה)',

    // מנהל מסעדה
    admin_dashboard: 'פאנל — דשבורד',
    admin_orders: 'פאנל — הזמנות',
    admin_menu_management: 'פאנל — ניהול תפריט',
    admin_restaurant: 'פאנל — פרטי מסעדה',
    admin_employees: 'פאנל — צוות',
    admin_payment_settings: 'פאנל — הגדרות תשלום',
    admin_preview_menu: 'פאנל — תצוגת תפריט',
    admin_preview_cart: 'פאנל — תצוגת סל',
    admin_preview_order_status: 'פאנל — תצוגת סטטוס הזמנה',
    admin_delivery_zones: 'פאנל — אזורי משלוח',
    admin_paywall: 'פאנל — מנוי / חסימה',
    admin_payment_demo: 'פאנל — דמו תשלום',
    admin_payment_success: 'פאנל — תשלום הצליח',
    admin_payment_error: 'פאנל — תשלום נכשל',
    admin_terminal: 'פאנל — מסוף',
    admin_coupons: 'פאנל — מבצעים',
    admin_devices: 'פאנל — מכשירים / מדפסות',
    admin_simulator: 'פאנל — סימולטור',
    admin_qr_code: 'פאנל — QR',
    admin_reports_center: 'פאנל — דוחות',
    admin_pos: 'קופה (POS)',
    admin_auth_debug: 'פאנל — דיבאג התחברות',
    admin_settings_hub: 'פאנל — מרכז הגדרות',
    admin_user_settings: 'פאנל — הגדרות משתמש',
    admin_abandoned_cart_reminders: 'פאנל — תזכורות סל נטוש',

    // סופר־אדמין
    super_admin_dashboard: 'סופר־אדמין — דשבורד',
    super_admin_notification_center: 'סופר־אדמין — מרכז התראות',
    super_admin_reports: 'סופר־אדמין — דוחות',
    super_admin_invoices: 'סופר־אדמין — חשבוניות',
    super_admin_manual_billing: 'סופר־אדמין — תשלומים ידני',
    super_admin_settings: 'סופר־אדמין — הגדרות',
    super_admin_regional_settings: 'סופר־אדמין — אזורי',
    super_admin_billing_settings: 'סופר־אדמין — חיוב',
    super_admin_security_settings: 'סופר־אדמין — אבטחה',
    super_admin_notification_settings: 'סופר־אדמין — התראות (הגדרות)',
    super_admin_policy_settings: 'סופר־אדמין — מדיניות',
    super_admin_database: 'סופר־אדמין — תחזוקת DB',
    super_admin_debug_auth: 'סופר־אדמין — דיבאג אימות',
    super_admin_order_debug: 'סופר־אדמין — לוג הזמנות',
    super_admin_abandoned_carts: 'סופר־אדמין — סל נטוש',
    super_admin_customer_detail: 'סופר־אדמין — פרטי לקוח',
    super_admin_customers: 'סופר־אדמין — לקוחות',
    super_admin_email_management: 'סופר־אדמין — ניהול מיילים',
    super_admin_analytics: 'סופר־אדמין — אנליטיקות כניסה',
    super_admin_profile: 'סופר־אדמין — פרופיל',
};

export function pageKeyLabel(key) {
    if (!key) return '—';
    return PAGE_VIEW_LABELS[key] || key;
}

/**
 * תיאור ידידותי לנתיב URL של לקוח (בלי להציג מחרוזת טכנית כעמודה ראשית)
 */
export function describeCustomerPath(path) {
    if (!path || typeof path !== 'string') return '—';
    const p = path.split('?')[0] || path;
    if (/\/menu\/?$/.test(p) || /\/[^/]+\/menu\/?$/.test(p)) {
        return 'תפריט המסעדה';
    }
    if (/\/cart\/?$/.test(p) || /\/[^/]+\/cart\/?$/.test(p)) {
        return 'סל קניות';
    }
    if (/\/order-status\//.test(p) || /\/[^/]+\/order-status\//.test(p)) {
        return 'מעקב אחר הזמנה';
    }
    if (p.startsWith('/r/')) {
        return 'דף שיתוף מסעדה';
    }
    if (p.startsWith('/kiosk/')) {
        return 'ממשק קיוסק';
    }
    if (p.startsWith('/screen/')) {
        return 'מסך תצוגה';
    }
    if (p === '/' || p === '') {
        return 'דף הבית';
    }
    return 'דף אחר';
}

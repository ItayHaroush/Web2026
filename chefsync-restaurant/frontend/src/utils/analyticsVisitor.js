const STORAGE_KEY = 'analytics_visitor_uuid';
const SESSION_KEY = 'analytics_session_id';
const SESSION_LAST_KEY = 'analytics_session_last';
const SESSION_IDLE_MS = 30 * 60 * 1000; // session מתאפס אחרי 30 דק' חוסר פעילות

function fallbackUuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

function newUuid() {
    return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : fallbackUuid();
}

/**
 * מזהה מבקר יציב (דפדפן) לאנליטיקה — לא מבוסס PII.
 */
export function getOrCreateVisitorUuid() {
    try {
        let u = localStorage.getItem(STORAGE_KEY);
        if (u && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(u)) {
            return u;
        }
        u = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : fallbackUuid();
        localStorage.setItem(STORAGE_KEY, u);
        return u;
    } catch {
        return null;
    }
}

/**
 * סוג מבקר + customer_id לפי customer_data (אם קיים).
 */
/**
 * שם מהטופס (פרטי הזמנה) לפי tenant — רמז תצוגה לאורח אנונימי.
 */
export function getVisitorDisplayHintForTenant(tenantId) {
    if (!tenantId) return undefined;
    try {
        const raw = localStorage.getItem(`customer_info_${tenantId}`);
        if (!raw) return undefined;
        const o = JSON.parse(raw);
        const n = String(o?.name || '').trim();
        return n ? n.slice(0, 120) : undefined;
    } catch {
        return undefined;
    }
}

export function getVisitorKindPayload() {
    try {
        const raw = localStorage.getItem('customer_data');
        if (!raw) {
            return { visitor_kind: 'anonymous', customer_id: null };
        }
        const c = JSON.parse(raw);
        const id = c?.id != null ? Number(c.id) : null;
        if (!id || Number.isNaN(id)) {
            return { visitor_kind: 'anonymous', customer_id: null };
        }
        return {
            visitor_kind: c.is_registered ? 'customer_registered' : 'customer_guest',
            customer_id: id,
        };
    } catch {
        return { visitor_kind: 'anonymous', customer_id: null };
    }
}

/**
 * מזהה ביקור (session) — מתאפס אחרי 30 דק' חוסר פעילות.
 * שורד רענון דף וניווט חיצוני (redirect לתשלום) כי נשמר ב-localStorage,
 * כך שכל מסע הקנייה — כולל החזרה מ-HYP — נשאר אותו session.
 */
export function getOrCreateSessionId() {
    try {
        const now = Date.now();
        const last = parseInt(localStorage.getItem(SESSION_LAST_KEY) || '0', 10);
        let id = localStorage.getItem(SESSION_KEY);
        const idle = !last || now - last > SESSION_IDLE_MS;
        if (!id || idle || !/^[0-9a-f-]{36}$/i.test(id)) {
            id = newUuid();
            localStorage.setItem(SESSION_KEY, id);
        }
        localStorage.setItem(SESSION_LAST_KEY, String(now));
        return id;
    } catch {
        return newUuid();
    }
}

let _deviceInfoCache = null;

/**
 * זיהוי מכשיר/מערכת הפעלה/דפדפן מתוך ה-User Agent.
 * @returns {{ device: string, os: string, browser: string, is_native: boolean }}
 */
export function getDeviceInfo() {
    if (_deviceInfoCache) return _deviceInfoCache;

    let ua = '';
    let isNative = false;
    let maxTouch = 0;
    try {
        ua = navigator.userAgent || '';
        maxTouch = navigator.maxTouchPoints || 0;
        isNative = !!(window?.Capacitor?.isNativePlatform?.());
    } catch {
        /* ignore */
    }

    const has = (re) => re.test(ua);

    // מערכת הפעלה
    let os = 'unknown';
    if (has(/android/i)) os = 'android';
    else if (has(/iphone|ipad|ipod/i) || (has(/macintosh/i) && maxTouch > 1)) os = 'ios';
    else if (has(/windows/i)) os = 'windows';
    else if (has(/mac os|macintosh/i)) os = 'macos';
    else if (has(/linux/i)) os = 'linux';

    // סוג מכשיר
    let device = 'desktop';
    if (has(/ipad/i) || (has(/macintosh/i) && maxTouch > 1) || (has(/android/i) && !has(/mobile/i)) || has(/tablet/i)) {
        device = 'tablet';
    } else if (has(/mobi|iphone|ipod|android.*mobile|windows phone/i)) {
        device = 'mobile';
    }

    // דפדפן (סדר חשוב — Edge/Samsung לפני Chrome, Chrome לפני Safari)
    let browser = 'other';
    if (has(/edg(e|a|ios)?\//i)) browser = 'edge';
    else if (has(/samsungbrowser/i)) browser = 'samsung';
    else if (has(/opr\/|opera/i)) browser = 'opera';
    else if (has(/fxios|firefox/i)) browser = 'firefox';
    else if (has(/crios/i) || (has(/chrome/i) && !has(/edg/i))) browser = 'chrome';
    else if (has(/safari/i)) browser = 'safari';

    _deviceInfoCache = { device, os, browser, is_native: isNative };
    return _deviceInfoCache;
}

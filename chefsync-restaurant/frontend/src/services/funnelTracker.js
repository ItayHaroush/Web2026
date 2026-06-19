import apiClient, { getPublicTenantId } from './apiClient';
import { API_BASE_URL } from '../constants/api';
import {
    getOrCreateSessionId,
    getOrCreateVisitorUuid,
    getDeviceInfo,
    getVisitorKindPayload,
} from '../utils/analyticsVisitor';
import { resolvePublicPageKey } from '../utils/pageViewMap';

/**
 * מעקב אירועי משפך (Funnel) בצד הלקוח.
 *
 * עקרונות:
 * - תור בזיכרון + flush כל ~3 שניות.
 * - flush ב-pagehide/visibilitychange עם navigator.sendBeacon — כך נתפסת
 *   הפעולה האחרונה לפני שהמשתמש עוזב (קריטי לזיהוי נקודת הנטישה).
 * - עובד גם למבקר אנונימי (אין צורך בטלפון/התחברות).
 * - מדידת זמן: duration_ms = ms מאז האירוע הקודם ב-session.
 */

export const STAGE = {
    MENU_VIEW: 1,
    ADD_TO_CART: 2,
    CART_VIEW: 3,
    CHECKOUT_STARTED: 4,
    DETAILS_COMPLETE: 5,
    DELIVERY_RESOLVED: 6,
    REVIEW: 7,
    ORDER_SUBMIT: 8,
    ORDER_CREATED: 9,
    PAYMENT_SUCCESS: 10,
};

const FLUSH_INTERVAL_MS = 3000;
const MAX_QUEUE = 200;
const EVENTS_PATH = '/analytics/events';

let queue = [];
let lastEventTs = 0;
let currentStage = 0;
let flushTimer = null;
let listenersBound = false;

function nowMs() {
    return Date.now();
}

function currentPath() {
    try {
        return window.location.pathname + window.location.search;
    } catch {
        return '';
    }
}

function currentPageKey() {
    try {
        return resolvePublicPageKey(window.location.pathname) || null;
    } catch {
        return null;
    }
}

/** האם אנחנו בעמוד לקוח/ציבורי (לא admin/super-admin) — לסינון רעש */
function isPublicContext() {
    return currentPageKey() !== null;
}

/** ייצוא חיצוני — לסינון אירועים בהקשר לקוח בלבד (למשל מ-CartContext) */
export function isFunnelContext() {
    return isPublicContext();
}

/** שלב בסיס לפי העמוד — כדי שלאירועי שגיאה/חסימה יהיה הקשר גם אחרי רענון */
function stageFromPageKey(pageKey) {
    switch (pageKey) {
        case 'menu':
            return STAGE.MENU_VIEW;
        case 'cart':
            return STAGE.CART_VIEW;
        case 'payment_callback':
            return STAGE.ORDER_CREATED;
        case 'order_status':
            return STAGE.PAYMENT_SUCCESS;
        default:
            return 0;
    }
}

function buildEnvelope() {
    const device = getDeviceInfo();
    const { customer_id } = getVisitorKindPayload();
    let tenant_id;
    try {
        tenant_id = getPublicTenantId() || undefined;
    } catch {
        tenant_id = undefined;
    }
    return {
        session_id: getOrCreateSessionId(),
        visitor_uuid: getOrCreateVisitorUuid() || undefined,
        customer_id: customer_id ?? undefined,
        tenant_id: tenant_id || undefined,
        device: device.device,
        os: device.os,
        browser: device.browser,
        is_native: device.is_native,
    };
}

function scheduleFlush() {
    if (flushTimer || queue.length === 0) return;
    flushTimer = setTimeout(() => {
        flushTimer = null;
        flush(false);
    }, FLUSH_INTERVAL_MS);
}

function bindLifecycleListeners() {
    if (listenersBound || typeof window === 'undefined') return;
    listenersBound = true;
    // pagehide + visibilitychange(hidden) — תופס יציאה/מעבר-טאב בלי לפגוע ב-bfcache
    window.addEventListener('pagehide', () => flush(true));
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') flush(true);
    });
}

/**
 * שליחת התור לשרת. useBeacon=true בעת יציאה מהדף.
 */
function flush(useBeacon) {
    if (queue.length === 0) return;
    const events = queue;
    queue = [];
    if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
    }

    const body = { ...buildEnvelope(), events };

    if (useBeacon && typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        try {
            const blob = new Blob([JSON.stringify(body)], { type: 'application/json' });
            const ok = navigator.sendBeacon(`${API_BASE_URL}${EVENTS_PATH}`, blob);
            if (ok) return;
        } catch {
            /* נפילה ל-XHR למטה */
        }
    }

    apiClient.post(EVENTS_PATH, body).catch(() => {
        // אם נכשל — אל תאבד לגמרי, החזר לתור (עד התקרה) לניסיון הבא
        if (!useBeacon && queue.length < MAX_QUEUE) {
            queue = events.slice(-MAX_QUEUE).concat(queue);
            scheduleFlush();
        }
    });
}

/**
 * רישום אירוע גולמי.
 * @param {string} eventName
 * @param {object} [opts]
 * @param {number} [opts.stage] שלב משפך (1..10) — לאירועי התקדמות
 * @param {string} [opts.blockReason] סיבת חסימה (לאירוע checkout_blocked)
 * @param {string} [opts.errorType] js_error / unhandled_rejection / api_error
 * @param {string} [opts.errorMessage]
 * @param {number} [opts.amount] ערך הסל ברגע האירוע
 * @param {object} [opts.payload] נתונים נוספים
 * @param {number} [opts.orderId]
 * @param {string} [opts.pageKey]
 */
export function track(eventName, opts = {}) {
    if (!eventName) return;
    try {
        const ts = nowMs();
        const duration_ms = lastEventTs ? Math.max(0, ts - lastEventTs) : undefined;
        lastEventTs = ts;

        const pageKey = opts.pageKey || currentPageKey();

        let stage = Number.isFinite(opts.stage) ? opts.stage : 0;
        if (stage > currentStage) currentStage = stage;
        if (!stage) {
            // אירוע נלווה (שגיאה/חסימה) — תייג בשלב הנוכחי/לפי העמוד
            stage = Math.max(currentStage, stageFromPageKey(pageKey));
        }

        const ev = {
            event_name: eventName,
            funnel_stage: stage || 0,
            page_key: pageKey || undefined,
            path: currentPath(),
            ts,
        };
        if (duration_ms !== undefined) ev.duration_ms = duration_ms;
        if (opts.blockReason) ev.block_reason = opts.blockReason;
        if (opts.errorType) ev.error_type = opts.errorType;
        if (opts.errorMessage) ev.error_message = String(opts.errorMessage).slice(0, 1000);
        if (opts.amount != null && Number.isFinite(Number(opts.amount))) ev.amount = Number(opts.amount);
        if (opts.orderId) ev.order_id = opts.orderId;
        if (opts.payload && typeof opts.payload === 'object') ev.payload = opts.payload;

        queue.push(ev);
        if (queue.length > MAX_QUEUE) queue = queue.slice(-MAX_QUEUE);

        bindLifecycleListeners();
        scheduleFlush();
    } catch {
        /* אנליטיקה לעולם לא שוברת UX */
    }
}

/** אירוע התקדמות בשלב מסוים */
export function trackStage(eventName, stage, opts = {}) {
    track(eventName, { ...opts, stage });
}

/** נקודת חסימה — הסיבה ל"לא השלים הזמנה" */
export function trackBlock(blockReason, opts = {}) {
    track('checkout_blocked', { ...opts, blockReason });
}

/** בדיקת תקינות (Health Check) — שגיאת JS / API. רק בהקשר לקוח. */
export function trackError(errorType, errorMessage, opts = {}) {
    if (!isPublicContext()) return; // אל תזהם את משפך הלקוח בשגיאות אדמין
    track(errorType === 'api_error' ? 'api_error' : 'js_error', {
        ...opts,
        errorType,
        errorMessage,
    });
}

export default { track, trackStage, trackBlock, trackError, STAGE };

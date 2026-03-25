const STORAGE_KEY = 'analytics_visitor_uuid';

function fallbackUuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
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

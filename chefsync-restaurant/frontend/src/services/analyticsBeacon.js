import api, { getPublicTenantId } from './apiClient';
import { resolveTenantIdFromPath } from '../utils/analyticsTenant';
import { getOrCreateVisitorUuid, getVisitorKindPayload, getVisitorDisplayHintForTenant } from '../utils/analyticsVisitor';

/**
 * אירוע צפייה ציבורי (לקוח / שיתוף / קיוסק וכו')
 */
export function sendPublicPageView(pageKey, { path, referrer } = {}) {
    if (!pageKey) return;
    const visitor_uuid = getOrCreateVisitorUuid();
    if (!visitor_uuid) return;

    const { visitor_kind, customer_id } = getVisitorKindPayload();
    const fullPath = path ?? (typeof window !== 'undefined' ? window.location.pathname + window.location.search : '');
    const pathnameOnly = fullPath.split('?')[0] || '';
    const fromPath = resolveTenantIdFromPath(pathnameOnly);
    const tenant_id = (fromPath || getPublicTenantId() || undefined) || undefined;
    const visitor_display_hint = tenant_id ? getVisitorDisplayHintForTenant(tenant_id) : undefined;

    api.post('/analytics/page-view', {
        page_key: pageKey,
        tenant_id: tenant_id || undefined,
        visitor_uuid,
        customer_id: customer_id ?? undefined,
        visitor_kind,
        visitor_display_hint: visitor_display_hint || undefined,
        path: fullPath,
        referrer: (referrer ?? (typeof document !== 'undefined' ? document.referrer : '')).slice(0, 512),
    }).catch(() => {});
}

/**
 * פאנל מנהל מסעדה — מאומת
 */
export function sendRestaurantAdminPageView(pageKey, getAuthHeaders, { path, referrer } = {}) {
    if (!pageKey || !getAuthHeaders) return;
    const visitor_uuid = getOrCreateVisitorUuid();

    api.post(
        '/admin/analytics/page-view',
        {
            page_key: pageKey,
            visitor_uuid: visitor_uuid || undefined,
            path: path ?? (typeof window !== 'undefined' ? window.location.pathname + window.location.search : ''),
            referrer: (referrer ?? (typeof document !== 'undefined' ? document.referrer : '')).slice(0, 512),
        },
        { headers: getAuthHeaders() }
    ).catch(() => {});
}

/**
 * סופר־אדמין — מאומת
 */
export function sendSuperAdminPageView(pageKey, getAuthHeaders, { path, referrer } = {}) {
    if (!pageKey || !getAuthHeaders) return;
    const visitor_uuid = getOrCreateVisitorUuid();

    api.post(
        '/super-admin/analytics/page-view',
        {
            page_key: pageKey,
            visitor_uuid: visitor_uuid || undefined,
            path: path ?? (typeof window !== 'undefined' ? window.location.pathname + window.location.search : ''),
            referrer: (referrer ?? (typeof document !== 'undefined' ? document.referrer : '')).slice(0, 512),
        },
        { headers: getAuthHeaders() }
    ).catch(() => {});
}

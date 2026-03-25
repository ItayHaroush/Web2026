const RESERVED = new Set(['admin', 'super-admin']);

/**
 * tenant_id מהנתיב /:tenant/(menu|cart|order-status) — מדויק יותר מ-localStorage בכניסה ישירה.
 */
export function resolveTenantIdFromPath(pathname) {
    const p = pathname || '';
    const m = p.match(/^\/([^/]+)\/(menu|cart|order-status)/);
    if (!m) return '';
    const seg = m[1];
    if (RESERVED.has(seg.toLowerCase())) return '';
    return seg;
}

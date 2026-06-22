const STORAGE_PREFIX = 'chefsync_order_idempotency';

function storageKey(tenantId) {
    return `${STORAGE_PREFIX}_${tenantId || 'default'}`;
}

/**
 * טביעת אצבע של הסל + פרטי checkout — מפתח idempotency תקף רק לתוכן זהה.
 */
export function buildOrderSubmitFingerprint({
    cartItems,
    customerInfo,
    effectivePaymentMethod,
    scheduledFor,
    appliedPromotions,
}) {
    return JSON.stringify({
        items: (cartItems || []).map((item) => ({
            id: item.menuItemId,
            qty: item.qty,
            variant: item.variant?.id ?? null,
            notes: item.notes || '',
            addons: (item.addons || []).map((a) => ({
                id: a.id,
                q: a.quantity || 1,
                side: !!a.on_side,
                p: a.placement || 'whole',
            })),
        })),
        name: customerInfo?.name || '',
        phone: customerInfo?.phone || '',
        delivery: customerInfo?.delivery_method || 'pickup',
        address: customerInfo?.delivery_address || '',
        notes: customerInfo?.delivery_notes || '',
        payment: effectivePaymentMethod || 'cash',
        scheduled: scheduledFor || null,
        promos: (appliedPromotions || []).map((p) => p.promotion_id),
    });
}

export function getOrCreateOrderIdempotencyKey(tenantId, fingerprint) {
    const key = storageKey(tenantId);
    try {
        const raw = sessionStorage.getItem(key);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed?.fingerprint === fingerprint && parsed?.idempotencyKey) {
                return parsed.idempotencyKey;
            }
        }
    } catch {
        /* ignore */
    }

    const idempotencyKey = crypto.randomUUID();
    try {
        sessionStorage.setItem(
            key,
            JSON.stringify({ idempotencyKey, fingerprint })
        );
    } catch {
        /* ignore */
    }
    return idempotencyKey;
}

export function clearOrderIdempotencyKey(tenantId) {
    try {
        sessionStorage.removeItem(storageKey(tenantId));
    } catch {
        /* ignore */
    }
}

/**
 * עדכון localStorage של activeOrders_* / pendingReviewOrders_* לא מפעיל רינדור מחדש של CustomerLayout.
 * מפיצים אירוע כדי שהכותרת (מונה / מודל) יקראו שוב את המפתחות.
 */
export const ACTIVE_ORDERS_STORAGE_CHANGED = 'chefsync:active-orders-storage-changed';

export function notifyActiveOrdersStorageChanged() {
    if (typeof window === 'undefined') return;
    try {
        window.dispatchEvent(new CustomEvent(ACTIVE_ORDERS_STORAGE_CHANGED));
    } catch {
        /* ignore */
    }
}

/**
 * סטטוס הזמנה: "ממתין לתשלום" כמו תמיד.
 * תגית נפרדת עם אייקון כרטיס — רק כששולם באשראי (ירוק) או תשלום אשראי נכשל (אדום),
 * כמו "שולם במזומן" — לא מציגים תגית אשראי במצב pending (הממתין נשאר רק בסטטוס ההזמנה).
 */
export function shouldShowPaymentStatusBadge(order) {
    if (!order?.payment_status || order.payment_status === 'not_required') return false;
    if (order.payment_method === 'credit_card' && order.payment_status === 'pending') {
        return false;
    }
    return true;
}

/** טקסט תגית תשלום (מזומן / אשראי) — לאשראי: רק paid / failed בממשק הרשימה */
export function paymentStatusBadgeLabel(order) {
    const ps = order?.payment_status;
    const pm = order?.payment_method;
    if (ps === 'paid') {
        return pm === 'credit_card' ? 'שולם באשראי' : 'שולם במזומן';
    }
    if (ps === 'failed') {
        return pm === 'credit_card' ? 'תשלום אשראי נכשל' : 'תשלום נכשל';
    }
    if (ps === 'pending') {
        return 'ממתין לתשלום';
    }
    return '';
}

/** תווית סטטוס הזמנה awaiting_payment */
export const ORDER_STATUS_AWAITING_PAYMENT_HE = 'ממתין לתשלום';

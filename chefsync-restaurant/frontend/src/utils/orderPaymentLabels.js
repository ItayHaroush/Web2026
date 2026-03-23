/**
 * תגית עם אייקון אשראי: שולם באשראי (ירוק) / תשלום אשראי נכשל (אדום).
 * כשההזמנה כבר "ממתין לאשראי" — לא מציגים שוב תגית "ממתין" על התשלום.
 */
export function shouldShowPaymentStatusBadge(order) {
    if (!order?.payment_status || order.payment_status === 'not_required') return false;
    if (
        order.status === 'awaiting_payment' &&
        order.payment_method === 'credit_card' &&
        order.payment_status === 'pending'
    ) {
        return false;
    }
    return true;
}

/** טקסט תגית תשלום (מזומן / אשראי) */
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
        if (pm === 'credit_card') return 'ממתין לאשראי';
        return 'ממתין לתשלום';
    }
    return '';
}

/** תווית סטטוס הזמנה awaiting_payment — נפרדת מתגית תשלום כדי למנוע כפילות */
export const ORDER_STATUS_AWAITING_PAYMENT_HE = 'ממתין לאשראי';

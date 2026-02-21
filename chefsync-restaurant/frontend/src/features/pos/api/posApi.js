import api from '../../../services/apiClient';

const posHeaders = (authHeaders, posToken) => ({
    ...authHeaders,
    ...(posToken ? { 'X-POS-Session': posToken } : {}),
});

export const posApi = {
    // Time clock
    clock: (pin, headers) =>
        api.post('/admin/time/clock', { pin }, { headers }),
    setPin: (userId, pin, headers) =>
        api.post('/admin/time/set-pin', { user_id: userId, pin }, { headers }),
    getToday: (headers) =>
        api.get('/admin/time/today', { headers }),
    getReport: (from, to, userId, headers) =>
        api.get('/admin/time/report', { params: { from, to, user_id: userId || undefined }, headers }),
    getMyReport: (from, to, headers) =>
        api.get('/admin/time/my-report', { params: { from, to }, headers }),

    // POS Session
    setPosPin: (pin, headers) =>
        api.post('/admin/pos/set-pin', { pin }, { headers }),
    verifyPin: (pin, headers) =>
        api.post('/admin/pos/verify-pin', { pin }, { headers }),
    lockSession: (headers, token) =>
        api.post('/admin/pos/lock', {}, { headers: posHeaders(headers, token) }),
    unlockSession: (pin, headers) =>
        api.post('/admin/pos/unlock', { pin }, { headers }),
    getSession: (headers, token) =>
        api.get('/admin/pos/session', { headers: posHeaders(headers, token) }),

    // Shift
    openShift: (openingBalance, headers, token) =>
        api.post('/admin/pos/shift/open', { opening_balance: openingBalance }, { headers: posHeaders(headers, token) }),
    closeShift: (closingBalance, notes, headers, token) =>
        api.post('/admin/pos/shift/close', { closing_balance: closingBalance, notes }, { headers: posHeaders(headers, token) }),
    currentShift: (headers, token) =>
        api.get('/admin/pos/shift/current', { headers: posHeaders(headers, token) }),
    cashMovement: (type, amount, description, headers, token) =>
        api.post('/admin/pos/shift/cash-movement', { type, amount, description }, { headers: posHeaders(headers, token) }),
    shiftSummary: (headers, token) =>
        api.get('/admin/pos/shift/summary', { headers: posHeaders(headers, token) }),
    shiftHistory: (headers, token) =>
        api.get('/admin/pos/shift/history', { headers: posHeaders(headers, token) }),
    shiftReport: (shiftId, headers, token) =>
        api.get(`/admin/pos/shift/${shiftId}/report`, { headers: posHeaders(headers, token) }),
    getClockedIn: (headers, token) =>
        api.get('/admin/pos/clocked-in', { headers: posHeaders(headers, token) }),

    // Orders — reuse the same endpoint as admin panel, today only
    getOrders: (headers) =>
        api.get('/admin/orders', {
            headers,
            params: { per_page: 100, date: new Date().toISOString().slice(0, 10) },
        }),
    createOrder: (orderData, headers, token) =>
        api.post('/admin/pos/orders', orderData, { headers: posHeaders(headers, token) }),

    // Menu (reuse kiosk endpoint)
    getMenu: (kioskToken) =>
        api.get(`/kiosk/${kioskToken}/menu`),

    // Order status (reuse admin endpoint)
    updateOrderStatus: (orderId, status, headers) =>
        api.patch(`/admin/orders/${orderId}/status`, { status }, { headers }),
    markOrderPaid: (orderId, headers) =>
        api.post(`/admin/orders/${orderId}/mark-paid`, {}, { headers }),

    // Printing
    printReceipt: (orderId, headers, token) =>
        api.post(`/admin/pos/orders/${orderId}/print-receipt`, {}, { headers: posHeaders(headers, token) }),
    printKitchenTicket: (orderId, headers, token) =>
        api.post(`/admin/pos/orders/${orderId}/print-kitchen`, {}, { headers: posHeaders(headers, token) }),
    getPendingPrintJobs: (headers, token) =>
        api.get('/admin/pos/print-jobs/pending', { headers: posHeaders(headers, token) }),
};

export default posApi;

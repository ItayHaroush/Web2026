import api from './apiClient';

const detectSource = () => {
    const host = typeof window !== 'undefined' ? (window.location.hostname || '').toLowerCase() : '';
    if (host.includes('buildix')) return 'buildix';
    if (host.includes('appointix') || host.includes('appointed')) return 'appointix';
    return 'takeeat';
};

export const getSubscriptionStatus = () => api.get('/admin/subscription/status');

export const activateSubscription = (planType = 'monthly', tier = 'pro') =>
    api.post('/admin/subscription/activate', {
        plan_type: planType,
        tier: tier
    });

export const createPaymentSession = (planType = 'monthly', tier = 'pro') =>
    api.post('/admin/subscription/create-payment-session', {
        plan_type: planType,
        tier: tier,
        source: detectSource(),
    });

export const getBillingInfo = () => api.get('/admin/billing/info');

export const requestCancellation = (payload) =>
    api.post('/admin/billing/cancellation-request', payload);

export const withdrawCancellationRequest = () =>
    api.delete('/admin/billing/cancellation-request');

export const checkPendingPayment = () => api.post('/admin/subscription/check-pending');

import api from './apiClient';

export const getSubscriptionStatus = () => api.get('/admin/subscription/status');

export const activateSubscription = (planType = 'monthly', tier = 'pro') =>
    api.post('/admin/subscription/activate', {
        plan_type: planType,
        tier: tier
    });

export const createPaymentSession = (planType = 'monthly', tier = 'pro') =>
    api.post('/admin/subscription/create-payment-session', {
        plan_type: planType,
        tier: tier
    });

export const getBillingInfo = () => api.get('/admin/billing/info');

export const checkPendingPayment = () => api.post('/admin/subscription/check-pending');

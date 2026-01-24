import api from './apiClient';

export const getSubscriptionStatus = () => api.get('/admin/subscription/status');

export const activateSubscription = (planType = 'monthly', tier = 'pro') =>
    api.post('/admin/subscription/activate', {
        plan_type: planType,
        tier: tier
    });


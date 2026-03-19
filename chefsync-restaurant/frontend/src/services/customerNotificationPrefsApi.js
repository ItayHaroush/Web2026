import { TENANT_HEADER } from '../constants/api';

/**
 * @param {import('axios').AxiosInstance} api
 */
export async function fetchNotificationRestaurants(api, customerToken) {
    const res = await api.get('/customer/notification-restaurants', {
        headers: { Authorization: `Bearer ${customerToken}` },
    });
    if (res.data?.success) {
        return res.data.data || [];
    }
    return [];
}

/**
 * @param {import('axios').AxiosInstance} api
 * @param {{ tenant_id: string, enabled: boolean }[]} optIns
 */
export async function saveNotificationOptIns(api, customerToken, optIns, tenantHint) {
    const headers = { Authorization: `Bearer ${customerToken}` };
    if (tenantHint) {
        headers[TENANT_HEADER] = tenantHint;
    }
    await api.put('/customer/notification-restaurants', { opt_ins: optIns }, { headers });
}

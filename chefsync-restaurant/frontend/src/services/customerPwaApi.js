import { TENANT_HEADER } from '../constants/api';

const PENDING_KEY = 'pending_customer_fcm_v1';

function headersWithOptionalTenant(customerToken, tenantId) {
    const headers = {};
    if (customerToken) {
        headers.Authorization = `Bearer ${customerToken}`;
    }
    if (tenantId) {
        headers[TENANT_HEADER] = tenantId;
    }
    return headers;
}

/**
 * @param {import('axios').AxiosInstance} api
 */
export async function pingCustomerPwa(api, { tenantId, standalone, pushPermission, customerToken }) {
    try {
        await api.post(
            '/customer/pwa/ping',
            {
                standalone: !!standalone,
                push_permission: pushPermission || undefined,
            },
            { headers: headersWithOptionalTenant(customerToken, tenantId) }
        );
    } catch {
        /* רשת / לא מחובר */
    }
}

export async function registerCustomerPush(api, { tenantId, customerToken, token }) {
    await api.post(
        '/customer/fcm/register',
        {
            token,
            device_label: 'pwa',
            platform: 'web',
        },
        { headers: headersWithOptionalTenant(customerToken, tenantId || undefined) }
    );
}

export async function unregisterCustomerPush(api, { tenantId, customerToken, token }) {
    if (!customerToken || !token) return;
    try {
        await api.post(
            '/customer/fcm/unregister',
            { token },
            { headers: headersWithOptionalTenant(customerToken, tenantId || undefined) }
        );
    } catch {
        /* ignore */
    }
}

export function savePendingFcmRegistration(tenantId, token) {
    try {
        localStorage.setItem(PENDING_KEY, JSON.stringify({ tenantId: tenantId || null, token, at: Date.now() }));
    } catch {
        /* ignore */
    }
}

export function clearPendingFcmRegistration() {
    try {
        localStorage.removeItem(PENDING_KEY);
    } catch {
        /* ignore */
    }
}

/** מנסה לרשום FCM שנשמר לפני התחברות */
export async function flushPendingCustomerFcmRegistration(api, customerToken) {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw || !customerToken) return;
    let data;
    try {
        data = JSON.parse(raw);
    } catch {
        return;
    }
    if (!data?.token) return;
    try {
        await registerCustomerPush(api, {
            tenantId: data.tenantId || undefined,
            customerToken,
            token: data.token,
        });
        clearPendingFcmRegistration();
    } catch {
        /* נשאיר pending */
    }
}

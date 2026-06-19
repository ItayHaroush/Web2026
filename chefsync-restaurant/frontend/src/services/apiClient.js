import axios from 'axios';
import { API_BASE_URL, LOCAL_API, PROD_API, TENANT_HEADER } from '../constants/api';

/**
 * אתחול כלי HTTP עם תמיכה מלאה ב-Multi-Tenant
 * בכל בקשה יוצמד ה-Tenant ID מה-localStorage
 */

const RESERVED_PREFIXES = new Set(['admin', 'super-admin']);

const getTenantIdFromUrl = () => {
    try {
        const path = window?.location?.pathname || '';
        const match = path.match(/^\/([^\/]+)\/(menu|cart|order-status)/);
        const candidate = match?.[1] || '';
        if (!candidate) return '';
        return RESERVED_PREFIXES.has(candidate.toLowerCase()) ? '' : candidate;
    } catch {
        return '';
    }
};

// שמירת Tenant ID בשימוש המקומי
const getTenantId = () => {
    // URL הוא מקור אמת בכניסה ישירה; fallback ל-localStorage
    return getTenantIdFromUrl() || localStorage.getItem('tenantId') || '';
};

/** לבקשות לקוח (PWA / FCM) שדורשות X-Tenant-ID — גם כשהנתיב ב-customer לא עובר interceptor */
export function getPublicTenantId() {
    return getTenantId();
}

// יצירת instance של axios עם ברירות מחדל
export const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    },
    transformResponse: [(data) => {
        // נקה את התגובה מ-HTML warnings של PHP
        if (typeof data === 'string') {
            const jsonStart = data.indexOf('{');
            if (jsonStart > 0) {
                data = data.substring(jsonStart);
            }
        }
        try {
            return JSON.parse(data);
        } catch (e) {
            return data;
        }
    }]
});

// Save chosen base URL for other parts (e.g., asset URL resolution)
try {
    localStorage.setItem('api_base_url', API_BASE_URL);
} catch { }

// Interceptor לשמירת Tenant ID בכל בקשה
apiClient.interceptors.request.use((config) => {
    // FormData חייב boundary אוטומטי — שימור Content-Type: application/json מה-default שובר העלאת קבצים (מבצעים וכו').
    if (config.data instanceof FormData) {
        delete config.headers['Content-Type'];
    }

    const tenantId = getTenantId();
    const urlTenantId = getTenantIdFromUrl();
    const token = localStorage.getItem('authToken') || localStorage.getItem('admin_token');

    const urlPath = (config.url || '').toString();
    const isSuperAdminCall = urlPath.startsWith('/super-admin/');
    const isCustomerEndpoint = urlPath.startsWith('/customer/') || urlPath === '/customer';

    // Don't clobber an explicit header; skip tenant header for super-admin and customer routes
    if (!isSuperAdminCall && !isCustomerEndpoint && tenantId && !config.headers?.[TENANT_HEADER]) {
        config.headers[TENANT_HEADER] = tenantId;
    }

    // Customer endpoints manage their own Authorization header — never inject admin token
    if (token && !isCustomerEndpoint) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
});

// Interceptor לטיפול בשגיאות תגובה
apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        // אם השרת המקומי לא זמין (Network Error), עבור לפרודקשן ונסה שוב פעם אחת
        const isNetworkError = error.code === 'ERR_NETWORK' || (!error.response && error.message?.toLowerCase().includes('network'));
        const isOnLocal = (apiClient.defaults.baseURL || '').startsWith(LOCAL_API);
        const alreadyRetried = !!error.config?._retryWithProduction;

        if (isNetworkError && isOnLocal && !alreadyRetried) {
            apiClient.defaults.baseURL = PROD_API;
            try { localStorage.setItem('api_base_url', PROD_API); } catch { }
            const newConfig = { ...error.config, _retryWithProduction: true, baseURL: PROD_API };
            try {
                return await apiClient.request(newConfig);
            } catch (retryErr) {
                return Promise.reject(retryErr);
            }
        }

        if (error.response?.status === 401) {
            const requestUrl = error.config?.url || '';
            const isPosRoute = requestUrl.includes('/pos/');
            const isTimeClockRoute = requestUrl.includes('/time/clock');
            const isCustomerRoute = requestUrl.startsWith('/customer/') || requestUrl.startsWith('/customer');

            // Customer, POS and time-clock routes handle their own 401 logic
            if (isPosRoute || isCustomerRoute || isTimeClockRoute) {
                if (isPosRoute) {
                    const posNoSessionPath = [
                        '/pos/verify-pin',
                        '/pos/unlock',
                        '/pos/lock',
                        '/pos/set-pin',
                        '/pos/verify-manager',
                    ];
                    const isPosSessionProtected =
                        requestUrl.includes('/admin/pos/') &&
                        !posNoSessionPath.some((p) => requestUrl.includes(p));
                    if (isPosSessionProtected) {
                        try {
                            const data = error.response?.data || {};
                            window.dispatchEvent(
                                new CustomEvent('takeeat:pos-session-lost', {
                                    detail: {
                                        code: data.code || 'pos_session_invalid',
                                        message: data.message || '',
                                        reason: data.reason || null,
                                    },
                                })
                            );
                        } catch {
                            /* ignore */
                        }
                    }
                }
                return Promise.reject(error);
            }

            const hasAdminToken = !!localStorage.getItem('admin_token');
            localStorage.removeItem('authToken');
            localStorage.removeItem('tenantId');
            if (hasAdminToken) {
                localStorage.removeItem('admin_token');
                window.location.href = '/admin/login';
            } else {
                window.location.href = '/';
            }
            return new Promise(() => { });
        }

        if (error.response?.status === 402) {
            const hasAdminToken = !!(localStorage.getItem('authToken') || localStorage.getItem('admin_token'));
            const isAiEndpoint = error.config?.url?.includes('/ai/');
            const pathname = window.location.pathname;
            const isPaymentFlow = pathname.startsWith('/admin/paywall') || pathname.startsWith('/admin/payment');
            const responseData = error.response?.data?.data || {};
            const userRole = responseData.user_role || '';
            const isEmployee = userRole === 'employee' || userRole === 'delivery';

            if (hasAdminToken && !isAiEndpoint && !isPaymentFlow && !isEmployee) {
                try {
                    localStorage.setItem('paywall_data', JSON.stringify(responseData));
                } catch { }
                window.location.href = '/admin/paywall';
            }
        }

        // Health Check — דיווח כשל API למשפך (הסינון להקשר לקוח נעשה בתוך trackError)
        try {
            const status = error.response?.status;
            const url = error.config?.url || '';
            const method = (error.config?.method || '').toUpperCase();
            // אל תדווח על אירוע ה-funnel עצמו (מונע לולאה)
            if (!url.includes('/analytics/')) {
                const msg = error.response?.data?.message || error.message || 'API error';
                import('./funnelTracker')
                    .then((m) => m.trackError?.('api_error', msg, { payload: { url, status: status ?? null, method } }))
                    .catch(() => { });
            }
        } catch { /* ignore */ }

        return Promise.reject(error);
    }
);

export default apiClient;

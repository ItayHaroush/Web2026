import axios from 'axios';
import { TENANT_HEADER } from '../constants/api';

// Base URLs: prefer local, fall back to production on network errors
// ⚠️ Safe access to import.meta.env with fallbacks
const getEnv = (key, fallback) => {
    try {
        return import.meta?.env?.[key] || fallback;
    } catch {
        return fallback;
    }
};

const LOCAL_API = (getEnv('VITE_API_URL_LOCAL', 'http://localhost:8000/api')).trim();
const PROD_API = (getEnv('VITE_API_URL_PRODUCTION', 'https://api.chefsync.co.il/api')).trim();

// In production (Vercel), default straight to production API to avoid a first request to localhost.
const DEFAULT_API = getEnv('PROD', false) ? PROD_API : LOCAL_API;

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

// יצירת instance של axios עם ברירות מחדל
export const apiClient = axios.create({
    baseURL: DEFAULT_API,
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
    localStorage.setItem('api_base_url', DEFAULT_API);
} catch { }

// Interceptor לשמירת Tenant ID בכל בקשה
apiClient.interceptors.request.use((config) => {
    const tenantId = getTenantId();
    const urlTenantId = getTenantIdFromUrl();
    const token = localStorage.getItem('authToken') || localStorage.getItem('admin_token');

    const urlPath = (config.url || '').toString();
    const isSuperAdminCall = urlPath.startsWith('/super-admin/');

    // Don't clobber an explicit header; skip tenant header for super-admin routes
    if (!isSuperAdminCall && tenantId && !config.headers?.[TENANT_HEADER]) {
        config.headers[TENANT_HEADER] = tenantId;
    }

    if (token) {
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
            // Token לא תקף - נקה מידע רלוונטי והפנה לפי סוג משתמש
            const hasAdminToken = !!localStorage.getItem('admin_token');
            localStorage.removeItem('authToken');
            localStorage.removeItem('tenantId');
            if (hasAdminToken) {
                localStorage.removeItem('admin_token');
                window.location.href = '/admin/login';
            } else {
                window.location.href = '/login';
            }
        }

        if (error.response?.status === 402) {
            const hasAdminToken = !!(localStorage.getItem('authToken') || localStorage.getItem('admin_token'));
            // Don't auto-redirect for AI endpoints - let components handle it
            const isAiEndpoint = error.config?.url?.includes('/ai/');
            if (hasAdminToken && !isAiEndpoint && window.location.pathname !== '/admin/subscription') {
                try {
                    localStorage.setItem('paywall_data', JSON.stringify(error.response?.data?.data || {}));
                } catch { }
                window.location.href = '/admin/subscription';
            }
        }
        return Promise.reject(error);
    }
);

export default apiClient;

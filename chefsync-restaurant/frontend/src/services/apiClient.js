import axios from 'axios';
import { TENANT_HEADER } from '../constants/api';

// Base URLs: prefer local, fall back to production on network errors
const LOCAL_API = (import.meta.env.VITE_API_URL_LOCAL || 'http://localhost:8000/api').trim();
const PROD_API = (import.meta.env.VITE_API_URL_PRODUCTION || 'https://api.chefsync.co.il/api').trim();

/**
 * אתחול כלי HTTP עם תמיכה מלאה ב-Multi-Tenant
 * בכל בקשה יוצמד ה-Tenant ID מה-localStorage
 */

// שמירת Tenant ID בשימוש המקומי
const getTenantId = () => {
    return localStorage.getItem('tenantId') || '';
};

// יצירת instance של axios עם ברירות מחדל
export const apiClient = axios.create({
    baseURL: LOCAL_API,
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
    localStorage.setItem('api_base_url', LOCAL_API);
} catch { }

// Interceptor לשמירת Tenant ID בכל בקשה
apiClient.interceptors.request.use((config) => {
    const tenantId = getTenantId();
    const token = localStorage.getItem('authToken') || localStorage.getItem('admin_token');

    // 🔥 DEBUG - הדפס כל בקשה
    const fullUrl = (config.baseURL || '') + config.url;
    console.group(`🚀 API Request: ${config.method?.toUpperCase()} ${config.url}`);
    console.log('🌐 Full URL:', fullUrl);
    console.log('🔑 Token:', token ? `${token.substring(0, 30)}...` : '❌ MISSING');
    console.log('🏪 Tenant ID:', tenantId || '❌ MISSING');
    console.log('📦 Data:', config.data);
    console.log('🎯 Params:', config.params);
    console.groupEnd();

    if (tenantId) {
        config.headers[TENANT_HEADER] = tenantId;
    }

    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
});

// Interceptor לטיפול בשגיאות תגובה
apiClient.interceptors.response.use(
    (response) => {
        // 🔥 DEBUG - הדפס תגובות מוצלחות
        console.log(`✅ Response ${response.status}:`, response.config.url, response.data);
        return response;
    },
    async (error) => {
        // 🔥 DEBUG - הדפס שגיאות מפורטות
        console.group(`❌ API Error: ${error.config?.url}`);
        console.log('📤 Request Headers:', error.config?.headers);
        console.log('📥 Response Headers:', error.response?.headers);
        console.log('Status:', error.response?.status);
        console.log('Message:', error.response?.data?.message || error.message);
        console.log('Errors:', error.response?.data?.errors);
        console.log('Full Response:', error.response?.data);
        console.log('Raw Response Text:', typeof error.response?.data === 'string' ? error.response.data.substring(0, 500) : 'N/A');
        console.groupEnd();

        // אם השרת המקומי לא זמין (Network Error), עבור לפרודקשן ונסה שוב פעם אחת
        const isNetworkError = error.code === 'ERR_NETWORK' || (!error.response && error.message?.toLowerCase().includes('network'));
        const isOnLocal = (apiClient.defaults.baseURL || '').startsWith(LOCAL_API);
        const alreadyRetried = !!error.config?._retryWithProduction;

        if (isNetworkError && isOnLocal && !alreadyRetried) {
            console.warn('🔄 Local API unreachable. Switching to production:', PROD_API);
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
        return Promise.reject(error);
    }
);

export default apiClient;

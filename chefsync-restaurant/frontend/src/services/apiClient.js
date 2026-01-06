import axios from 'axios';
import { API_BASE_URL, TENANT_HEADER } from '../constants/api';

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

// Interceptor לשמירת Tenant ID בכל בקשה
apiClient.interceptors.request.use((config) => {
    const tenantId = getTenantId();
    const token = localStorage.getItem('authToken') || localStorage.getItem('admin_token');

    // 🔥 DEBUG - הדפס כל בקשה
    const fullUrl = config.baseURL + config.url;
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
    (error) => {
        // 🔥 DEBUG - הדפס שגיאות מפורטות
        console.group(`❌ API Error: ${error.config?.url}`);
        console.log('📤 Request Headers:', error.config?.headers);
        console.log('📥 Response Headers:', error.response?.headers);
        console.log('Status:', error.response?.status);
        console.log('Message:', error.response?.data?.message);
        console.log('Errors:', error.response?.data?.errors);
        console.log('Full Response:', error.response?.data);
        console.log('Raw Response Text:', typeof error.response?.data === 'string' ? error.response.data.substring(0, 500) : 'N/A');
        console.groupEnd();

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

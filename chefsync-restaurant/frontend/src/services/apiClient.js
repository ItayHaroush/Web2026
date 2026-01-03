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
    if (tenantId) {
        config.headers[TENANT_HEADER] = tenantId;
    }

    // שמירת Token אם קיים - תמיכה בשני Key names
    const token = localStorage.getItem('authToken') || localStorage.getItem('admin_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
});

// Interceptor לטיפול בשגיאות תגובה
apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
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

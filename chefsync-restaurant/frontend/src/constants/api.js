// מידע API ועירובים

const resolveApiBaseUrl = () => {
    const envValue = import.meta.env.VITE_API_URL?.trim();

    if (envValue) return envValue;

    if (import.meta.env.DEV) {
        console.warn('VITE_API_URL missing; using dev fallback http://localhost:8000/api');
        return 'http://localhost:8000/api';
    }

    throw new Error('VITE_API_URL is not set. Define it in the environment for production builds.');
};

export const API_BASE_URL = resolveApiBaseUrl();
export const TENANT_HEADER = 'X-Tenant-ID';

// נקודות סיום API
export const API_ENDPOINTS = {
    // תפריט
    GET_MENU: '/menu',

    // הזמנות
    CREATE_ORDER: '/orders',
    GET_ORDER: (id) => `/orders/${id}`,
    UPDATE_ORDER_STATUS: (id) => `/orders/${id}/status`,
    GET_ORDERS: '/orders',

    // מסעדה (ממשק מנהל)
    GET_RESTAURANT: '/restaurant',
    UPDATE_RESTAURANT: '/restaurant',

    // ניהול פריטי תפריט
    UPDATE_MENU_ITEM: (id) => `/menu-items/${id}`,

    // אימות
    LOGIN: '/auth/login',
    LOGOUT: '/auth/logout',
};

// סטטוסי הזמנה
export const ORDER_STATUS = {
    RECEIVED: 'received',      // התקבלה
    PREPARING: 'preparing',    // בהכנה
    READY: 'ready',           // מוכנה
    DELIVERED: 'delivered',   // נמסרה
};

export const ORDER_STATUS_LABELS = {
    received: 'התקבלה',
    preparing: 'בהכנה',
    ready: 'מוכנה',
    delivered: 'נמסרה',
};

export const ORDER_STATUS_COLORS = {
    received: 'bg-blue-100 text-blue-900',
    preparing: 'bg-yellow-100 text-yellow-900',
    ready: 'bg-green-100 text-green-900',
    delivered: 'bg-gray-100 text-gray-900',
};

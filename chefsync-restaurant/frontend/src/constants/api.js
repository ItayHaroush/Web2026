// מידע API ועירובים

const getEnv = (key, fallback = '') => {
    try {
        return import.meta?.env?.[key] ?? fallback;
    } catch {
        return fallback;
    }
};

const isLocalhostUrl = (value) => /:\/\/(localhost|127\.0\.0\.1)(?::\d+)?\b/i.test(value);

const detectNativeRuntime = () => {
    try {
        if (window?.Capacitor?.isNativePlatform?.()) return true;
        const platform = window?.Capacitor?.getPlatform?.();
        return !!platform && platform !== 'web';
    } catch {
        return false;
    }
};

export const LOCAL_API = String(getEnv('VITE_API_URL_LOCAL', 'http://localhost:8000/api')).trim();
export const PROD_API = String(getEnv('VITE_API_URL_PRODUCTION', 'https://api.chefsync.co.il/api')).trim();
export const IS_NATIVE_APP = detectNativeRuntime();

const resolveApiBaseUrl = () => {
    const explicitApi = String(getEnv('VITE_API_URL', '')).trim();
    const isDev = !!getEnv('DEV', false);
    const isProd = !!getEnv('PROD', false);

    if (explicitApi && (!isLocalhostUrl(explicitApi) || isDev)) {
        return explicitApi;
    }

    if (IS_NATIVE_APP || isProd) {
        return PROD_API;
    }

    if (isDev) {
        return LOCAL_API;
    }

    return PROD_API;
};

export const API_BASE_URL = resolveApiBaseUrl();

console.log('DEV=', import.meta.env.DEV);console.log('PROD=', import.meta.env.PROD);console.log('VITE_API_URL=', import.meta.env.VITE_API_URL);console.log('API_BASE_URL=', API_BASE_URL);
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
    PENDING: 'pending',        // ממתין
    AWAITING_PAYMENT: 'awaiting_payment', // B2C אשראי לפני אישור HYP
    RECEIVED: 'received',      // התקבלה
    PREPARING: 'preparing',    // בהכנה
    READY: 'ready',           // מוכנה
    DELIVERING: 'delivering',  // במשלוח
    DELIVERED: 'delivered',   // נמסרה
    CANCELLED: 'cancelled',   // בוטלה
};

export const ORDER_STATUS_LABELS = {
    pending: 'ממתין',
    awaiting_payment: 'ממתין לתשלום',
    received: 'התקבלה',
    preparing: 'בהכנה',
    ready: 'מוכנה',
    delivering: 'במשלוח',
    delivered: 'נמסרה',
    cancelled: 'בוטלה',
};

export const ORDER_STATUS_COLORS = {
    pending: 'bg-gray-100 text-gray-700',
    awaiting_payment: 'bg-orange-50 text-orange-800',
    received: 'bg-blue-100 text-blue-900',
    preparing: 'bg-yellow-100 text-yellow-900',
    ready: 'bg-green-100 text-green-900',
    delivering: 'bg-purple-100 text-purple-900',
    delivered: 'bg-gray-100 text-gray-900',
    cancelled: 'bg-red-100 text-red-900',
};

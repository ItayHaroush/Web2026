import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/apiClient';
import { getAdminFcmTokenIfPermitted } from '../services/fcm';

const isDev = import.meta.env.DEV;

/** הודעה קריאה מ-422 של Laravel (errors לפני message הגנרי באנגלית) */
function laravelApiErrorMessage(data, fallback) {
    if (!data || typeof data !== 'object') return fallback;
    const errs = data.errors;
    if (errs && typeof errs === 'object') {
        for (const v of Object.values(errs)) {
            if (Array.isArray(v) && v[0] != null && String(v[0]).trim()) {
                return String(v[0]).trim();
            }
        }
    }
    if (typeof data.message === 'string' && data.message.trim()) {
        const m = data.message.trim();
        if (m !== 'The given data was invalid.') return m;
    }
    return fallback;
}

/**
 * לאחר התחברות: אם הדפדפן כבר אישר התראות — מרענן טוקן FCM ורושם בשרת.
 * לא מבצע ביטול או מחיקה ב-logout — כדי לשמור על רציפות אחרי התחברות מחדש.
 * (לקוחות קצה משתמשים ב-customer_fcm_token + נפרדים — לא כאן.)
 */
async function syncAdminFcmWithBackend(user, bearerToken) {
    if (!user || !bearerToken) return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    try {
        const fcmToken = await getAdminFcmTokenIfPermitted();
        if (!fcmToken) return;
        const headers = { Authorization: `Bearer ${bearerToken}` };
        if (user.is_super_admin) {
            await api.post(
                '/super-admin/fcm/register',
                { token: fcmToken, device_label: 'super_admin' },
                { headers }
            );
        } else {
            await api.post(
                '/fcm/register',
                { token: fcmToken, device_label: 'tablet' },
                { headers }
            );
        }
    } catch (e) {
        console.warn('[FCM] sync after auth failed', e);
    }
}

const AdminAuthContext = createContext(null);

export function AdminAuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [token, setToken] = useState(localStorage.getItem('authToken') || localStorage.getItem('admin_token'));

    // Impersonation state
    const [impersonating, setImpersonating] = useState(() => {
        const saved = sessionStorage.getItem('impersonation');
        return saved ? JSON.parse(saved) : null;
    });

    useEffect(() => {
        if (token) {
            checkAuth();
        } else {
            setLoading(false);
        }
    }, [token]);

    const checkAuth = async () => {
        try {
            const response = await api.get('/auth/me', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.data.success) {
                setUser(response.data.user);
                setTenantFromUser(response.data.user);

                void syncAdminFcmWithBackend(response.data.user, token);
            } else {
                logout();
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            logout();
        } finally {
            setLoading(false);
        }
    };

    const setTenantFromUser = (userData) => {
        const activeImpersonation = sessionStorage.getItem('impersonation');
        if (activeImpersonation) {
            const { tenantId: impersonatedTenantId } = JSON.parse(activeImpersonation);
            if (impersonatedTenantId) {
                localStorage.setItem('tenantId', impersonatedTenantId);
                return;
            }
        }

        const tenantId = userData?.tenant_id || userData?.restaurant?.tenant_id;
        if (tenantId) {
            localStorage.setItem('tenantId', tenantId);
        }
    };

    const login = (newToken, userData) => {
        localStorage.setItem('authToken', newToken);
        localStorage.setItem('user', JSON.stringify(userData));
        setTenantFromUser(userData);
        setToken(newToken);
        setUser(userData);
    };

    const loginWithCredentials = async (email, password) => {
        try {
            const response = await api.post('/auth/login', { email, password });

            if (response.data.success) {
                const { token: newToken, user: userData } = response.data;
                login(newToken, userData);
                return { success: true };
            }
            return {
                success: false,
                message: laravelApiErrorMessage(response.data, 'שגיאה בהתחברות'),
            };
        } catch (error) {
            if (isDev) {
                console.error('Login failed:', error.response?.data ?? error);
            }
            const message = laravelApiErrorMessage(error.response?.data, 'שגיאה בהתחברות');
            return { success: false, message };
        }
    };

    const logout = async () => {
        try {
            if (token) {
                await api.post('/auth/logout', {}, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            }
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            localStorage.removeItem('authToken');
            localStorage.removeItem('user');
            setToken(null);
            setUser(null);
            /** לא מנקים fcmToken (localStorage) — הרשאת דפדפן נשארת; בהתחברות הבאה syncAdminFcmWithBackend ירשום מחדש מול המשתמש */
        }
    };

    const isOwner = () => user?.role === 'owner' || (user?.is_super_admin && !!impersonating);
    const isManager = () => ['owner', 'manager'].includes(user?.role) || (user?.is_super_admin && !!impersonating);
    const isEmployee = () => ['owner', 'manager', 'employee'].includes(user?.role) || (user?.is_super_admin && !!impersonating);
    const isDelivery = () => user?.role === 'delivery';
    const isSuperAdmin = () => user?.is_super_admin === true;
    const hasPosAccess = () => user?.pos_access === true || user?.role === 'owner' || (user?.is_super_admin && !!impersonating);

    const getAuthHeaders = useCallback(() => {
        if (!token) return {};
        return { Authorization: `Bearer ${token}` };
    }, [token]);

    const refreshUser = async () => {
        if (token) await checkAuth();
    };

    // Impersonation methods
    const startImpersonation = (restaurantId, tenantId, restaurantName) => {
        // Save original tenantId before switching
        const originalTenantId = localStorage.getItem('tenantId');
        const impersonationData = { restaurantId, tenantId, restaurantName, originalTenantId };

        sessionStorage.setItem('impersonation', JSON.stringify(impersonationData));
        localStorage.setItem('tenantId', tenantId);
        setImpersonating(impersonationData);
    };

    const stopImpersonation = () => {
        const saved = sessionStorage.getItem('impersonation');
        if (saved) {
            const data = JSON.parse(saved);
            if (data.originalTenantId) {
                localStorage.setItem('tenantId', data.originalTenantId);
            } else {
                localStorage.removeItem('tenantId');
            }
        }
        sessionStorage.removeItem('impersonation');
        setImpersonating(null);
    };

    const value = {
        user,
        token,
        loading,
        login,
        loginWithCredentials,
        logout,
        isOwner,
        isManager,
        isEmployee,
        isDelivery,
        isSuperAdmin,
        hasPosAccess,
        getAuthHeaders,
        refreshUser,
        isAuthenticated: !!user,
        impersonating,
        startImpersonation,
        stopImpersonation,
    };

    return (
        <AdminAuthContext.Provider value={value}>
            {children}
        </AdminAuthContext.Provider>
    );
}

export function useAdminAuth() {
    const context = useContext(AdminAuthContext);
    if (!context) {
        throw new Error('useAdminAuth must be used within AdminAuthProvider');
    }
    return context;
}

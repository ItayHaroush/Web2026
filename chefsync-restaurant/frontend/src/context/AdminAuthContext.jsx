import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/apiClient';

const AdminAuthContext = createContext(null);

export function AdminAuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [token, setToken] = useState(localStorage.getItem('authToken') || localStorage.getItem('admin_token'));

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

                // DEBUG: ודא שה-tenant נשמר
                console.log('👤 User loaded:', response.data.user);
                console.log('🏪 Tenant ID set:', localStorage.getItem('tenantId'));
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
        const tenantId = userData?.tenant_id || userData?.restaurant?.tenant_id;
        if (tenantId) {
            localStorage.setItem('tenantId', tenantId);
        }
    };

    const login = (newToken, userData) => {
        console.log('🔐 AdminAuth Login:', { token: newToken?.substring(0, 30) + '...', user: userData });
        localStorage.setItem('authToken', newToken);
        localStorage.setItem('user', JSON.stringify(userData));
        setTenantFromUser(userData);
        setToken(newToken);
        setUser(userData);
    };

    const loginWithCredentials = async (email, password) => {
        try {
            console.log('🔑 Attempting login for:', email);
            const response = await api.post('/auth/login', { email, password });
            console.log('✅ Login response:', response.data);

            if (response.data.success) {
                const { token: newToken, user: userData } = response.data;
                login(newToken, userData);
                return { success: true };
            }
            return { success: false, message: response.data.message };
        } catch (error) {
            console.error('❌ Login failed:', error.response?.data);
            const message = error.response?.data?.message || 'שגיאה בהתחברות';
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
        }
    };

    const isOwner = () => user?.role === 'owner';
    const isManager = () => ['owner', 'manager'].includes(user?.role);
    const isEmployee = () => ['owner', 'manager', 'employee'].includes(user?.role);
    const isDelivery = () => user?.role === 'delivery';
    const isSuperAdmin = () => user?.is_super_admin === true;

    const getAuthHeaders = () => ({
        Authorization: `Bearer ${token}`
    });

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
        getAuthHeaders,
        isAuthenticated: !!user,
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

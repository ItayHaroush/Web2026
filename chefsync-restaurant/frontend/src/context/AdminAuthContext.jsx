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

    const login = (newToken, userData) => {
        localStorage.setItem('authToken', newToken);
        localStorage.setItem('user', JSON.stringify(userData));
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
            return { success: false, message: response.data.message };
        } catch (error) {
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

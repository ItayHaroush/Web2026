import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

/**
 * Context להנהלת מידע המשתמש ותעודות אימות
 */

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [tenantId, setTenantId] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [role, setRole] = useState(null); // 'customer' או 'restaurant'

    /**
     * אתחול משתמש מ-localStorage בעת טעינת האפליקציה
     */
    useEffect(() => {
        let savedToken, savedTenant, savedRole;
        try {
            savedToken = localStorage.getItem('authToken');
            savedTenant = localStorage.getItem('tenantId');
            savedRole = localStorage.getItem('role');
        } catch (e) {
            console.error('LocalStorage access denied:', e);
        }

        // בדיקה אם יש tenant בURL
        const urlPath = window.location.pathname;
        const urlTenantMatch = urlPath.match(/^\/([^\/]+)\/(menu|cart|order-status)/);

        if (urlTenantMatch && urlTenantMatch[1]) {
            // אם יש tenant ב-URL, הוא המקור האמין (גם אם יש tenant ישן ב-localStorage)
            const urlTenant = urlTenantMatch[1];
            setTenantId(urlTenant);
            setRole('customer');
            setUser({ token: null });
            try {
                localStorage.setItem('tenantId', urlTenant);
                localStorage.setItem('role', 'customer');
            } catch (e) { console.error('LocalStorage write failed:', e); }
        } else if (savedToken && savedTenant) {
            setUser({ token: savedToken });
            setTenantId(savedTenant);
            setRole(savedRole || 'customer');
        } else if (savedTenant) {
            setTenantId(savedTenant);
            setRole(savedRole || 'customer');
            setUser({ token: null });
        }

        setIsLoading(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /**
     * כניסת לקוח חדש
     */
    const loginAsCustomer = useCallback((tenantID) => {
        setTenantId(tenantID);
        setRole('customer');
        setUser({ token: null }); // לקוח לא צריך token
        localStorage.setItem('tenantId', tenantID);
        localStorage.setItem('role', 'customer');
    }, []);

    /**
     * כניסת מנהל מסעדה
     */
    const loginAsRestaurant = useCallback((token, tenantID) => {
        setUser({ token });
        setTenantId(tenantID);
        setRole('restaurant');
        localStorage.setItem('authToken', token);
        localStorage.setItem('tenantId', tenantID);
        localStorage.setItem('role', 'restaurant');
    }, []);

    /**
     * יציאה
     */
    const logout = useCallback(() => {
        setUser(null);
        setTenantId(null);
        setRole(null);
        localStorage.removeItem('authToken');
        localStorage.removeItem('tenantId');
        localStorage.removeItem('role');
        // ניווט לדף הבית
        window.location.href = '/';
    }, []);

    const value = {
        user,
        tenantId,
        role,
        isLoading,
        loginAsCustomer,
        loginAsRestaurant,
        logout,
        isAuthenticated: !!user || !!tenantId,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

/**
 * Hook לשימוש ב-Auth Context
 */
export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth חייב להיות בתוך AuthProvider');
    }
    return context;
}

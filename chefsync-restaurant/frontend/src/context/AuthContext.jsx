import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { API_BASE_URL } from '../constants/api';
import { isPlatformHost, normalizeHostname } from '../utils/platformHosts';

/**
 * Context להנהלת מידע המשתמש ותעודות אימות
 */

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [tenantId, setTenantId] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [role, setRole] = useState(null);
    const [isCustomDomain, setIsCustomDomain] = useState(false);
    const [customDomainError, setCustomDomainError] = useState(false);
    const [customDomainResolved, setCustomDomainResolved] = useState(false);
    const [customDomainHost, setCustomDomainHost] = useState(null);

    useEffect(() => {
        let cancelled = false;

        async function bootstrap() {
            const host = normalizeHostname(window.location.hostname);
            setCustomDomainHost(host);

            try {
                if (!isPlatformHost(host)) {
                    setIsCustomDomain(true);
                    const res = await fetch(
                        `${API_BASE_URL}/public/resolve-host?host=${encodeURIComponent(host)}`,
                        { headers: { Accept: 'application/json' } }
                    );

                    if (!res.ok) {
                        if (!cancelled) {
                            setCustomDomainError(true);
                            setCustomDomainResolved(true);
                            setIsLoading(false);
                        }
                        return;
                    }

                    const json = await res.json();
                    const tid = json?.data?.tenant_id;
                    if (!json?.success || !tid) {
                        if (!cancelled) {
                            setCustomDomainError(true);
                            setCustomDomainResolved(true);
                            setIsLoading(false);
                        }
                        return;
                    }

                    if (!cancelled) {
                        setTenantId(tid);
                        setRole('customer');
                        setUser({ token: null });
                        try {
                            localStorage.setItem('tenantId', tid);
                            localStorage.setItem('role', 'customer');
                            sessionStorage.setItem('customDomainHost', host);
                        } catch (e) {
                            console.error('LocalStorage write failed:', e);
                        }
                        setCustomDomainResolved(true);
                        setIsLoading(false);
                    }
                    return;
                }

                setIsCustomDomain(false);
                setCustomDomainResolved(true);

                let savedToken, savedTenant, savedRole;
                try {
                    savedToken = localStorage.getItem('authToken');
                    savedTenant = localStorage.getItem('tenantId');
                    savedRole = localStorage.getItem('role');
                } catch (e) {
                    console.error('LocalStorage access denied:', e);
                }

                const urlPath = window.location.pathname;
                const urlTenantMatch = urlPath.match(/^\/([^\/]+)\/(menu|cart|order-status)/);

                if (urlTenantMatch && urlTenantMatch[1]) {
                    const urlTenant = urlTenantMatch[1];
                    if (!cancelled) {
                        setTenantId(urlTenant);
                        setRole('customer');
                        setUser({ token: null });
                        try {
                            localStorage.setItem('tenantId', urlTenant);
                            localStorage.setItem('role', 'customer');
                        } catch (e) {
                            console.error('LocalStorage write failed:', e);
                        }
                    }
                } else if (savedToken && savedTenant) {
                    if (!cancelled) {
                        setUser({ token: savedToken });
                        setTenantId(savedTenant);
                        setRole(savedRole || 'customer');
                    }
                } else if (savedTenant) {
                    if (!cancelled) {
                        setTenantId(savedTenant);
                        setRole(savedRole || 'customer');
                        setUser({ token: null });
                    }
                }

                if (!cancelled) {
                    setIsLoading(false);
                }
            } catch (err) {
                console.error('Auth bootstrap failed:', err);
                if (!cancelled) {
                    if (!isPlatformHost(host)) {
                        setIsCustomDomain(true);
                        setCustomDomainError(true);
                    }
                    setCustomDomainResolved(true);
                    setIsLoading(false);
                }
            }
        }

        bootstrap();

        return () => {
            cancelled = true;
        };
    }, []);

    const loginAsCustomer = useCallback((tenantID) => {
        setTenantId(tenantID);
        setRole('customer');
        setUser({ token: null });
        localStorage.setItem('tenantId', tenantID);
        localStorage.setItem('role', 'customer');
    }, []);

    const loginAsRestaurant = useCallback((token, tenantID) => {
        setUser({ token });
        setTenantId(tenantID);
        setRole('restaurant');
        localStorage.setItem('authToken', token);
        localStorage.setItem('tenantId', tenantID);
        localStorage.setItem('role', 'restaurant');
    }, []);

    const logout = useCallback(() => {
        setUser(null);
        setTenantId(null);
        setRole(null);
        localStorage.removeItem('authToken');
        localStorage.removeItem('tenantId');
        localStorage.removeItem('role');
        window.location.href = '/';
    }, []);

    const value = {
        user,
        tenantId,
        role,
        isLoading,
        isCustomDomain,
        customDomainError,
        customDomainResolved,
        customDomainHost,
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

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth חייב להיות בתוך AuthProvider');
    }
    return context;
}

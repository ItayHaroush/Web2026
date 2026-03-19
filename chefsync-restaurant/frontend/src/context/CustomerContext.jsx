import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import apiClient, { getPublicTenantId } from '../services/apiClient';
import { flushPendingCustomerFcmRegistration, unregisterCustomerPush } from '../services/customerPwaApi';
import { clearStoredCustomerFcmToken, getStoredCustomerFcmToken } from '../services/fcm';

/**
 * Context לניהול לקוח מזוהה (Recognized/Registered)
 * מנהל טוקן לקוח, פרופיל, ומצב חיבור
 */

const CustomerContext = createContext();

const CUSTOMER_TOKEN_KEY = 'customer_token';
const CUSTOMER_DATA_KEY = 'customer_data';

function persistCustomerData(data) {
    localStorage.setItem(CUSTOMER_DATA_KEY, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent('customer_data_changed', { detail: data }));
}

export function CustomerProvider({ children }) {
    const [customer, setCustomer] = useState(null);
    const [customerToken, setCustomerToken] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);

    // אתחול מ-localStorage
    useEffect(() => {
        try {
            const savedToken = localStorage.getItem(CUSTOMER_TOKEN_KEY);
            const savedData = localStorage.getItem(CUSTOMER_DATA_KEY);

            if (savedToken) {
                setCustomerToken(savedToken);
                if (savedData) {
                    setCustomer(JSON.parse(savedData));
                }
                // וידוא טוקן מול השרת
                verifyToken(savedToken);
            }
        } catch (e) {
            console.error('Failed to load customer data:', e);
        }
        setLoading(false);
    }, []);

    const verifyToken = async (token) => {
        try {
            const response = await apiClient.get('/customer/me', {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (response.data?.success) {
                const data = response.data.data;
                setCustomer(data);
                persistCustomerData(data);
                flushPendingCustomerFcmRegistration(apiClient, token);
            }
        } catch (err) {
            if (err?.response?.status === 401) {
                // טוקן פג — נקה
                clearCustomer();
            }
        }
    };

    /**
     * בדיקה אם טלפון שייך ללקוח קיים (אחרי OTP)
     */
    const checkPhone = useCallback(async (phone) => {
        try {
            const response = await apiClient.post('/customer/auth/check-phone', { phone });
            return response.data; // { success, exists, customer_name }
        } catch (err) {
            return { success: false, exists: false };
        }
    }, []);

    /**
     * התחברות עם טלפון + OTP (אחרי אימות מוצלח)
     * name אופציונלי — נדרש רק עבור לקוחות חדשים
     */
    const loginWithPhone = useCallback(async (phone, name) => {
        try {
            const payload = { phone };
            if (name) payload.name = name;
            const response = await apiClient.post('/customer/auth/phone', payload);
            if (response.data?.success) {
                const { customer: customerData, token } = response.data.data;
                setCustomer(customerData);
                setCustomerToken(token);
                localStorage.setItem(CUSTOMER_TOKEN_KEY, token);
                persistCustomerData(customerData);
                flushPendingCustomerFcmRegistration(apiClient, token);
                return { success: true, customer: customerData };
            }
            return { success: false, message: response.data?.message };
        } catch (err) {
            return { success: false, message: err?.response?.data?.message || 'שגיאה בהתחברות' };
        }
    }, []);

    /**
     * התנתקות
     */
    const logout = useCallback(async () => {
        if (customerToken) {
            const fcmTok = getStoredCustomerFcmToken();
            if (fcmTok) {
                await unregisterCustomerPush(apiClient, {
                    tenantId: getPublicTenantId() || undefined,
                    customerToken,
                    token: fcmTok,
                });
            }
            clearStoredCustomerFcmToken();
            try {
                await apiClient.post('/customer/logout', {}, {
                    headers: { Authorization: `Bearer ${customerToken}` },
                });
            } catch { /* ignore */ }
        }
        clearCustomer();
    }, [customerToken]);

    const clearCustomer = () => {
        setCustomer(null);
        setCustomerToken(null);
        localStorage.removeItem(CUSTOMER_TOKEN_KEY);
        localStorage.removeItem(CUSTOMER_DATA_KEY);
    };

    /**
     * הגדרת סיסמה ללקוח (דורש חיבור כלקוח — לאחר התחברות ב-SMS)
     */
    const setPassword = useCallback(async (password, passwordConfirmation, currentPassword = null) => {
        if (!customerToken) return { success: false, message: 'לא מחובר' };
        try {
            const payload = {
                password,
                password_confirmation: passwordConfirmation,
            };
            if (currentPassword != null && String(currentPassword).length > 0) {
                payload.current_password = currentPassword;
            }
            const response = await apiClient.post('/customer/password', payload, {
                headers: { Authorization: `Bearer ${customerToken}` },
            });
            if (response.data?.success) {
                const updated = { ...customer, is_registered: true, has_pin: true };
                setCustomer(updated);
                persistCustomerData(updated);
                return { success: true };
            }
            return { success: false, message: response.data?.message };
        } catch (err) {
            const msg = err?.response?.data?.message;
            return { success: false, message: msg || err?.response?.data?.errors?.password?.[0] || 'שגיאה בשמירת סיסמה' };
        }
    }, [customerToken, customer]);

    /**
     * התחברות עם טלפון + סיסמה (ללא OTP — למי שהגדיר סיסמה)
     */
    const loginWithPassword = useCallback(async (phone, password) => {
        try {
            const response = await apiClient.post('/customer/auth/password', { phone, password });
            if (response.data?.success) {
                const { customer: customerData, token } = response.data.data;
                setCustomer(customerData);
                setCustomerToken(token);
                localStorage.setItem(CUSTOMER_TOKEN_KEY, token);
                persistCustomerData(customerData);
                flushPendingCustomerFcmRegistration(apiClient, token);
                return { success: true, customer: customerData };
            }
            return { success: false, message: response.data?.message };
        } catch (err) {
            return { success: false, message: err?.response?.data?.message || 'מספר טלפון או סיסמה שגויים' };
        }
    }, []);

    /**
     * התחברות עם Google ID Token
     */
    const loginWithGoogle = useCallback(async (idToken) => {
        try {
            const response = await apiClient.post('/customer/auth/google', { id_token: idToken });
            if (response.data?.success) {
                const { customer: customerData, token } = response.data.data;
                setCustomer(customerData);
                setCustomerToken(token);
                localStorage.setItem(CUSTOMER_TOKEN_KEY, token);
                persistCustomerData(customerData);
                flushPendingCustomerFcmRegistration(apiClient, token);
                return { success: true, customer: customerData };
            }
            return { success: false, message: response.data?.message };
        } catch (err) {
            return { success: false, message: err?.response?.data?.message || 'שגיאה בהתחברות עם Google' };
        }
    }, []);

    /**
     * עדכון פרטי לקוח
     */
    const updateProfile = useCallback(async (data) => {
        if (!customerToken) return { success: false };
        try {
            const response = await apiClient.put('/customer/me', data, {
                headers: { Authorization: `Bearer ${customerToken}` },
            });
            if (response.data?.success) {
                const updated = response.data.data;
                setCustomer(updated);
                persistCustomerData(updated);
                return {
                    success: true,
                    customer: updated,
                    message: response.data?.message,
                    email_verification_sent: response.data?.email_verification_sent,
                };
            }
            return { success: false };
        } catch (err) {
            return { success: false, message: err?.response?.data?.message || 'שגיאה' };
        }
    }, [customerToken]);

    const [isOrderHistoryOpen, setIsOrderHistoryOpen] = useState(false);

    const openUserModal = useCallback(() => setIsUserModalOpen(true), []);
    const closeUserModal = useCallback(() => setIsUserModalOpen(false), []);
    const openOrderHistory = useCallback(() => setIsOrderHistoryOpen(true), []);
    const closeOrderHistory = useCallback(() => setIsOrderHistoryOpen(false), []);

    const isRecognized = !!customer;
    const isRegistered = !!customer?.is_registered;

    const value = {
        customer,
        customerToken,
        loading,
        isRecognized,
        isRegistered,
        checkPhone,
        loginWithPhone,
        loginWithPassword,
        loginWithGoogle,
        setPassword,
        logout,
        updateProfile,
        clearCustomer,
        isUserModalOpen,
        openUserModal,
        closeUserModal,
        isOrderHistoryOpen,
        openOrderHistory,
        closeOrderHistory,
    };

    return (
        <CustomerContext.Provider value={value}>
            {children}
        </CustomerContext.Provider>
    );
}

export function useCustomer() {
    const context = useContext(CustomerContext);
    if (!context) {
        throw new Error('useCustomer חייב להיות בתוך CustomerProvider');
    }
    return context;
}

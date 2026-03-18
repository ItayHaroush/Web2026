import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import apiClient from '../services/apiClient';

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
     * הגדרת PIN ללקוח (דורש חיבור כלקוח)
     */
    const setPin = useCallback(async (pin) => {
        if (!customerToken) return { success: false, message: 'לא מחובר' };
        try {
            const response = await apiClient.post('/customer/pin', { pin }, {
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
            return { success: false, message: err?.response?.data?.message || 'שגיאה בשמירת PIN' };
        }
    }, [customerToken, customer]);

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
                return { success: true, customer: updated };
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
        loginWithGoogle,
        setPin,
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

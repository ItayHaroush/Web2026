import axios from 'axios';
import apiClient from './apiClient';

/**
 * שירות קיוסק - ניהול ותצוגה ציבורית
 */

// Admin: רשימת כל הקיוסקים
export const getKiosks = async () => {
    const response = await apiClient.get('/admin/kiosks');
    return response.data;
};

// Admin: יצירת קיוסק חדש
export const createKiosk = async (data) => {
    const response = await apiClient.post('/admin/kiosks', data);
    return response.data;
};

// Admin: עדכון קיוסק
export const updateKiosk = async (id, data) => {
    const response = await apiClient.put(`/admin/kiosks/${id}`, data);
    return response.data;
};

// Admin: מחיקת קיוסק
export const deleteKiosk = async (id) => {
    const response = await apiClient.delete(`/admin/kiosks/${id}`);
    return response.data;
};

// Admin: הפעלה/השבתה
export const toggleKiosk = async (id) => {
    const response = await apiClient.post(`/admin/kiosks/${id}/toggle`);
    return response.data;
};

// Admin: חידוש קישור
export const regenerateKioskToken = async (id) => {
    const response = await apiClient.post(`/admin/kiosks/${id}/regenerate-token`);
    return response.data;
};

// Admin: שמירת שולחנות
export const saveKioskTables = async (id, tables) => {
    const response = await apiClient.post(`/admin/kiosks/${id}/tables`, { tables });
    return response.data;
};

// Public: תפריט קיוסק (ללא אימות)
export const getKioskMenu = async (token) => {
    const baseURL = apiClient.defaults.baseURL;
    const response = await axios.get(`${baseURL}/kiosk/${token}/menu`, {
        headers: { 'Accept': 'application/json' },
        transformResponse: [(data) => {
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
        }],
    });
    return response.data;
};

// Public: שליחת הזמנה מקיוסק (ללא אימות)
export const placeKioskOrder = async (token, orderData) => {
    const baseURL = apiClient.defaults.baseURL;
    const response = await axios.post(`${baseURL}/kiosk/${token}/order`, orderData, {
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        },
        transformResponse: [(data) => {
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
        }],
    });
    return response.data;
};

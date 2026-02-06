import axios from 'axios';
import apiClient from './apiClient';

/**
 * שירות מסכי תצוגה - ניהול ותצוגה ציבורית
 */

// Admin: רשימת כל המסכים
export const getScreens = async () => {
    const response = await apiClient.get('/admin/display-screens');
    return response.data;
};

// Admin: יצירת מסך חדש
export const createScreen = async (data) => {
    const response = await apiClient.post('/admin/display-screens', data);
    return response.data;
};

// Admin: עדכון הגדרות מסך
export const updateScreen = async (id, data) => {
    const response = await apiClient.put(`/admin/display-screens/${id}`, data);
    return response.data;
};

// Admin: מחיקת מסך
export const deleteScreen = async (id) => {
    const response = await apiClient.delete(`/admin/display-screens/${id}`);
    return response.data;
};

// Admin: הפעלה/השבתה
export const toggleScreen = async (id) => {
    const response = await apiClient.post(`/admin/display-screens/${id}/toggle`);
    return response.data;
};

// Admin: חידוש קישור
export const regenerateToken = async (id) => {
    const response = await apiClient.post(`/admin/display-screens/${id}/regenerate-token`);
    return response.data;
};

// Admin: קבלת פריטים נוכחיים של מסך
export const getScreenItems = async (id) => {
    const response = await apiClient.get(`/admin/display-screens/${id}/items`);
    return response.data;
};

// Admin: עדכון בחירת פריטים
export const updateScreenItems = async (id, items) => {
    const response = await apiClient.post(`/admin/display-screens/${id}/items`, { items });
    return response.data;
};

// Admin: קבלת כל פריטי התפריט (לבחירה)
export const getMenuItemsForSelection = async () => {
    const response = await apiClient.get('/admin/menu-items');
    return response.data;
};

// Public: תוכן מסך תצוגה (ללא אימות, ללא tenant header)
export const getViewerContent = async (token) => {
    const baseURL = apiClient.defaults.baseURL;
    const response = await axios.get(`${baseURL}/screen/${token}`, {
        headers: { 'Accept': 'application/json' },
        transformResponse: [(data) => {
            // נקה אזהרות PHP שמגיעות לפני ה-JSON
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

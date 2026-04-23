import apiClient from './apiClient';
import { API_BASE_URL } from '../constants/api';

/**
 * קבל רשימת כל המסעדות
 */
export const getAllRestaurants = async (city = null) => {
    try {
        const params = {};
        if (city) params.city = city;

        // 🔥 שימוש ב-apiClient (עם interceptors)
        const response = await apiClient.get(`/restaurants`, {
            params
        });

        return response.data;
    } catch (error) {
        console.error('Error fetching restaurants:', error);
        throw error;
    }
};

/**
 * רשימת ערים מה-API (טבלת cities) — כולל ערים בלי מסעדות, למיון/סינון נכון בעמוד הבית
 */
export const getCities = async () => {
    try {
        const response = await apiClient.get('/cities');
        const raw = response.data?.data || response.data?.cities || [];
        if (Array.isArray(raw) && raw.length > 0) {
            return raw;
        }
    } catch (error) {
        console.error('Error fetching cities:', error);
    }
    // גיבוי: ערים שמופיעות ממסעדות בלבד (התנהגות ישנה)
    try {
        const r = await getAllRestaurants();
        if (!r?.data?.length) return [];
        const names = [...new Set(r.data.map((x) => x.city).filter(Boolean))];
        return names.sort().map((name) => ({ name, hebrew_name: name }));
    } catch (e) {
        console.error('getCities fallback failed:', e);
        return [];
    }
};

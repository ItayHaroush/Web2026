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
 * רשימת ערים מה-API (טבלת cities). לעמוד הבית: filterCitiesWithRestaurants;
 * בטפסי הרשמה/אזורי משלוח: הרשימה המלאה.
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

/**
 * נרמול לצורך השוואת שם עיר (מסעדה ↔ טבלת cities)
 */
const normalizeForCityMatch = (s) => {
    if (s == null || s === '') return '';
    let t = String(s).trim().replace(/\s+/g, ' ');
    t = t.replace(/קריית/g, 'קרית');
    if (!/[\u0590-\u05FF]/.test(t)) t = t.toLowerCase();
    return t;
};

export const restaurantCityMatchesRow = (restaurantCity, row) => {
    if (!row) return false;
    const rc = restaurantCity;
    if (rc == null || rc === '') return false;
    if (normalizeForCityMatch(rc) === normalizeForCityMatch(row.name)) return true;
    if (row.hebrew_name && normalizeForCityMatch(rc) === normalizeForCityMatch(row.hebrew_name)) {
        return true;
    }
    return false;
};

/**
 * ערים שבהן יש לפחות מסעדה אחת — לעמוד הבית
 */
export const filterCitiesWithRestaurants = (cities, restaurants) => {
    if (!Array.isArray(cities) || !Array.isArray(restaurants)) return [];
    return cities.filter((c) => {
        if (!c) return false;
        return restaurants.some((r) => r && restaurantCityMatchesRow(r.city, c));
    });
};

/**
 * מסנן מסעדות לפי עיר (value ב-select = cities.name)
 */
export const filterRestaurantsBySelectedCity = (restaurants, selectedCityName, citiesLookup) => {
    if (!selectedCityName || !Array.isArray(restaurants)) return restaurants;
    const row = (citiesLookup || []).find((c) => c && c.name === selectedCityName);
    if (row) {
        return restaurants.filter((r) => restaurantCityMatchesRow(r?.city, row));
    }
    return restaurants.filter(
        (r) =>
            r?.city === selectedCityName ||
            normalizeForCityMatch(r?.city) === normalizeForCityMatch(selectedCityName)
    );
};

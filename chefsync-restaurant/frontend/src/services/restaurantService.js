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
 * קבל רשימת ערים ייחודיות
 */
export const getCities = async () => {
    try {
        const response = await getAllRestaurants();
        if (!response || !response.data) {
            console.error('Invalid response:', response);
            return [];
        }
        const cities = [...new Set(response.data.map(r => r.city))];
        return cities.sort();
    } catch (error) {
        console.error('Error fetching cities:', error);
        return [];
    }
};

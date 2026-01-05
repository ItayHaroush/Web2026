import axios from 'axios';
import { API_BASE_URL } from '../constants/api';

/**
 * קבל רשימת כל המסעדות
 */
export const getAllRestaurants = async (city = null) => {
    try {
        const params = {};
        if (city) params.city = city;

        const response = await axios.get(`${API_BASE_URL}/restaurants`, {
            params,
            transformResponse: [(data) => {
                // נקה את התגובה מ-HTML warnings של PHP
                if (typeof data === 'string') {
                    // חפש את תחילת ה-JSON (סוגריים מסולסלים)
                    const jsonStart = data.indexOf('{');
                    if (jsonStart > 0) {
                        data = data.substring(jsonStart);
                    }
                }
                return JSON.parse(data);
            }]
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

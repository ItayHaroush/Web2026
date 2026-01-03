import apiClient from './apiClient';
import { API_ENDPOINTS } from '../constants/api';

/**
 * שירות לניהול תפריט המסעדה
 * משך נתונים מהשרת עם פילוג לפי קטגוריה
 */

class MenuService {
    /**
     * קבלת תפריט מלא של המסעדה הנוכחית
     * @returns {Promise} - מערך של קטגוריות עם פריטים
     */
    async getMenu() {
        try {
            const response = await apiClient.get(API_ENDPOINTS.GET_MENU);
            // ה-API מחזיר {success: true, data: [...]}
            if (response.data && response.data.data) {
                return response.data.data;
            }
            return response.data;
        } catch (error) {
            console.error('שגיאה בטעינת התפריט:', error);
            throw error;
        }
    }

    /**
     * עדכון סטטוס זמינות של פריט תפריט
     * @param {string|number} itemId - מזהה הפריט
     * @param {boolean} isAvailable - זמין או לא
     * @returns {Promise}
     */
    async updateItemAvailability(itemId, isAvailable) {
        try {
            const response = await apiClient.patch(
                API_ENDPOINTS.UPDATE_MENU_ITEM(itemId),
                { is_available: isAvailable }
            );
            return response.data;
        } catch (error) {
            console.error('שגיאה בעדכון סטטוס הפריט:', error);
            throw error;
        }
    }
}

export default new MenuService();

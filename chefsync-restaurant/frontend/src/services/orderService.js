import apiClient from './apiClient';
import { API_ENDPOINTS } from '../constants/api';

/**
 * שירות לניהול פעולות הזמנות
 * קישורים: API Tenant-Aware + עדכונים לוקליים
 */

class OrderService {
    /**
     * יצירת הזמנה חדשה
     * @param {Object} orderData - פרטי ההזמנה
     * @returns {Promise}
     */
    async createOrder(orderData) {
        try {
            const response = await apiClient.post(API_ENDPOINTS.CREATE_ORDER, orderData);
            return response.data;
        } catch (error) {
            console.error('שגיאה ביצירת הזמנה:', error);
            throw error;
        }
    }

    /**
     * קבלת פרטי הזמנה לפי ID
     * @param {string|number} orderId - מזהה ההזמנה
     * @returns {Promise}
     */
    async getOrder(orderId) {
        try {
            const response = await apiClient.get(API_ENDPOINTS.GET_ORDER(orderId));
            return response.data;
        } catch (error) {
            console.error('שגיאה בקבלת פרטי הזמנה:', error);
            throw error;
        }
    }

    /**
     * קבלת כל ההזמנות של הלקוח/מסעדה
     * @returns {Promise}
     */
    async getOrders() {
        try {
            const response = await apiClient.get(API_ENDPOINTS.GET_ORDERS);
            return response.data;
        } catch (error) {
            console.error('שגיאה בקבלת הזמנות:', error);
            throw error;
        }
    }

    /**
     * בדיקה האם משלוח זמין למיקום נתון
     * @param {number} lat - קואורדינטת latitude
     * @param {number} lng - קואורדינטת longitude
     * @returns {Promise<{available: boolean, zone: object|null, fee: number, distance_km: number|null, message: string}>}
     */
    async checkDeliveryZone(lat, lng) {
        try {
            const response = await apiClient.post('/check-delivery-zone', {
                delivery_lat: lat,
                delivery_lng: lng,
            });
            return response.data;
        } catch (error) {
            console.error('שגיאה בבדיקת אזור משלוח:', error);
            throw error;
        }
    }

    /**
     * עדכון סטטוס הזמנה
     * @param {string|number} orderId - מזהה ההזמנה
     * @param {string} status - הסטטוס החדש
     * @returns {Promise}
     */
    async updateOrderStatus(orderId, status) {
        try {
            const response = await apiClient.patch(
                API_ENDPOINTS.UPDATE_ORDER_STATUS(orderId),
                { status }
            );
            return response.data;
        } catch (error) {
            console.error('שגיאה בעדכון סטטוס הזמנה:', error);
            throw error;
        }
    }
}

export default new OrderService();

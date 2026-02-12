import apiClient from './apiClient';

/**
 * שירות לניהול מבצעים
 * Admin CRUD + Public eligibility check
 */

class PromotionService {
    // ============================================
    // Admin CRUD
    // ============================================

    async getPromotions() {
        try {
            const response = await apiClient.get('/admin/promotions');
            return response.data;
        } catch (error) {
            console.error('שגיאה בטעינת מבצעים:', error);
            throw error;
        }
    }

    async createPromotion(data) {
        try {
            const response = await apiClient.post('/admin/promotions', data);
            return response.data;
        } catch (error) {
            console.error('שגיאה ביצירת מבצע:', error);
            throw error;
        }
    }

    async getPromotion(id) {
        try {
            const response = await apiClient.get(`/admin/promotions/${id}`);
            return response.data;
        } catch (error) {
            console.error('שגיאה בטעינת מבצע:', error);
            throw error;
        }
    }

    async updatePromotion(id, data) {
        try {
            const response = await apiClient.put(`/admin/promotions/${id}`, data);
            return response.data;
        } catch (error) {
            console.error('שגיאה בעדכון מבצע:', error);
            throw error;
        }
    }

    async deletePromotion(id) {
        try {
            const response = await apiClient.delete(`/admin/promotions/${id}`);
            return response.data;
        } catch (error) {
            console.error('שגיאה במחיקת מבצע:', error);
            throw error;
        }
    }

    async togglePromotion(id) {
        try {
            const response = await apiClient.patch(`/admin/promotions/${id}/toggle`);
            return response.data;
        } catch (error) {
            console.error('שגיאה בשינוי סטטוס מבצע:', error);
            throw error;
        }
    }

    // ============================================
    // Public (Customer)
    // ============================================

    async getActivePromotions() {
        try {
            const response = await apiClient.get('/promotions/active');
            return response.data;
        } catch (error) {
            console.error('שגיאה בטעינת מבצעים פעילים:', error);
            throw error;
        }
    }

    async checkEligibility(cartItems) {
        try {
            const response = await apiClient.post('/promotions/check', { items: cartItems });
            return response.data;
        } catch (error) {
            console.error('שגיאה בבדיקת זכאות למבצע:', error);
            throw error;
        }
    }
}

export default new PromotionService();

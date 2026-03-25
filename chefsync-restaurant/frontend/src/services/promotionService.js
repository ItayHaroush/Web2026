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

    _buildFormData(data) {
        const fd = new FormData();
        const { image, rules, rewards, active_days, ...scalars } = data;
        Object.entries(scalars).forEach(([k, v]) => {
            if (v === null || v === undefined || v === '') return;
            fd.append(k, typeof v === 'boolean' ? (v ? '1' : '0') : v);
        });
        if (image instanceof File) fd.append('image', image);
        if (data.remove_image) fd.append('remove_image', '1');
        if (active_days && Array.isArray(active_days)) {
            active_days.forEach((d, i) => fd.append(`active_days[${i}]`, d));
        }
        const validRules = (rules || []).filter((r) => {
            const cid = r.required_category_id;
            return cid !== '' && cid !== null && cid !== undefined && Number(cid) > 0;
        });
        validRules.forEach((r, i) => {
            fd.append(`rules[${i}][required_category_id]`, r.required_category_id);
            fd.append(`rules[${i}][min_quantity]`, r.min_quantity);
        });
        (rewards || []).forEach((r, i) => {
            fd.append(`rewards[${i}][reward_type]`, r.reward_type);
            if (r.reward_category_id) fd.append(`rewards[${i}][reward_category_id]`, r.reward_category_id);
            if (r.reward_menu_item_id) fd.append(`rewards[${i}][reward_menu_item_id]`, r.reward_menu_item_id);
            if (r.reward_value !== '' && r.reward_value !== null && r.reward_value !== undefined) fd.append(`rewards[${i}][reward_value]`, r.reward_value);
            if (r.max_selectable) fd.append(`rewards[${i}][max_selectable]`, r.max_selectable);
            const scope = r.discount_scope || 'whole_cart';
            if (r.reward_type === 'discount_percent' || r.reward_type === 'discount_fixed') {
                fd.append(`rewards[${i}][discount_scope]`, scope);
                if (scope === 'selected_items' && Array.isArray(r.discount_menu_item_ids)) {
                    r.discount_menu_item_ids.forEach((id, j) => {
                        if (id !== '' && id != null) fd.append(`rewards[${i}][discount_menu_item_ids][${j}]`, id);
                    });
                }
            }
        });
        return fd;
    }

    async createPromotion(data) {
        try {
            const fd = this._buildFormData(data);
            // אל תגדיר Content-Type ידנית — axios מוסיף boundary ל־FormData
            const response = await apiClient.post('/admin/promotions', fd);
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
            const fd = this._buildFormData(data);
            fd.append('_method', 'PUT');
            const response = await apiClient.post(`/admin/promotions/${id}`, fd);
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

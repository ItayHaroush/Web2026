import apiClient from './apiClient';

/**
 * שירות חגים ישראליים
 */
class HolidayService {
    // ============================================
    // Super Admin — ניהול חגים
    // ============================================

    async getHolidays(year) {
        const params = year ? { year } : {};
        const res = await apiClient.get('/super-admin/holidays', { params });
        return res.data;
    }

    async createHoliday(data) {
        const res = await apiClient.post('/super-admin/holidays', data);
        return res.data;
    }

    async updateHoliday(id, data) {
        const res = await apiClient.put(`/super-admin/holidays/${id}`, data);
        return res.data;
    }

    async deleteHoliday(id) {
        const res = await apiClient.delete(`/super-admin/holidays/${id}`);
        return res.data;
    }

    async getHolidayResponses(id) {
        const res = await apiClient.get(`/super-admin/holidays/${id}/responses`);
        return res.data;
    }

    async getAvailableHolidays() {
        const res = await apiClient.get('/super-admin/holidays/available');
        return res.data;
    }

    async seedHolidays(selectedIndices = null) {
        const res = await apiClient.post('/super-admin/holidays/seed', {
            selected: selectedIndices,
        });
        return res.data;
    }

    async notifyRestaurants(id) {
        const res = await apiClient.post(`/super-admin/holidays/${id}/notify`);
        return res.data;
    }

    // ============================================
    // Admin — תגובת מסעדה לחגים
    // ============================================

    async getUpcomingHolidays() {
        const res = await apiClient.get('/admin/holidays/upcoming');
        return res.data;
    }

    async respondToHoliday(holidayId, data) {
        const res = await apiClient.post(`/admin/holidays/${holidayId}/respond`, data);
        return res.data;
    }
}

export default new HolidayService();

import apiClient from './apiClient';

/**
 * שירות הודעות כלליות לפלטפורמה
 */
class AnnouncementService {
    // ============================================
    // Super Admin CRUD
    // ============================================

    async getAnnouncements(page = 1) {
        const res = await apiClient.get('/super-admin/announcements', { params: { page } });
        return res.data;
    }

    async createAnnouncement(data) {
        const fd = this._buildFormData(data);
        const res = await apiClient.post('/super-admin/announcements', fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return res.data;
    }

    async updateAnnouncement(id, data) {
        const fd = this._buildFormData(data);
        fd.append('_method', 'PUT');
        const res = await apiClient.post(`/super-admin/announcements/${id}`, fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return res.data;
    }

    async deleteAnnouncement(id) {
        const res = await apiClient.delete(`/super-admin/announcements/${id}`);
        return res.data;
    }

    async toggleAnnouncement(id) {
        const res = await apiClient.patch(`/super-admin/announcements/${id}/toggle`);
        return res.data;
    }

    // ============================================
    // Public — הודעות פעילות (ללקוחות)
    // ============================================

    async getActiveAnnouncements() {
        const res = await apiClient.get('/platform/announcements/active');
        return res.data;
    }

    _buildFormData(data) {
        const fd = new FormData();
        const { image, ...scalars } = data;
        Object.entries(scalars).forEach(([k, v]) => {
            if (v === null || v === undefined || v === '') return;
            if (typeof v === 'boolean') {
                fd.append(k, v ? '1' : '0');
            } else {
                fd.append(k, v);
            }
        });
        if (image instanceof File) fd.append('image', image);
        if (data.remove_image) fd.append('remove_image', '1');
        return fd;
    }
}

export default new AnnouncementService();

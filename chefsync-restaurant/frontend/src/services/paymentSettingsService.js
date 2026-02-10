import apiClient from './apiClient';

class PaymentSettingsService {
    async getSettings(authHeaders) {
        const response = await apiClient.get('/admin/payment-settings', {
            headers: authHeaders,
        });
        return response.data;
    }

    async saveSettings(data, authHeaders) {
        const response = await apiClient.post('/admin/payment-settings', data, {
            headers: authHeaders,
        });
        return response.data;
    }

    async verifyTerminal(authHeaders) {
        const response = await apiClient.post('/admin/payment-settings/verify', {}, {
            headers: authHeaders,
        });
        return response.data;
    }

    async markOrderPaid(orderId, authHeaders) {
        const response = await apiClient.post(`/admin/orders/${orderId}/mark-paid`, {}, {
            headers: authHeaders,
        });
        return response.data;
    }
}

export default new PaymentSettingsService();

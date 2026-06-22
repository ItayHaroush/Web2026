import api from './apiClient';

class DomainRequestService {
    async getOverview(authHeaders) {
        const res = await api.get('/admin/domain-requests', { headers: authHeaders });
        return res.data;
    }

    async verifyDomain(domainName, authHeaders) {
        const res = await api.post('/admin/domain-requests/verify', { domain_name: domainName }, { headers: authHeaders });
        return res.data;
    }

    async submitExisting(data, authHeaders) {
        const res = await api.post('/admin/domain-requests/existing', data, { headers: authHeaders });
        return res.data;
    }

    async submitFullService(data, authHeaders) {
        const res = await api.post('/admin/domain-requests/full-service', data, { headers: authHeaders });
        return res.data;
    }

    async submitChange(notes, authHeaders) {
        const res = await api.post('/admin/domain-requests/change', { customer_notes: notes }, { headers: authHeaders });
        return res.data;
    }

    async submitDisconnect(notes, authHeaders) {
        const res = await api.post('/admin/domain-requests/disconnect', { customer_notes: notes }, { headers: authHeaders });
        return res.data;
    }

    async getDnsInstructions(id, authHeaders) {
        const res = await api.get(`/admin/domain-requests/${id}/dns-instructions`, { headers: authHeaders });
        return res.data;
    }

    async createPaymentSession(domainRequestId, authHeaders) {
        const res = await api.post(
            '/admin/domain-requests/payment-session',
            { domain_request_id: domainRequestId },
            { headers: authHeaders }
        );
        return res.data;
    }
}

export default new DomainRequestService();

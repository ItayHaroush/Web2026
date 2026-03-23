import apiClient from './apiClient';

/** חילוץ payload מ-Laravel: { success, data } או כבר האובייקט עצמו */
function unwrapApiPayload(body) {
    if (body == null || typeof body !== 'object') return null;
    if (Object.prototype.hasOwnProperty.call(body, 'data') && body.data !== undefined && body.data !== null) {
        return body.data;
    }
    return body;
}

class ReportService {
    // ============================================
    // Admin - דוחות יומיים
    // ============================================

    async getReports(params = {}) {
        const response = await apiClient.get('/admin/reports', { params });
        return unwrapApiPayload(response.data) ?? response.data;
    }

    async getReport(id) {
        const response = await apiClient.get(`/admin/reports/${id}`);
        return unwrapApiPayload(response.data) ?? response.data;
    }

    async generateReport(date) {
        const response = await apiClient.post('/admin/reports/generate', { date });
        return unwrapApiPayload(response.data) ?? response.data;
    }

    async downloadPdf(id) {
        const response = await apiClient.get(`/admin/reports/${id}/pdf`, {
            responseType: 'blob',
        });
        const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `report-${id}.pdf`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    }

    async downloadCsv(params = {}) {
        const response = await apiClient.get('/admin/reports/csv', {
            params,
            responseType: 'blob',
        });
        const url = window.URL.createObjectURL(new Blob([response.data], { type: 'text/csv' }));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'daily-reports.csv');
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    }

    async downloadTaxCsv(from, to) {
        const response = await apiClient.get('/admin/reports/tax-csv', {
            params: { from, to },
            responseType: 'blob',
        });
        const url = window.URL.createObjectURL(new Blob([response.data], { type: 'text/csv' }));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'tax-export.csv');
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    }

    async downloadZip(from, to) {
        const response = await apiClient.get('/admin/reports/zip', {
            params: { from, to },
            responseType: 'blob',
        });
        const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/zip' }));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'reports.zip');
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    }

    // ============================================
    // Super Admin - סיכום מערכת
    // ============================================

    async getSuperAdminSummary(params = {}) {
        const response = await apiClient.get('/super-admin/reports/summary', { params });
        const inner = unwrapApiPayload(response.data);
        if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
            return inner;
        }
        return null;
    }

    async superAdminBackfillMissing(payload = {}) {
        const response = await apiClient.post('/super-admin/reports/backfill-missing', payload);
        return unwrapApiPayload(response.data) ?? response.data;
    }

    async superAdminExportZip({ from, to, restaurant_ids }) {
        const response = await apiClient.post(
            '/super-admin/reports/export-zip',
            { from, to, restaurant_ids },
            {
                responseType: 'blob',
                transformResponse: [(d) => d],
            }
        );
        const blob = new Blob([response.data], { type: 'application/zip' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `daily-reports-${from}-to-${to}.zip`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    }

    async superAdminSendEmails(payload) {
        const response = await apiClient.post('/super-admin/reports/send-emails', payload);
        return unwrapApiPayload(response.data) ?? response.data;
    }

    async superAdminWhatsappLinks(payload) {
        const response = await apiClient.post('/super-admin/reports/whatsapp-links', payload);
        return unwrapApiPayload(response.data) ?? response.data;
    }

    async bulkDispatchReports(payload) {
        const response = await apiClient.post('/admin/reports/bulk-dispatch', payload);
        return unwrapApiPayload(response.data) ?? response.data;
    }
}

const reportService = new ReportService();
export default reportService;

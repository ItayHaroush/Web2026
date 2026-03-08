import apiClient from './apiClient';

class ReportService {
    // ============================================
    // Admin - דוחות יומיים
    // ============================================

    async getReports(params = {}) {
        const response = await apiClient.get('/admin/reports', { params });
        return response.data;
    }

    async getReport(id) {
        const response = await apiClient.get(`/admin/reports/${id}`);
        return response.data;
    }

    async generateReport(date) {
        const response = await apiClient.post('/admin/reports/generate', { date });
        return response.data;
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
        return response.data;
    }
}

const reportService = new ReportService();
export default reportService;

import apiClient from './apiClient';

export const getPrintDevices = async () => {
    const response = await apiClient.get('/admin/print-devices');
    return response.data;
};

export const registerPrintDevice = async (data) => {
    const response = await apiClient.post('/admin/print-devices', data);
    return response.data;
};

export const updatePrintDevice = async (id, data) => {
    const response = await apiClient.put(`/admin/print-devices/${id}`, data);
    return response.data;
};

export const deletePrintDevice = async (id) => {
    const response = await apiClient.delete(`/admin/print-devices/${id}`);
    return response.data;
};

export const togglePrintDevice = async (id) => {
    const response = await apiClient.patch(`/admin/print-devices/${id}/toggle`);
    return response.data;
};

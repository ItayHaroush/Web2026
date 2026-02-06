import apiClient from './apiClient';

/**
 * שירות מדפסות מטבח - ניהול
 */

// רשימת כל המדפסות
export const getPrinters = async () => {
    const response = await apiClient.get('/admin/printers');
    return response.data;
};

// יצירת מדפסת חדשה
export const createPrinter = async (data) => {
    const response = await apiClient.post('/admin/printers', data);
    return response.data;
};

// עדכון מדפסת
export const updatePrinter = async (id, data) => {
    const response = await apiClient.put(`/admin/printers/${id}`, data);
    return response.data;
};

// מחיקת מדפסת
export const deletePrinter = async (id) => {
    const response = await apiClient.delete(`/admin/printers/${id}`);
    return response.data;
};

// הפעלה/השבתה
export const togglePrinter = async (id) => {
    const response = await apiClient.patch(`/admin/printers/${id}/toggle`);
    return response.data;
};

// הדפסת ניסיון
export const testPrint = async (id) => {
    const response = await apiClient.post(`/admin/printers/${id}/test`);
    return response.data;
};

// הדפסה חוזרת של הזמנה
export const reprintOrder = async (orderId) => {
    const response = await apiClient.post(`/admin/orders/${orderId}/reprint`);
    return response.data;
};

import apiClient from './apiClient';

// בדיקה מאובטחת: רק בפיתוח מקומי אמיתי
const isDevelopment = import.meta.env.DEV && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

export async function requestPhoneCode(phone) {
    if (isDevelopment) {
        console.log('📱 [DEV] Requesting SMS code for:', phone);
    }
    const { data } = await apiClient.post('/auth/phone/request', { phone });
    if (isDevelopment) {
        console.log('✅ [DEV] SMS response:', data);
    }
    return data;
}

export async function verifyPhoneCode(phone, code) {
    if (isDevelopment) {
        console.log('🔐 [DEV] Verifying code:', { phone, code });
    }
    const { data } = await apiClient.post('/auth/phone/verify', { phone, code });
    if (isDevelopment) {
        console.log('✅ [DEV] Verification result:', data);
    }
    return data;
}

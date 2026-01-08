import apiClient from './apiClient';

export async function requestPhoneCode(phone) {
  const { data } = await apiClient.post('/auth/phone/request', { phone });
  return data;
}

export async function verifyPhoneCode(phone, code) {
  const { data } = await apiClient.post('/auth/phone/verify', { phone, code });
  return data;
}

import { apiService } from './api';

export const listAdminRentalProfiles = async () => {
  const resp = await apiService.request('/rental-profiles/admin/all');
  if (!resp?.success) throw new Error(resp?.message || 'Unable to load rental profiles.');
  return resp?.data || [];
};

export const getAdminRentalProfile = async (id) => {
  const resp = await apiService.request(`/rental-profiles/${id}`);
  if (!resp?.success) throw new Error(resp?.message || 'Unable to load rental profile.');
  return resp?.data || null;
};

export const createAdminRentalProfile = async (payload) => {
  const resp = await apiService.request('/rental-profiles', { method: 'POST', body: payload });
  if (!resp?.success || !resp.data) throw new Error(resp?.message || 'Rental profile creation failed.');
  return resp?.data || null;
};

export const updateAdminRentalProfile = async (id, payload) => {
  const resp = await apiService.request(`/rental-profiles/${id}`, { method: 'PUT', body: payload });
  if (!resp?.success || !resp.data) throw new Error(resp?.message || 'Rental profile update failed.');
  return resp?.data || null;
};

export const changeAdminRentalStatus = async (id, status) => {
  const resp = await apiService.request(`/rental-profiles/${id}/status`, { method: 'POST', body: { status } });
  if (!resp?.success || !resp.data) throw new Error(resp?.message || 'Rental status update failed.');
  return resp?.data || null;
};

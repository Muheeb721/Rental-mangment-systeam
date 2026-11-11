import { apiService } from './api';

export const listAdminPayments = async () => {
  const response = await apiService.request('/payments', { method: 'GET' });
  return response?.data || [];
};

export const createAdminPayment = async (payload) => {
  const response = await apiService.request('/payments', {
    method: 'POST',
    body: payload,
  });
  if (!response?.success || !response.data) {
    throw new Error(response?.message || 'Payment creation failed.');
  }
  return response?.data || null;
};

export const approveAdminPayment = async (paymentId, payload = {}) => {
  const response = await apiService.request('/admin/payment/approve', {
    method: 'POST',
    body: {
      paymentId,
      newStatus: 'Approved',
      previousStatus: payload.previousStatus || 'Pending',
      ...payload,
    },
  });
  return response?.data || null;
};

export const rejectAdminPayment = async (paymentId, payload = {}) => {
  const response = await apiService.request('/admin/payment/reject', {
    method: 'POST',
    body: {
      paymentId,
      newStatus: 'Rejected',
      previousStatus: payload.previousStatus || 'Pending',
      ...payload,
    },
  });
  return response?.data || null;
};

export default {
  listAdminPayments,
  createAdminPayment,
  approveAdminPayment,
  rejectAdminPayment,
};

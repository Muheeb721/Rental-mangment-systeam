import { apiService } from './api';

export const listAdminBookings = async () => {
  const response = await apiService.request('/bookings', { method: 'GET' });
  if (!response?.success) throw new Error(response?.message || 'Unable to load bookings.');
  return response?.data || [];
};

export const approveAdminBooking = async (bookingId) => {
  const response = await apiService.request(`/bookings/${bookingId}/approve`, {
    method: 'POST',
  });
  if (!response?.success || !response.data) {
    throw new Error(response?.message || 'Booking approval failed.');
  }
  return response?.data || null;
};

export const rejectAdminBooking = async (bookingId, reason = 'Booking rejected by the admin.') => {
  const response = await apiService.request(`/bookings/${bookingId}/reject`, {
    method: 'POST',
    body: { reason },
  });
  if (!response?.success || !response.data) {
    throw new Error(response?.message || 'Booking rejection failed.');
  }
  return response?.data || null;
};

export default {
  listAdminBookings,
  approveAdminBooking,
  rejectAdminBooking,
};

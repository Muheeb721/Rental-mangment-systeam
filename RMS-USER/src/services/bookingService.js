import api from './api';

export const createBooking = async (payload) => {
  try {
    const res = await api.request('/bookings', { method: 'POST', body: payload });
    return res;
  } catch (error) {
    console.warn('Create booking failed', error);
    return { success: false, message: 'API unavailable' };
  }
};

export const myBookings = async () => {
  try {
    const res = await api.request('/bookings/me');
    return res;
  } catch (error) {
    console.warn('List my bookings failed', error);
    return { success: false, message: 'API unavailable' };
  }
};

export const listAllBookings = async () => {
  try {
    const res = await api.request('/bookings');
    return res;
  } catch (error) {
    console.warn('List all bookings failed', error);
    return { success: false, message: 'API unavailable' };
  }
};

export const approveBooking = async (id) => {
  try {
    const res = await api.request(`/bookings/${id}/approve`, { method: 'POST' });
    return res;
  } catch (error) {
    console.warn('Approve booking failed', error);
    return { success: false, message: 'API unavailable' };
  }
};

export const rejectBooking = async (id, body = {}) => {
  try {
    const res = await api.request(`/bookings/${id}/reject`, { method: 'POST', body });
    return res;
  } catch (error) {
    console.warn('Reject booking failed', error);
    return { success: false, message: 'API unavailable' };
  }
};

export default { createBooking, myBookings, listAllBookings, approveBooking, rejectBooking };

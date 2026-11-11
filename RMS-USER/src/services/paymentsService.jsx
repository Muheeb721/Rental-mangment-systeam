import api from './api';
import { createNotification } from './notificationService.jsx';
import { addStoredNotification } from '../utils/notificationsStorage.jsx';

const generatePaymentId = () => `PAY-${Date.now().toString().slice(-6)}-${Math.random().toString(16).slice(2,8)}`;

const calcStatus = (total, paid, dueDate) => {
  const t = Number(total || 0);
  const p = Number(paid || 0);
  if (p <= 0) {
    if (dueDate && new Date(dueDate) < new Date()) return 'Overdue';
    return 'Pending';
  }
  if (p >= t) return 'Paid';
  return 'Partial Payment';
};

export const createPayment = async (payload = {}) => {
  try {
    const res = await api.request('/payments', { method: 'POST', body: payload });
    if (res && res.success && res.data) {
      try {
        const note = createNotification({
          type: 'payment',
          title: 'Payment recorded',
          message: `${res.data.userName || 'A user'} paid ${res.data.amountPaid || res.data.amount || 0}`,
        });
        await addStoredNotification(note);
      } catch (e) {
        console.warn('Payment notification write failed after successful payment:', e);
      }
      return { success: true, data: res.data };
    }

    const message = res?.message || 'Unable to record payment.';
    return { success: false, message, data: null };
  } catch (e) {
    const message = e?.response?.data?.message || 'Unable to record payment.';
    console.error('createPayment failed', e);
    return { success: false, message, data: null };
  }
};

export const getPayments = async () => {
  try {
    const res = await api.request('/payments/me');
    if (res && res.success && Array.isArray(res.data) && res.data.length) return res.data;
  } catch (e) {
    // ignore API errors and fall back to client storage
  }

  return getPaymentsFallback();
};

// Client-side fallback to read payments stored in localStorage when API isn't available
export const getPaymentsFallback = () => {
  try {
    if (typeof window === 'undefined') return [];
    const raw = window.localStorage.getItem('rms_payments') || '[]';
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
};

export const getPaymentsByBooking = async (bookingId) => {
  const all = await getPayments();
  return all.filter((p) => String(p.bookingId) === String(bookingId));
};

export const updatePayment = async (id, updates = {}) => {
  try {
    const res = await api.request(`/payments/${id}`, { method: 'PUT', body: updates });
    return res && res.success ? res : { success: false, message: 'Unable to update payment' };
  } catch (e) {
    console.error('updatePayment failed', e);
    return { success: false };
  }
};

export const deletePayment = async (id) => {
  try {
    const res = await api.request(`/payments/${id}`, { method: 'DELETE' });
    return res && res.success ? res : { success: false, message: 'Unable to delete payment' };
  } catch (e) {
    return { success: false, message: 'API unavailable' };
  }
};

export default { createPayment, getPayments, getPaymentsByBooking, updatePayment, deletePayment };

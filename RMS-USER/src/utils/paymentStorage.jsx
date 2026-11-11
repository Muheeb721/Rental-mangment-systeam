// Backend-backed payments storage utilities.
// Prefer `createPayment(payload)` and `fetchPayments()`.
import paymentService from '../services/paymentService';

const normalizePayment = (item = {}) => ({
  id: item._id || item.id || null,
  bookingId: item.bookingId || item.booking || null,
  userId: item.userId || item.user?.id || null,
  amount: Number(item.amount || item.amountPaid || 0),
  date: item.paymentDate || item.date || item.createdAt || new Date().toISOString(),
  method: item.method || item.paymentType || 'Simulated',
  reference: item.transactionId || item.reference || null,
  status: item.status || 'Pending',
  notes: item.notes || null,
});

const fetchPayments = async () => {
  try {
    const res = await paymentService.myPayments();
    if (res && res.success && Array.isArray(res.data)) return res.data.map(normalizePayment);
    return [];
  } catch (e) {
    console.error('fetchPayments failed', e);
    return [];
  }
};

const createPayment = async (payload) => {
  try {
    const res = await paymentService.createPayment(payload);
    if (res && res.success) return normalizePayment(res.data);
    throw new Error(res?.message || 'Create payment failed');
  } catch (e) {
    console.error('createPayment failed', e);
    throw e;
  }
};

// Deprecated sync helpers (no longer persistent)
const readPayments = () => {
  console.warn('readPayments() is deprecated: use fetchPayments()');
  return [];
};

const savePayments = () => {
  console.warn('savePayments() is deprecated: use backend APIs');
  return [];
};

const addPayment = () => {
  console.warn('addPayment() is deprecated: use createPayment(payload)');
  return null;
};

const getPaymentsByBooking = () => {
  console.warn('getPaymentsByBooking() is deprecated: use fetchPayments() and filter');
  return [];
};

export { fetchPayments, createPayment, readPayments, savePayments, addPayment, getPaymentsByBooking };
export default { fetchPayments, createPayment };

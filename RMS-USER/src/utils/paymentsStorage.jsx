// Payments storage migrated to backend APIs (paymentService).
import paymentService from '../services/paymentService';

const normalize = (item = {}) => ({
  id: item._id || item.id || null,
  bookingId: item.bookingId || item.booking?.id || null,
  userId: item.userId || item.user?.id || null,
  userName: item.userName || item.user?.name || item.name || '',
  userEmail: item.userEmail || item.user?.email || item.email || '',
  userPhone: item.userPhone || item.user?.phone || item.phone || '',
  propertyId: item.propertyId || item.property?.id || null,
  propertyName: item.propertyName || item.property?.title || '',
  propertyType: item.propertyType || item.property?.type || '',
  purpose: item.purpose || 'Sale/Rent',
  totalAmount: Number(item.totalAmount || item.amount || 0) || 0,
  advanceAmount: Number(item.advanceAmount || 0) || 0,
  amountPaid: Number(item.amountPaid || 0) || 0,
  remainingAmount: Number(item.remainingAmount || 0) || (Number(item.totalAmount || 0) - Number(item.amountPaid || 0)),
  method: item.method || item.paymentMethod || 'Other',
  status: item.status || 'Pending',
  paymentDate: item.paymentDate || item.date || null,
  dueDate: item.dueDate || null,
  notes: item.notes || '',
  createdAt: item.createdAt || new Date().toISOString(),
  updatedAt: item.updatedAt || item.createdAt || new Date().toISOString(),
});

const fetchPayments = async () => {
  try {
    const res = await paymentService.myPayments();
    if (res && res.success && Array.isArray(res.data)) return res.data.map(normalize);
    return [];
  } catch (e) {
    console.error('fetchPayments failed', e);
    return [];
  }
};

const createPayment = async (payload) => {
  try {
    const res = await paymentService.createPayment(payload);
    if (res && res.success) return normalize(res.data);
    throw new Error(res?.message || 'Create payment failed');
  } catch (e) {
    console.error('createPayment failed', e);
    throw e;
  }
};

// Deprecated synchronous methods
const read = () => {
  console.warn('paymentsStorage.read() deprecated: use fetchPayments()');
  return [];
};

const save = () => {
  console.warn('paymentsStorage.save() deprecated: use backend APIs');
  return [];
};

const add = () => {
  console.warn('paymentsStorage.add() deprecated: use createPayment(payload)');
  return null;
};

const update = () => {
  console.warn('paymentsStorage.update() deprecated: use payment APIs');
  return null;
};

const remove = () => {
  console.warn('paymentsStorage.remove() deprecated: use payment APIs');
  return null;
};

export { fetchPayments, createPayment, read, save, add, update, remove };
export default { fetchPayments, createPayment };

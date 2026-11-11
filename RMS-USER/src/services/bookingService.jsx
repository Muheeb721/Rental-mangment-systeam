import api from './api';

const normalizeBooking = (item = {}) => ({
  id: item._id || item.id || `BK-${Date.now()}`,
  userId: item.userId || item.user?.id || 'guest',
  userName: item.userName || item.customerName || item.user?.name || 'RMS User',
  userEmail: item.userEmail || item.email || item.user?.email || '',
  propertyId: item.propertyId || item.property?._id || item.property?.id || '',
  propertyTitle: item.propertyTitle || item.propertyName || item.property?.title || 'Property',
  propertyType: item.propertyType || item.type || item.property?.type || 'Property',
  bookingDate: item.bookingDate || item.createdAt || new Date().toISOString(),
  bookingTime: item.bookingTime || '09:00 AM',
  amount: Number(item.amount || item.totalAmount || item.rent || 0),
  advance: Number(item.advance || item.advanceAmount || 0),
  remainingAmount: Number(item.remainingAmount || Math.max(0, Number(item.amount || item.totalAmount || item.rent || 0) - Number(item.advance || item.advanceAmount || 0))),
  status: item.bookingStatus || item.status || 'Pending',
  paymentStatus: item.paymentStatus || 'Pending',
  notes: item.notes || item.message || '',
  ...item,
});

const read = async () => {
  try {
    const response = await api.request('/bookings/me');
    if (response && response.success) {
      return Array.isArray(response.data) ? response.data.map(normalizeBooking) : [];
    }
    return [];
  } catch (error) {
    console.error('Unable to read bookings from backend', error);
    return [];
  }
};

const createBooking = async (booking = {}) => {
  try {
    const response = await api.request('/bookings', {
      method: 'POST',
      body: booking,
    });

    if (response && response.success) {
      return { success: true, data: normalizeBooking(response.data || booking) };
    }

    return { success: false, message: response?.message || 'Unable to create booking.' };
  } catch (error) {
    return { success: false, message: error.message || 'Unable to create booking.' };
  }
};

const update = async (id, updates = {}) => {
  try {
    const status = String(updates.status || '').trim();
    if (!status) {
      const response = await api.request(`/bookings/${id}`, {
        method: 'PUT',
        body: updates,
      });
      return response && response.success ? response : { success: false, message: 'Unable to update booking.' };
    }

    const action = status.toLowerCase() === 'approved' ? 'approve' : 'reject';
    const response = await api.request(`/bookings/${id}/${action}`, {
      method: 'POST',
      body: {},
    });

    return response && response.success ? response : { success: false, message: 'Unable to update booking.' };
  } catch (error) {
    return { success: false, message: error.message || 'Unable to update booking.' };
  }
};

const remove = async (id) => {
  try {
    const response = await api.request(`/bookings/${id}`, { method: 'DELETE' });
    return response && response.success ? response : { success: false, message: 'Unable to delete booking.' };
  } catch (error) {
    return { success: false, message: error.message || 'Unable to delete booking.' };
  }
};

const listAll = async () => {
  try {
    const res = await api.request('/bookings');
    if (res && res.success) return Array.isArray(res.data) ? res.data.map(normalizeBooking) : [];
    return [];
  } catch (e) {
    console.error('listAll bookings failed', e);
    return [];
  }
};

const approve = async (id) => {
  try {
    const res = await api.request(`/bookings/${id}/approve`, { method: 'POST' });
    return res || { success: false };
  } catch (e) {
    console.error('approve booking failed', e);
    return { success: false };
  }
};

const reject = async (id, body = {}) => {
  try {
    const res = await api.request(`/bookings/${id}/reject`, { method: 'POST', body });
    return res || { success: false };
  } catch (e) {
    console.error('reject booking failed', e);
    return { success: false };
  }
};

// compatibility aliases
const listAllBookings = listAll;
const approveBooking = approve;
const rejectBooking = reject;

export { read, createBooking, update, remove, listAll, approve, reject, listAllBookings, approveBooking, rejectBooking };
export default { read, createBooking, update, remove, listAll, approve, reject, listAllBookings, approveBooking, rejectBooking };

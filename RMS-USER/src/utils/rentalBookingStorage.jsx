// Migrated to backend-driven bookings.
// Exposes async methods backed by the API via bookingService. Synchronous localStorage helpers are deprecated.
import bookingService from '../services/bookingService';

const normalizeBooking = (b = {}) => ({
  id: b._id || b.id || b.bookingId || null,
  bookingId: b._id || b.bookingId || b.id || null,
  userId: b.userId || (b.user && b.user.id) || null,
  userName: b.userName || b.customerName || (b.user && b.user.name) || '',
  userEmail: b.userEmail || (b.user && b.user.email) || '',
  userPhone: b.userPhone || b.customerPhone || b.phone || '',
  propertyId: b.propertyId || (b.property && b.property.id) || null,
  propertyName: b.propertyName || b.propertyTitle || (b.property && b.property.title) || '',
  propertyType: b.propertyType || b.type || (b.property && b.property.type) || '',
  rent: Number(b.rent || b.amount || 0),
  rentFrequency: b.rentFrequency || 'Monthly',
  securityDeposit: Number(b.securityDeposit || b.deposit || 0),
  bookingDate: b.bookingDate || b.createdAt || new Date().toISOString(),
  moveInDate: b.moveInDate || null,
  rentalDuration: b.rentalDuration || b.duration || '',
  occupants: Number(b.occupants || 1),
  message: b.message || b.notes || '',
  paymentStatus: b.paymentStatus || 'Pending',
  bookingStatus: b.bookingStatus || b.status || 'Pending',
  createdAt: b.createdAt || new Date().toISOString(),
});

// Async API-backed methods
const fetchBookings = async () => {
  try {
    const res = await bookingService.myBookings();
    if (res && res.success && Array.isArray(res.data)) return res.data.map(normalizeBooking);
    return [];
  } catch (e) {
    console.error('fetchBookings failed', e);
    return [];
  }
};

const createBooking = async (payload) => {
  try {
    const res = await bookingService.createBooking(payload);
    if (res && res.success) return normalizeBooking(res.data);
    throw new Error(res?.message || 'Create booking failed');
  } catch (e) {
    console.error('createBooking failed', e);
    throw e;
  }
};

// Deprecated synchronous helpers (no longer persistent source of truth)
const readBookings = () => {
  console.warn('readBookings() is deprecated: use fetchBookings() instead');
  return [];
};

const addBooking = (booking = {}) => {
  console.warn('addBooking() (sync) is deprecated: use createBooking(payload)');
  return null;
};

const updateBooking = (id, updates = {}) => {
  console.warn('updateBooking() (sync) is deprecated. Use API endpoints via bookingService.');
  return null;
};

const removeBooking = (id) => {
  console.warn('removeBooking() (sync) is deprecated. Use API endpoints via bookingService.');
  return null;
};

const getBookingById = (id) => {
  console.warn('getBookingById() (sync) is deprecated: use fetchBookings() and filter client-side or add API endpoint');
  return null;
};

const getBookingsByUser = (userIdOrEmail) => {
  console.warn('getBookingsByUser() (sync) is deprecated: use fetchBookings()');
  return [];
};

export { fetchBookings, createBooking, readBookings, addBooking, updateBooking, removeBooking, getBookingById, getBookingsByUser };
export default { fetchBookings, createBooking };

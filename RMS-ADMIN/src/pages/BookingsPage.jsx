import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './BookingsPage.css';
import Modal from '../components/Modal';
import { formatCurrency, formatDate } from '../utils/formatters';
import { approveAdminBooking, rejectAdminBooking } from '../services/adminBookingService';
import { apiService } from '../services/api';
import { getAdminImageUrl } from '../utils/adminImageUrl';

const emptyForm = {
  customerName: '',
  customerPhone: '',
  propertyId: '',
  propertyTitle: '',
  propertyType: 'House',
  bookingDate: '',
  visitDate: '',
  amount: '',
  paymentStatus: 'Pending',
  bookingStatus: 'Pending',
  notes: '',
};

function BookingsPage({ appData, setAppData, notify, onBookingDecision }) {
  const bookings = appData.bookings || [];
  const properties = appData.properties || [];
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [paymentFilter, setPaymentFilter] = useState('All');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [deletingId, setDeletingId] = useState(null);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [processingBookingId, setProcessingBookingId] = useState(null);

  useEffect(() => {
    const loadBookings = async () => {
      try {
        setLoadingBookings(true);
        const response = await apiService.request('/bookings');
        if (response?.success) {
          setAppData((prev) => ({ ...prev, bookings: response.data || [] }));
        }
      } catch (error) {
        console.warn('Unable to load bookings from backend:', error?.message || error);
      }
      finally {
        setLoadingBookings(false);
      }
    };

    loadBookings();
  }, [setAppData]);

  const getBookingId = (booking) => booking?._id || booking?.id || booking?.bookingId || 'N/A';

  const filteredBookings = useMemo(() => {
    const next = [...bookings].filter((booking) => {
      const customer = booking.customerName || booking.userName || booking.customer || booking.name || '';
      const property = booking.propertyTitle || booking.propertyName || booking.property || '';
      const matchesSearch = !search || [customer, property, getBookingId(booking)].join(' ').toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'All' || String(booking.bookingStatus || booking.status || '').toLowerCase() === statusFilter.toLowerCase();
      const matchesPayment = paymentFilter === 'All' || String(booking.paymentStatus || booking.payment || '').toLowerCase() === paymentFilter.toLowerCase();
      return matchesSearch && matchesStatus && matchesPayment;
    });
    return next.sort((a, b) => new Date(b.createdAt || b.updatedAt || 0) - new Date(a.createdAt || a.updatedAt || 0));
  }, [bookings, search, statusFilter, paymentFilter]);

  const bookingStats = useMemo(() => {
    const counts = bookings.reduce((acc, booking) => {
      acc.total += 1;
      const bookingStatus = String(booking.bookingStatus || booking.status || '').toLowerCase();
      const paymentStatus = String(booking.paymentStatus || booking.payment || '').toLowerCase();
      if (bookingStatus === 'approved') acc.approved += 1;
      if (bookingStatus === 'pending') acc.pending += 1;
      if (paymentStatus === 'paid') acc.paid += 1;
      acc.value += Number(booking.amount || 0);
      return acc;
    }, { total: 0, approved: 0, pending: 0, paid: 0, value: 0 });

    return counts;
  }, [bookings]);

  const addActivity = (action, details) => {
    setAppData((prev) => ({
      ...prev,
      activityLogs: [{ id: `log-${Date.now()}`, action, details, timestamp: new Date().toISOString() }, ...(prev.activityLogs || [])].slice(0, 20),
    }));
  };

  const validate = () => {
    const nextErrors = {};
    if (!formData.customerName.trim()) nextErrors.customerName = 'Customer name is required';
    if (!formData.customerPhone.trim()) nextErrors.customerPhone = 'Phone is required';
    if (!formData.propertyTitle.trim()) nextErrors.propertyTitle = 'Property is required';
    if (!formData.amount || Number(formData.amount) <= 0) nextErrors.amount = 'Valid amount is required';
    return nextErrors;
  };

  const openCreateModal = () => {
    setEditingId(null);
    setFormData(emptyForm);
    setErrors({});
    setModalOpen(true);
  };

  const openEditModal = (booking) => {
    setEditingId(getBookingId(booking));
    setFormData({
      customerName: booking.customerName || booking.userName || '',
      customerPhone: booking.customerPhone || booking.phone || '',
      propertyId: booking.propertyId || '',
      propertyTitle: booking.propertyTitle || booking.propertyName || '',
      propertyType: booking.propertyType || 'House',
      bookingDate: booking.bookingDate || '',
      visitDate: booking.visitDate || '',
      amount: booking.amount || '',
      paymentStatus: booking.paymentStatus || booking.payment || 'Pending',
      bookingStatus: booking.bookingStatus || booking.status || 'Pending',
      notes: booking.notes || '',
    });
    setErrors({});
    setModalOpen(true);
  };

  const saveBooking = (event) => {
    event.preventDefault();
    const nextErrors = validate();
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    const selectedProperty = properties.find((item) => item.id === formData.propertyId) || properties.find((item) => item.title === formData.propertyTitle);
    const payload = {
      userName: formData.customerName.trim(),
      userEmail: '',
      customerName: formData.customerName.trim(),
      customerPhone: formData.customerPhone.trim(),
      propertyId: selectedProperty?._id || selectedProperty?.id || formData.propertyId || '',
      propertyName: selectedProperty?.title || formData.propertyTitle.trim(),
      propertyTitle: selectedProperty?.title || formData.propertyTitle.trim(),
      propertyType: selectedProperty?.propertyType || formData.propertyType,
      bookingDate: formData.bookingDate || new Date().toISOString().slice(0, 10),
      visitDate: formData.visitDate || new Date().toISOString().slice(0, 10),
      amount: Number(formData.amount || 0),
      rent: Number(formData.amount || 0),
      paymentStatus: formData.paymentStatus,
      bookingStatus: formData.bookingStatus,
      status: formData.bookingStatus,
      notes: formData.notes.trim(),
      message: formData.notes.trim(),
    };

    apiService.request(editingId ? `/bookings/${editingId}` : '/bookings', {
      method: editingId ? 'PUT' : 'POST',
      body: payload,
    })
      .then((response) => {
        if (!response?.success || !response.data) {
          throw new Error(response?.message || (editingId ? 'Booking update failed.' : 'Booking creation failed.'));
        }
        const savedBooking = response.data;
        setAppData((prev) => ({
          ...prev,
          bookings: editingId
            ? (prev.bookings || []).map((item) => String(getBookingId(item)) === String(editingId) ? savedBooking : item)
            : [savedBooking, ...(prev.bookings || [])],
        }));
        addActivity(editingId ? 'Booking updated' : 'Booking added', `${payload.customerName}'s booking was ${editingId ? 'updated' : 'added'}.`);
        notify({ message: editingId ? 'Booking updated successfully.' : 'Booking created successfully.', variant: 'success' });
        setModalOpen(false);
        setEditingId(null);
        setFormData(emptyForm);
      })
      .catch((error) => {
        console.error('Create booking failed:', error);
        notify({ message: error.message || 'Unable to create booking.', variant: 'error' });
      });
  };

  const handleDecision = async (bookingId, status) => {
    try {
      const booking = (bookings || []).find((item) => String(getBookingId(item)) === String(bookingId) || String(item.id) === String(bookingId) || String(item._id) === String(bookingId));
      const targetId = booking?._id || booking?.id || bookingId;

      setProcessingBookingId(targetId);

      if (status === 'Approved') {
        await approveAdminBooking(targetId);
      } else {
        await rejectAdminBooking(targetId, `Booking marked as ${status.toLowerCase()} by admin.`);
      }

      onBookingDecision?.(bookingId, status);
      setAppData((prev) => ({
        ...prev,
        bookings: (prev.bookings || []).map((item) =>
          String(getBookingId(item)) === String(bookingId) || String(item.id) === String(bookingId) || String(item._id) === String(bookingId)
            ? {
                ...item,
                bookingStatus: status,
                status,
                paymentStatus: status === 'Approved' ? 'Paid' : item.paymentStatus || item.payment || 'Pending',
              }
            : item,
        ),
      }));
      notify({ message: `Booking ${status.toLowerCase()} successfully.`, variant: 'success' });
    } catch (error) {
      console.error('Booking decision failed:', error);
      notify({ message: error.message || 'Unable to update booking status.', variant: 'error' });
    }
    finally {
      setProcessingBookingId(null);
    }
  };

  const deleteBooking = async (bookingId) => {
    try {
      const booking = (bookings || []).find((item) => String(getBookingId(item)) === String(bookingId) || String(item.id) === String(bookingId) || String(item._id) === String(bookingId));
      const targetId = booking?._id || booking?.id || bookingId;
      if (targetId) {
        const response = await apiService.request(`/bookings/${targetId}`, {
          method: 'DELETE',
        });
        if (!response?.success) throw new Error(response?.message || 'Booking deletion failed.');
      }
      setAppData((prev) => ({ ...prev, bookings: (prev.bookings || []).filter((item) => String(getBookingId(item)) !== String(bookingId) && String(item.id) !== String(bookingId) && String(item._id) !== String(bookingId)) }));
      addActivity('Booking deleted', 'A booking record was removed.');
      notify({ message: 'Booking deleted successfully.', variant: 'success' });
    } catch (error) {
      console.error('Booking delete failed:', error);
      notify({ message: error.message || 'Unable to delete booking.', variant: 'error' });
    }
    setDeletingId(null);
  };

  return (
    <div className="page-section bookings-page">
      <div className="summary-strip booking-strip">
        <div className="summary-item primary">
          <span>Total bookings</span>
          <strong>{bookingStats.total}</strong>
        </div>
        <div className="summary-item success">
          <span>Approved</span>
          <strong>{bookingStats.approved}</strong>
        </div>
        <div className="summary-item danger">
          <span>Pending</span>
          <strong>{bookingStats.pending}</strong>
        </div>
        <div className="summary-item info">
          <span>Pipeline value</span>
          <strong>{formatCurrency(bookingStats.value)}</strong>
        </div>
      </div>

      <section className="panel-card toolbar-card">
        <div className="toolbar-row">
          <div className="toolbar-search">
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search customer or property" />
          </div>
          <div className="toolbar-group">
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="All">All Booking Status</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
              <option value="Cancelled">Cancelled</option>
              <option value="Completed">Completed</option>
            </select>
            <select value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value)}>
              <option value="All">All Payment Status</option>
              <option value="Paid">Paid</option>
              <option value="Pending">Pending</option>
              <option value="Failed">Failed</option>
              <option value="Refunded">Refunded</option>
            </select>
            <button type="button" className="primary-button" onClick={openCreateModal}>Add Booking</button>
          </div>
        </div>
      </section>

      <section className="panel-card">
        <div className="card-header">
          <h3>Booking Management</h3>
          <span className="mini-badge">{filteredBookings.length} bookings</span>
        </div>

        {loadingBookings ? (
          <div className="empty-state">Loading bookings...</div>
        ) : filteredBookings.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📅</div>
            <h4>No bookings available</h4>
            <p>Create a new booking or adjust your filters.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Booking ID</th>
                  <th>Customer</th>
                  <th>Property</th>
                  <th>Amount</th>
                  <th>Booking</th>
                  <th>Payment</th>
                  <th>Visit</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredBookings.map((booking) => {
                  const bookingId = getBookingId(booking);
                  const customerName = booking.customerName || booking.userName || 'Unknown';
                  const propertyTitle = booking.propertyTitle || booking.propertyName || 'Unknown';

                  return (
                    <tr key={bookingId}>
                      <td>{bookingId}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          {booking.profileImage && <img src={getAdminImageUrl(booking.profileImage)} alt={`${customerName} profile`} style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover' }} />}
                          <div>
                            <strong>{customerName}</strong>
                            <div>{booking.userEmail || 'No email'}</div>
                            <div>{booking.userPhone || booking.customerPhone || 'No phone'}</div>
                            {booking.cnicImage && <a href={getAdminImageUrl(booking.cnicImage)} target="_blank" rel="noreferrer">View CNIC</a>}
                          </div>
                        </div>
                      </td>
                      <td>{propertyTitle}</td>
                      <td>{formatCurrency(booking.amount || 0)}</td>
                      <td><span className={`status-badge ${String(booking.bookingStatus || booking.status || 'pending').toLowerCase()}`}>{booking.bookingStatus || booking.status || 'Pending'}</span></td>
                      <td><span className={`status-badge ${String(booking.paymentStatus || booking.payment || 'pending').toLowerCase()}`}>{booking.paymentStatus || booking.payment || 'Pending'}</span></td>
                      <td>{formatDate(booking.visitDate || booking.bookingDate)}</td>
                      <td>
                        <div className="table-actions">
                          <button type="button" className="table-button light" onClick={() => navigate(`/admin/tenant-profile/${encodeURIComponent(customerName || bookingId)}`)}>Profile</button>
                          <button type="button" className="table-button light" onClick={() => openEditModal(booking)}>Edit</button>
                          <button type="button" className="table-button light" onClick={() => handleDecision(bookingId, 'Approved')} disabled={processingBookingId === (booking._id || booking.id || bookingId)}>{processingBookingId === (booking._id || booking.id || bookingId) ? 'Processing...' : 'Approve'}</button>
                          <button type="button" className="table-button light" onClick={() => handleDecision(bookingId, 'Rejected')} disabled={processingBookingId === (booking._id || booking.id || bookingId)}>{processingBookingId === (booking._id || booking.id || bookingId) ? 'Processing...' : 'Reject'}</button>
                          <button type="button" className="table-button danger" onClick={() => setDeletingId(bookingId)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal
        open={modalOpen}
        title={editingId ? 'Edit Booking' : 'Add Booking'}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <button type="button" className="outline-button" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className="primary-button" form="booking-form">Save Booking</button>
          </>
        }
      >
        <form id="booking-form" className="property-form" onSubmit={saveBooking}>
          <div className="form-grid two-col">
            <label>
              Customer name
              <input value={formData.customerName} onChange={(event) => setFormData((prev) => ({ ...prev, customerName: event.target.value }))} />
              {errors.customerName && <span className="field-error">{errors.customerName}</span>}
            </label>
            <label>
              Customer phone
              <input value={formData.customerPhone} onChange={(event) => setFormData((prev) => ({ ...prev, customerPhone: event.target.value }))} />
              {errors.customerPhone && <span className="field-error">{errors.customerPhone}</span>}
            </label>
          </div>

          <div className="form-grid two-col">
            <label>
              Property title
              <input value={formData.propertyTitle} onChange={(event) => setFormData((prev) => ({ ...prev, propertyTitle: event.target.value }))} />
              {errors.propertyTitle && <span className="field-error">{errors.propertyTitle}</span>}
            </label>
            <label>
              Property type
              <select value={formData.propertyType} onChange={(event) => setFormData((prev) => ({ ...prev, propertyType: event.target.value }))}>
                <option value="House">House</option>
                <option value="Apartment">Apartment</option>
                <option value="Flat">Flat</option>
                <option value="Room">Room</option>
                <option value="Hostel">Hostel</option>
              </select>
            </label>
          </div>

          <div className="form-grid three-col">
            <label>
              Booking date
              <input type="date" value={formData.bookingDate} onChange={(event) => setFormData((prev) => ({ ...prev, bookingDate: event.target.value }))} />
            </label>
            <label>
              Visit date
              <input type="date" value={formData.visitDate} onChange={(event) => setFormData((prev) => ({ ...prev, visitDate: event.target.value }))} />
            </label>
            <label>
              Amount
              <input type="number" value={formData.amount} onChange={(event) => setFormData((prev) => ({ ...prev, amount: event.target.value }))} />
              {errors.amount && <span className="field-error">{errors.amount}</span>}
            </label>
          </div>

          <div className="form-grid two-col">
            <label>
              Booking status
              <select value={formData.bookingStatus} onChange={(event) => setFormData((prev) => ({ ...prev, bookingStatus: event.target.value }))}>
                <option value="Pending">Pending</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
                <option value="Cancelled">Cancelled</option>
                <option value="Completed">Completed</option>
              </select>
            </label>
            <label>
              Payment status
              <select value={formData.paymentStatus} onChange={(event) => setFormData((prev) => ({ ...prev, paymentStatus: event.target.value }))}>
                <option value="Paid">Paid</option>
                <option value="Pending">Pending</option>
                <option value="Failed">Failed</option>
                <option value="Refunded">Refunded</option>
              </select>
            </label>
          </div>

          <label>
            Notes
            <textarea rows="3" value={formData.notes} onChange={(event) => setFormData((prev) => ({ ...prev, notes: event.target.value }))} />
          </label>
        </form>
      </Modal>

      <Modal
        open={Boolean(deletingId)}
        title="Are you sure?"
        onClose={() => setDeletingId(null)}
        footer={
          <>
            <button type="button" className="outline-button" onClick={() => setDeletingId(null)}>Cancel</button>
            <button type="button" className="primary-button danger-button" onClick={() => deleteBooking(deletingId)}>Delete</button>
          </>
        }
      >
        <p>This action cannot be undone.</p>
      </Modal>
    </div>
  );
}

export default BookingsPage;

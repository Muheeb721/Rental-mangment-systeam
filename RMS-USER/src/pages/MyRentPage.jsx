import { useEffect, useMemo, useState } from 'react';
import { Card, Row, Col, Tag, Table, Statistic, Button, Modal } from 'antd';
import { useSelector } from 'react-redux';
import { read, getMyRentSummary } from '../services/rentService.jsx';
import { createNotification } from '../services/notificationService.jsx';
import { addStoredNotification } from '../utils/notificationsStorage.jsx';
import { useNavigate } from 'react-router-dom';
import PaymentModal from '../components/PaymentModal';
import api from '../services/api';
import './MyRentPage.css';

function MyRentPage() {
  const user = useSelector((state) => state.auth?.user || {});
  const [records, setRecords] = useState([]);
  const [bookings, setBookings] = useState([]);
  const navigate = useNavigate();
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsBooking, setDetailsBooking] = useState(null);

  const refreshBookings = async () => {
    try {
      // prefer user's applications endpoint, fall back to bookings
      const response = await api.request('/applications/me').catch(() => null) || await api.request('/bookings/me');
      if (response && response.success) {
        setBookings(response.data || []);
      }
    } catch (error) {
      console.error('Unable to load bookings from backend', error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      const nextRecords = await read();
      setRecords(nextRecords);
      await refreshBookings();
    };

    loadData();
  }, []);

  const summary = useMemo(() => getMyRentSummary(user, records), [user, records]);

  const columns = [
    { title: 'Month', dataIndex: 'month', key: 'month' },
    { title: 'Property', dataIndex: 'propertyName', key: 'propertyName' },
    { title: 'Rent', dataIndex: 'monthlyRent', key: 'monthlyRent', render: (value) => `Rs ${Number(value || 0).toLocaleString()}` },
    { title: 'Paid', dataIndex: 'paid', key: 'paid', render: (value) => `Rs ${Number(value || 0).toLocaleString()}` },
    { title: 'Remaining', dataIndex: 'remaining', key: 'remaining', render: (value) => `Rs ${Number(value || 0).toLocaleString()}` },
    { title: 'Due Date', dataIndex: 'dueDate', key: 'dueDate', render: (value) => value ? new Date(value).toLocaleDateString() : '—' },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (value) => <Tag color={value === 'Paid' ? 'green' : value === 'Overdue' ? 'red' : value === 'Partial' ? 'gold' : 'blue'}>{value}</Tag> },
  ];

  const bookingColumns = [
    { title: 'Booking ID', dataIndex: 'bookingId', key: 'bookingId' },
    { title: 'Property', dataIndex: 'propertyName', key: 'propertyName' },
    { title: 'Type', dataIndex: 'propertyType', key: 'propertyType' },
    { title: 'Rent', dataIndex: 'rent', key: 'rent', render: (v) => `Rs ${Number(v || 0).toLocaleString()}` },
    { title: 'Frequency', dataIndex: 'rentFrequency', key: 'rentFrequency' },
    { title: 'Move-in', dataIndex: 'moveInDate', key: 'moveInDate', render: (v) => v ? new Date(v).toLocaleDateString() : '—' },
    { title: 'Booking Status', dataIndex: 'bookingStatus', key: 'bookingStatus', render: (v) => <Tag color={v === 'Approved' ? 'green' : v === 'Rejected' ? 'red' : v === 'Pending' ? 'gold' : 'blue'}>{v}</Tag> },
    { title: 'Payment Status', dataIndex: 'paymentStatus', key: 'paymentStatus', render: (v) => <Tag color={v === 'Paid' || v === 'Advance Paid' ? 'green' : 'blue'}>{v}</Tag> },
    { title: 'Actions', key: 'actions', render: (_text, record) => (
      <div style={{ display: 'flex', gap: 8 }}>
        <Button onClick={() => navigate(`/properties/${record.propertyId}`)}>View Property</Button>
        <Button onClick={() => { setDetailsBooking(record); setDetailsOpen(true); }}>View Details</Button>
        <Button type="primary" onClick={() => { setSelectedBooking(record); setPaymentOpen(true); }}>Pay</Button>
        <Button danger onClick={() => handleCancelBooking(record)}>Cancel</Button>
      </div>
    ) },
  ];

  const handleSimulatePayment = (booking) => {
    // kept for backward compatibility; open payment modal by default
    setSelectedBooking(booking);
    setPaymentOpen(true);
  };

  const handleCancelBooking = async (booking) => {
    try {
      const id = booking.id || booking.bookingId;
      await api.request(`/bookings/${id}/reject`, { method: 'POST', body: { reason: 'Cancelled by user' } });
      const next = await api.request('/bookings/me');
      if (next && next.success) setBookings(next.data || []);
      try {
        const note = createNotification({ type: 'booking', title: 'Booking Cancelled', message: `Booking ${booking.bookingId} for ${booking.propertyName} was cancelled by user.`, userName: booking.userName, email: booking.userEmail });
        addStoredNotification(note);
      } catch (e) {}
    } catch (e) {
      console.error('Unable to cancel booking', e);
    }
  };

  return (
    <div className="page-shell my-rent-page-shell">
      <section className="section-card my-rent-shell">
        <div className="my-rent-header">
          <div>
            <span className="eyebrow">Rental management</span>
            <h2 className="section-title">My Rentals</h2>
            <p className="section-subtitle">Monitor active leases, payment status, and next rent reminders.</p>
          </div>
          <Button type="primary" onClick={() => navigate('/properties')}>Browse Properties</Button>
        </div>

        <Row gutter={[16, 16]} style={{ marginTop: 20 }}>
          <Col xs={24} md={6}>
            <Card className="rent-summary-card">
              <div className="rent-card-top">Current Rent</div>
              <Statistic value={summary.totalMonthly} prefix="Rs " formatter={(value) => Number(value).toLocaleString()} />
            </Card>
          </Col>
          <Col xs={24} md={6}>
            <Card className="rent-summary-card warning-card">
              <div className="rent-card-top">Outstanding</div>
              <Statistic value={summary.totalDue} prefix="Rs " formatter={(value) => Number(value).toLocaleString()} />
            </Card>
          </Col>
          <Col xs={24} md={6}>
            <Card className="rent-summary-card">
              <div className="rent-card-top">Next Due</div>
              <Statistic value={summary.nextDue ? new Date(summary.nextDue.dueDate).toLocaleDateString() : '—'} />
            </Card>
          </Col>
          <Col xs={24} md={6}>
            <Card className="rent-summary-card success-card">
              <div className="rent-card-top">Status</div>
              <Statistic value={summary.records.some((item) => item.status === 'Overdue') ? 'Overdue' : summary.records.some((item) => item.status === 'Partial') ? 'Partial' : 'On Track'} />
            </Card>
          </Col>
        </Row>

        <div style={{ marginTop: 24 }}>
          {(!summary.records || summary.records.length === 0) && (!bookings || bookings.length === 0) ? (
            <div className="empty-rent-state">
              <h3>No rental records found.</h3>
              <p>It looks like you don't have any active rentals yet. Browse properties to find a place to rent.</p>
              <Button type="primary" onClick={() => navigate('/properties')}>Explore Properties</Button>
            </div>
          ) : (
            <>
              <div className="rental-table-wrap">
                <Table dataSource={summary.records} columns={columns} rowKey="id" pagination={{ pageSize: 8 }} className="modern-rent-table" />
              </div>
              <h3 className="subsection-title">My Rental Bookings</h3>
              <div className="rental-table-wrap">
                <Table dataSource={bookings} columns={bookingColumns} rowKey="id" pagination={{ pageSize: 8 }} className="modern-rent-table" />
              </div>
              <PaymentModal open={paymentOpen} booking={selectedBooking} onClose={async (ok) => {
                setPaymentOpen(false);
                setSelectedBooking(null);
                await refreshBookings();
                if (ok) { /* optional toast */ }
              }} />
              <Modal open={detailsOpen} title="Booking Details" footer={null} onCancel={() => { setDetailsOpen(false); setDetailsBooking(null); }} width={800}>
                {detailsBooking ? (
                  <div>
                    <h3>{detailsBooking.propertyName || detailsBooking.propertyTitle}</h3>
                    <p><strong>Booking ID:</strong> {detailsBooking.bookingId || detailsBooking.id}</p>
                    <p><strong>Type:</strong> {detailsBooking.propertyType}</p>
                    <p><strong>Rent:</strong> Rs {Number(detailsBooking.rent || detailsBooking.amount || 0).toLocaleString()}</p>
                    <p><strong>Move-in:</strong> {detailsBooking.moveInDate ? new Date(detailsBooking.moveInDate).toLocaleDateString() : '—'}</p>
                    <p><strong>Duration:</strong> {detailsBooking.rentalDuration || '—'}</p>
                    <h4>Applicant Information</h4>
                    <p><strong>Name:</strong> {detailsBooking.userName || detailsBooking.customerName}</p>
                    <p><strong>Email:</strong> {detailsBooking.userEmail}</p>
                    <p><strong>Phone:</strong> {detailsBooking.userPhone || detailsBooking.customerPhone}</p>
                    <p><strong>CNIC:</strong> {detailsBooking.cnic || '—'}</p>
                    <h4>Current Address</h4>
                    <p>{detailsBooking.addressLine1 || ''} {detailsBooking.addressLine2 || ''}</p>
                    <p>{detailsBooking.city || ''}, {detailsBooking.province || ''}, {detailsBooking.country || ''}</p>
                    <h4>Employment</h4>
                    <p><strong>Status:</strong> {detailsBooking.employmentStatus || '—'}</p>
                    <p><strong>Company:</strong> {detailsBooking.companyName || '—'}</p>
                    <p><strong>Job Title:</strong> {detailsBooking.jobTitle || '—'}</p>
                    <h4>References</h4>
                    <p><strong>Previous Landlord:</strong> {detailsBooking.previousLandlordName || '—'}</p>
                    <p><strong>Phone:</strong> {detailsBooking.previousLandlordPhone || '—'}</p>
                    <h4>Notes</h4>
                    <p>{detailsBooking.message || detailsBooking.notes || '—'}</p>
                  </div>
                ) : null}
              </Modal>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

export default MyRentPage;

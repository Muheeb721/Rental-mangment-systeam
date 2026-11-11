import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Form, Input, Select, DatePicker, Tag, Table, Row, Col, Modal, Spin, Alert } from 'antd';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { createBooking, listAll, read, update } from '../services/bookingService.jsx';
import { createPayment } from '../services/paymentsService.jsx';
import { useProperties } from '../contexts/PropertyContext';
import { createNotification } from '../services/notificationService.jsx';
import { addStoredNotification } from '../utils/notificationsStorage.jsx';
import { useAuth } from '../contexts/AuthContext';

const statusColors = {
  Pending: 'gold',
  Approved: 'green',
  Rejected: 'red',
  Completed: 'blue',
  Cancelled: 'volcano',
};

function BookingsPage() {
  const { properties } = useProperties();
  const user = useSelector((state) => state.auth?.user || {});
  const { isAuthenticated, isAdmin } = useAuth();
  const [form] = Form.useForm();
  const [open, setOpen] = useState(false);
  const [bookings, setBookings] = useState([]);

  useEffect(() => {
    let mounted = true;
    const loadBookings = async () => {
      setLoading(true);
      setError(null);
      try {
        const nextBookings = isAdmin ? await listAll() : await read();
        if (!mounted) return;
        setBookings(nextBookings);
      } catch (e) {
        console.error('loadBookings error', e);
        setError('Unable to load bookings');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadBookings();
    return () => { mounted = false; };
  }, [isAdmin]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const visibleBookings = useMemo(() => {
    if (isAdmin) return bookings;
    if (!user?.email && !user?.id) return [];
    return bookings.filter((entry) => String(entry.userEmail || '').toLowerCase() === String(user.email || '').toLowerCase() || String(entry.userId || '').toLowerCase() === String(user.id || '').toLowerCase());
  }, [bookings, user, isAdmin]);

  const handleSubmit = async (values) => {
    if (!isAuthenticated || (!user?.id && !user?.email)) {
      toast.error('Please log in before submitting a booking.');
      return;
    }

    const property = properties.find((item) => String(item.id || item._id) === String(values.propertyId));
    if (!property) {
      toast.error('Select a valid property before submitting the booking.');
      return;
    }

    const booking = {
      userId: user.id || undefined,
      userName: user.name || values.name || 'RMS User',
      userEmail: user.email || values.email || 'guest@example.com',
      propertyId: property.id || property._id,
      propertyTitle: property.title || values.propertyTitle || 'Property',
      propertyType: property.type || property.propertyType || values.propertyType || 'Property',
      bookingDate: values.date ? values.date.toISOString() : new Date().toISOString(),
      bookingTime: values.time || '09:00 AM',
      amount: Number(values.amount || 0),
      advance: Number(values.advance || 0),
      remainingAmount: Number(values.amount || 0) - Number(values.advance || 0),
      status: 'Pending',
      notes: values.notes || '',
    };

    let submitted = false;
    try {
      const res = await createBooking(booking);
      if (res && res.success) {
        submitted = true;
        const created = res.data;
        const notification = createNotification({
          type: 'announcement',
          title: 'Booking request created',
          message: `${created.propertyTitle || booking.propertyTitle} booking request submitted and is awaiting review.`,
          userName: created.userName || booking.userName,
          email: created.userEmail || booking.userEmail,
        });
        addStoredNotification(notification);

        try {
          const total = Number(created.amount || booking.amount || 0);
          const advance = Number(created.advance || booking.advance || 0);
          if (total > 0 || advance > 0) {
            createPayment({
              bookingId: created.id || created.bookingId,
              userName: created.userName || booking.userName,
              userEmail: created.userEmail || booking.userEmail,
              userPhone: created.userPhone || booking.userPhone,
              propertyName: created.propertyTitle || booking.propertyTitle,
              propertyId: created.propertyId || booking.propertyId,
              totalAmount: total,
              advanceAmount: advance,
              amountPaid: 0,
              method: 'Pending',
              notes: 'Auto-created from booking',
            });
          }
        } catch (e) {
          console.warn('Unable to create payment for booking', e);
        }

        const refreshed = isAdmin ? await listAll() : await read();
        setBookings(refreshed);
        toast.success('Booking request saved.');
      } else {
        toast.error(res?.message || 'Unable to create booking.');
      }
    } catch (e) {
      console.error('booking submit error', e);
      toast.error('Unable to create booking.');
    }
    if (submitted) {
      setOpen(false);
      form.resetFields();
    }
  };

  const handleDecision = async (id, status) => {
    try {
      const result = await update(id, { status });
      if (!result?.success) {
        throw new Error(result?.message || 'Unable to update booking status.');
      }
      const nextBookings = isAdmin ? await listAll() : await read();
      setBookings(nextBookings);
      const booking = bookings.find((entry) => entry.id === id);
      if (booking) {
        const note = createNotification({
          type: 'announcement',
          title: `Booking ${status}`,
          message: `${booking.propertyTitle} booking has been ${status.toLowerCase()}.`,
          userName: booking.userName,
          email: booking.userEmail,
        });
        addStoredNotification(note);
      }
      toast.success(`Booking ${status.toLowerCase()}.`);
    } catch (error) {
      console.error('Booking decision failed', error);
      toast.error('Unable to update booking status.');
    }
  };

  const columns = [
    { title: 'Booking ID', dataIndex: 'id', key: 'id' },
    { title: 'Property', dataIndex: 'propertyTitle', key: 'propertyTitle' },
    { title: 'Date', dataIndex: 'bookingDate', key: 'bookingDate', render: (value) => value ? new Date(value).toLocaleDateString() : '—' },
    { title: 'Amount', dataIndex: 'amount', key: 'amount', render: (value) => `Rs ${Number(value || 0).toLocaleString()}` },
    { title: 'Advance', dataIndex: 'advance', key: 'advance', render: (value) => `Rs ${Number(value || 0).toLocaleString()}` },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (value) => <Tag color={statusColors[value] || 'default'}>{value}</Tag> },
    ...(isAdmin ? [{ title: 'Action', key: 'action', render: (_, record) => (
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <Button size="small" onClick={() => handleDecision(record.id || record._id, 'Approved')}>Approve</Button>
        <Button size="small" danger onClick={() => handleDecision(record.id || record._id, 'Rejected')}>Reject</Button>
      </div>
    ) }] : []),
  ];

  return (
    <div className="page-shell">
      <section className="section-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <h2 className="section-title">Booking Workflow</h2>
            <p className="section-subtitle">Create, approve, and track property bookings using the live RMS system.</p>
          </div>
          <Button type="primary" onClick={() => setOpen(true)}>Book a Property</Button>
        </div>

        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24} md={8}><Card><strong>{visibleBookings.length}</strong><div>Total Bookings</div></Card></Col>
          <Col xs={24} md={8}><Card><strong>{visibleBookings.filter((b) => b.status === 'Pending').length}</strong><div>Pending</div></Card></Col>
          <Col xs={24} md={8}><Card><strong>{visibleBookings.filter((b) => b.status === 'Approved').length}</strong><div>Approved</div></Card></Col>
        </Row>

        <div style={{ marginTop: 20 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40 }}><Spin size="large" /></div>
          ) : error ? (
            <Alert type="error" message={error} />
          ) : (
            <Table dataSource={visibleBookings} rowKey="id" columns={columns} pagination={{ pageSize: 8 }} />
          )}
        </div>
      </section>

      <Modal open={open} onCancel={() => setOpen(false)} title="Book Property" footer={null} centered>
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="name" label="Full Name" initialValue={user?.name || ''}><Input /></Form.Item>
          <Form.Item name="email" label="Email" initialValue={user?.email || ''}><Input /></Form.Item>
          <Form.Item name="propertyId" label="Property" rules={[{ required: true }]}>
            <Select placeholder="Select property">
              {properties.map((property) => (
                <Select.Option key={property.id || property._id} value={String(property.id || property._id)}>{property.title}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="date" label="Preferred Date"><DatePicker style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="time" label="Preferred Time"><Input placeholder="09:00 AM" /></Form.Item>
          <Form.Item name="amount" label="Total Amount" rules={[{ required: true }]}><Input type="number" /></Form.Item>
          <Form.Item name="advance" label="Advance Amount"><Input type="number" /></Form.Item>
          <Form.Item name="notes" label="Notes"><Input.TextArea rows={3} /></Form.Item>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="primary" htmlType="submit">Confirm Booking</Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
}

export default BookingsPage;

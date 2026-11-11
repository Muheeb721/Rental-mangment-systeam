import { useEffect, useMemo, useState } from 'react';
import { Card, Row, Col, Table, Tag, Button, Space } from 'antd';
import { read, update } from '../services/rentService.jsx';
import bookingService from '../services/bookingService';
import applicationService from '../services/applicationService';
import { useProperties } from '../contexts/PropertyContext';
import { createNotification } from '../services/notificationService.jsx';
import { addStoredNotification } from '../utils/notificationsStorage.jsx';
import { recordAdminAction } from '../services/adminActivityService.jsx';

function AdminRentPage() {
  const [records, setRecords] = useState(() => read());
  const [bookings, setBookings] = useState([]);
  const { setPropertyStatus } = useProperties();

  useEffect(() => {
    const onUpdate = () => setRecords(read());
    window.addEventListener('rms-rent-updated', onUpdate);
    return () => window.removeEventListener('rms-rent-updated', onUpdate);
  }, []);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        // prefer the new applications endpoint, fall back to bookings
        const res = await applicationService.listAll().catch(() => null) || await bookingService.listAllBookings();
        if (mounted && res && res.success) setBookings(res.data || []);
      } catch (e) {
        console.error('Unable to load bookings for admin', e);
      }
    };
    load();
    const onUpdate = () => load();
    window.addEventListener('rms-rental-bookings-updated', onUpdate);
    return () => { mounted = false; window.removeEventListener('rms-rental-bookings-updated', onUpdate); };
  }, []);

  const summary = useMemo(() => {
    const totalMonthly = records.reduce((sum, item) => sum + Number(item.monthlyRent || 0), 0);
    const collected = records.reduce((sum, item) => sum + Number(item.paid || 0), 0);
    const outstanding = records.reduce((sum, item) => sum + Number(item.remaining || 0), 0);
    const overdue = records.filter((item) => item.status === 'Overdue').length;
    return { totalMonthly, collected, outstanding, overdue };
  }, [records]);

  const markPaid = (id) => {
    const target = records.find((item) => item.id === id);
    if (!target) return;

    update(id, {
      paid: Number(target.monthlyRent || 0),
      remaining: 0,
      status: 'Paid',
      paymentStatus: 'Paid',
    });
    setRecords(read());
  };

  const approveBooking = async (b) => {
    try {
      const id = b._id || b.id || b.bookingId;
      const res = await (applicationService.accept(id).catch(() => null) || bookingService.approveBooking(id));
      if (res && res.success) {
        const next = await (applicationService.listAll().catch(() => null) || bookingService.listAllBookings());
        if (next && next.success) setBookings(next.data || []);
      }
    } catch (e) {
      console.error('approveBooking', e);
    }
  };

  const rejectBooking = async (b) => {
    try {
      const id = b._id || b.id || b.bookingId;
      const res = await (applicationService.reject(id, 'Rejected by admin').catch(() => null) || bookingService.rejectBooking(id, { reason: 'Rejected by admin' }));
      if (res && res.success) {
        const next = await (applicationService.listAll().catch(() => null) || bookingService.listAllBookings());
        if (next && next.success) setBookings(next.data || []);
      }
    } catch (e) {
      console.error('rejectBooking', e);
    }
  };

  const markPropertyRented = (b) => {
    try {
      const id = b._id || b.id || b.bookingId;
      bookingService.approveBooking(id).then((res) => {
        if (res && res.success) {
          if (b.propertyId) setPropertyStatus(b.propertyId, 'Rented');
          try {
            const note = createNotification({ type: 'booking', title: 'Booking Confirmed - Rented', message: `Booking ${b.bookingId || b.id} marked as rented for ${b.propertyName}.`, userName: b.userName, email: b.userEmail });
            addStoredNotification(note);
          } catch (e) {}
        }
      }).catch((e) => console.error('markPropertyRented approve failed', e));
    } catch (e) {
      console.error('markPropertyRented', e);
    }
  };

  const columns = [
    { title: 'Tenant', dataIndex: 'tenantName', key: 'tenantName' },
    { title: 'Property', dataIndex: 'propertyName', key: 'propertyName' },
    { title: 'Month', dataIndex: 'month', key: 'month' },
    { title: 'Monthly Rent', dataIndex: 'monthlyRent', key: 'monthlyRent', render: (value) => `Rs ${Number(value || 0).toLocaleString()}` },
    { title: 'Paid', dataIndex: 'paid', key: 'paid', render: (value) => `Rs ${Number(value || 0).toLocaleString()}` },
    { title: 'Outstanding', dataIndex: 'remaining', key: 'remaining', render: (value) => `Rs ${Number(value || 0).toLocaleString()}` },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (value) => <Tag color={value === 'Paid' ? 'green' : value === 'Overdue' ? 'red' : value === 'Partial' ? 'gold' : 'blue'}>{value}</Tag> },
    { title: 'Action', key: 'action', render: (_, row) => row.status !== 'Paid' ? <Button size="small" type="primary" onClick={() => markPaid(row.id)}>Mark Paid</Button> : <Tag>Completed</Tag> },
  ];

  const bookingColumns = [
    { title: 'Booking ID', dataIndex: 'bookingId', key: 'bookingId' },
    { title: 'User', dataIndex: 'userName', key: 'userName' },
    { title: 'Property', dataIndex: 'propertyName', key: 'propertyName' },
    { title: 'Rent', dataIndex: 'rent', key: 'rent', render: (v) => `Rs ${Number(v || 0).toLocaleString()}` },
    { title: 'Move-in', dataIndex: 'moveInDate', key: 'moveInDate', render: (v) => v ? new Date(v).toLocaleDateString() : '—' },
    { title: 'Status', dataIndex: 'bookingStatus', key: 'bookingStatus', render: (v) => <Tag color={v === 'Approved' ? 'green' : v === 'Rejected' ? 'red' : 'gold'}>{v}</Tag> },
    { title: 'Actions', key: 'actions', render: (_text, record) => (
      <Space>
        <Button onClick={() => approveBooking(record)}>Approve</Button>
        <Button danger onClick={() => rejectBooking(record)}>Reject</Button>
        <Button type="primary" onClick={() => markPropertyRented(record)}>Mark Rented</Button>
      </Space>
    ) },
  ];

  return (
    <div className="page-shell">
      <section className="section-card">
        <h2 className="section-title">Admin Rent Dashboard</h2>
        <p className="section-subtitle">Track rent collection, outstanding balances, and overdue tenants.</p>

        <Row gutter={[16, 16]} style={{ marginTop: 20 }}>
          <Col xs={24} md={6}><Card><strong>Rs {summary.totalMonthly.toLocaleString()}</strong><div>Total Monthly Rent</div></Card></Col>
          <Col xs={24} md={6}><Card><strong>Rs {summary.collected.toLocaleString()}</strong><div>Collected</div></Card></Col>
          <Col xs={24} md={6}><Card><strong>Rs {summary.outstanding.toLocaleString()}</strong><div>Outstanding</div></Card></Col>
          <Col xs={24} md={6}><Card><strong>{summary.overdue}</strong><div>Overdue</div></Card></Col>
        </Row>

        <div style={{ marginTop: 24 }}>
          <Table dataSource={records} columns={columns} rowKey="id" pagination={{ pageSize: 8 }} />
          <h3 style={{ marginTop: 24 }}>Rental Bookings</h3>
          <Table dataSource={bookings} columns={bookingColumns} rowKey="id" pagination={{ pageSize: 8 }} />
        </div>
      </section>
    </div>
  );
}

export default AdminRentPage;

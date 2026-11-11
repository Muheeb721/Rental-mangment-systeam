import { useEffect, useState } from 'react';
import { Table, Button, Space, Tag, Card } from 'antd';
import applicationService from '../services/applicationService';
import bookingService from '../services/bookingService';
import { useProperties } from '../contexts/PropertyContext';

function AdminApplicationsPage() {
  const [applications, setApplications] = useState([]);
  const { setPropertyStatus } = useProperties();

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await applicationService.listAll().catch(() => null) || await bookingService.listAllBookings();
        if (mounted && res && res.success) setApplications(res.data || []);
      } catch (e) {
        console.error('Unable to load applications', e);
      }
    };
    load();
    const onUpdate = () => load();
    window.addEventListener('rms-applications-updated', onUpdate);
    return () => { mounted = false; window.removeEventListener('rms-applications-updated', onUpdate); };
  }, []);

  const accept = async (row) => {
    try {
      const id = row._id || row.id || row.bookingId;
      const res = await applicationService.accept(id).catch(() => null) || await bookingService.approveBooking(id);
      if (res && res.success) {
        if (row.propertyId) setPropertyStatus(row.propertyId, 'Booked');
        const next = await (applicationService.listAll().catch(() => null) || bookingService.listAllBookings());
        if (next && next.success) setApplications(next.data || []);
      }
    } catch (e) { console.error('Accept failed', e); }
  };

  const reject = async (row) => {
    try {
      const id = row._id || row.id || row.bookingId;
      const res = await applicationService.reject(id, 'Rejected by admin').catch(() => null) || await bookingService.rejectBooking(id, { reason: 'Rejected by admin' });
      if (res && res.success) {
        if (row.propertyId) setPropertyStatus(row.propertyId, 'Available');
        const next = await (applicationService.listAll().catch(() => null) || bookingService.listAllBookings());
        if (next && next.success) setApplications(next.data || []);
      }
    } catch (e) { console.error('Reject failed', e); }
  };

  const columns = [
    { title: 'Application ID', dataIndex: '_id', key: '_id' },
    { title: 'Applicant', dataIndex: 'userName', key: 'userName' },
    { title: 'Email', dataIndex: 'userEmail', key: 'userEmail' },
    { title: 'Property', dataIndex: 'propertyTitle', key: 'propertyTitle' },
    { title: 'Rent', dataIndex: 'rent', key: 'rent', render: (v) => `Rs ${Number(v || 0).toLocaleString()}` },
    { title: 'Status', dataIndex: 'applicationStatus', key: 'applicationStatus', render: (s) => <Tag color={s === 'accepted' ? 'green' : s === 'rejected' ? 'red' : 'gold'}>{s}</Tag> },
    { title: 'Actions', key: 'actions', render: (_t, r) => (
      <Space>
        <Button onClick={() => accept(r)}>Accept</Button>
        <Button danger onClick={() => reject(r)}>Reject</Button>
      </Space>
    ) },
  ];

  return (
    <div className="page-shell">
      <section className="section-card">
        <h2 className="section-title">Applications</h2>
        <p className="section-subtitle">Review user rental applications submitted through the platform.</p>
        <Card style={{ marginTop: 16 }}>
          <Table dataSource={applications} columns={columns} rowKey={(r) => r._id || r.id || r.bookingId} pagination={{ pageSize: 12 }} />
        </Card>
      </section>
    </div>
  );
}

export default AdminApplicationsPage;

import { useEffect, useMemo, useState } from 'react';
import { Card, Row, Col, Table, Tag, Button } from 'antd';
import { read, update } from '../services/rentService.jsx';

function RentManagementPage() {
  const [records, setRecords] = useState(() => read());

  useEffect(() => {
    const onUpdate = () => setRecords(read());
    window.addEventListener('rms-rent-updated', onUpdate);
    return () => window.removeEventListener('rms-rent-updated', onUpdate);
  }, []);

  const summary = useMemo(() => {
    const totalMonthly = records.reduce((sum, item) => sum + Number(item.monthlyRent || 0), 0);
    const totalPaid = records.reduce((sum, item) => sum + Number(item.paid || 0), 0);
    const totalPending = records.reduce((sum, item) => sum + Number(item.remaining || 0), 0);
    const overdue = records.filter((item) => item.status === 'Overdue').length;

    return { totalMonthly, totalPaid, totalPending, overdue };
  }, [records]);

  const handleMarkPaid = (id) => {
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

  const columns = [
    { title: 'Tenant', dataIndex: 'tenantName', key: 'tenantName' },
    { title: 'Property', dataIndex: 'propertyName', key: 'propertyName' },
    { title: 'Month', dataIndex: 'month', key: 'month' },
    { title: 'Rent', dataIndex: 'monthlyRent', key: 'monthlyRent', render: (value) => `Rs ${Number(value || 0).toLocaleString()}` },
    { title: 'Paid', dataIndex: 'paid', key: 'paid', render: (value) => `Rs ${Number(value || 0).toLocaleString()}` },
    { title: 'Remaining', dataIndex: 'remaining', key: 'remaining', render: (value) => `Rs ${Number(value || 0).toLocaleString()}` },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (value) => <Tag color={value === 'Paid' ? 'green' : value === 'Overdue' ? 'red' : value === 'Partial' ? 'gold' : 'blue'}>{value}</Tag> },
    { title: 'Action', key: 'action', render: (_, row) => row.status !== 'Paid' ? <Button size="small" type="primary" onClick={() => handleMarkPaid(row.id)}>Mark Paid</Button> : <Tag>Closed</Tag> },
  ];

  return (
    <div className="page-shell">
      <section className="section-card">
        <h2 className="section-title">Rent Management</h2>
        <p className="section-subtitle">Manage monthly rent collection, payment status, and outstanding balances.</p>

        <Row gutter={[16, 16]} style={{ marginTop: 20 }}>
          <Col xs={24} md={6}><Card><strong>{records.length}</strong><div>Total Rent Records</div></Card></Col>
          <Col xs={24} md={6}><Card><strong>Rs {summary.totalMonthly.toLocaleString()}</strong><div>Monthly Rent</div></Card></Col>
          <Col xs={24} md={6}><Card><strong>Rs {summary.totalPaid.toLocaleString()}</strong><div>Collected</div></Card></Col>
          <Col xs={24} md={6}><Card><strong>{summary.overdue}</strong><div>Overdue</div></Card></Col>
        </Row>

        <div style={{ marginTop: 24 }}>
          <Table dataSource={records} columns={columns} rowKey="id" pagination={{ pageSize: 8 }} />
        </div>
      </section>
    </div>
  );
}

export default RentManagementPage;

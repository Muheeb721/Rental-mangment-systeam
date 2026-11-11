import { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, DatePicker, Tag, Spin, Alert, Row, Col, Card, Statistic } from 'antd';
import { toast } from 'react-toastify';
import { getPayments, createPayment } from '../services/paymentsService.jsx';
import { useSelector, useDispatch } from 'react-redux';
import { addNotification } from '../redux/store';
import './PaymentsPage.css';

const statusColor = (s) => {
  if (!s) return 'default';
  if (s === 'Paid') return 'green';
  if (s === 'Partial Payment') return 'orange';
  if (s === 'Pending') return 'gold';
  if (s === 'Overdue') return 'red';
  return 'blue';
};

function PaymentsPage() {
  const dispatch = useDispatch();
  const user = useSelector((s) => s.auth.user);
  const [payments, setPayments] = useState([]);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const all = await getPayments();
        if (!mounted) return;
        setPayments(Array.isArray(all) ? all.filter((p) => !user || String(p.userEmail) === String(user.email) || String(p.userId) === String(user.id)) : []);
      } catch (e) {
        console.error('load payments failed', e);
        if (mounted) setError('Unable to load payments');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    const onUpdate = () => load();
    window.addEventListener('rms-payments-updated', onUpdate);
    return () => { mounted = false; window.removeEventListener('rms-payments-updated', onUpdate); };
  }, [user]);

  const submit = async (vals) => {
    const payload = {
      userName: vals.fullName,
      userEmail: vals.email,
      userPhone: vals.phone,
      propertyName: vals.propertyName,
      propertyType: vals.propertyType,
      bookingId: vals.bookingId,
      totalAmount: Number(vals.totalAmount || 0),
      advanceAmount: Number(vals.advanceAmount || 0),
      amountPaid: Number(vals.paymentAmount || 0),
      method: vals.paymentMethod,
      paymentDate: vals.paymentDate ? vals.paymentDate.toISOString() : new Date().toISOString(),
      notes: vals.notes || '',
      status: undefined,
    };

    try {
      const result = await createPayment(payload);
      if (result && result.success && result.data) {
        const paymentId = result.data.id || result.data._id || 'record';
        dispatch(addNotification({ id: Date.now(), title: 'Payment submitted successfully.', message: `Payment ${paymentId} recorded.`, unread: true, accent: 'success' }));
        toast.success('Payment submitted successfully.');
        const refreshed = await getPayments();
        setPayments(Array.isArray(refreshed) ? refreshed.filter((p) => !user || String(p.userEmail) === String(user.email) || String(p.userId) === String(user.id)) : []);
      } else {
        dispatch(addNotification({ id: Date.now(), title: 'Payment submission failed', message: result?.message || 'Unable to submit payment.', unread: true, accent: 'warning' }));
        toast.error(result?.message || 'Unable to submit payment.');
      }
    } catch (e) {
      console.error('payment submission failed', e);
      dispatch(addNotification({ id: Date.now(), title: 'Payment submission failed', message: 'Unable to submit payment.', unread: true, accent: 'warning' }));
      toast.error('Unable to submit payment.');
    } finally {
      setOpen(false);
      form.resetFields();
    }
  };

  const columns = [
    { title: 'Payment ID', dataIndex: 'id', key: 'id' },
    { title: 'Property', dataIndex: 'propertyName', key: 'propertyName' },
    { title: 'Amount', dataIndex: 'amountPaid', key: 'amountPaid', render: (v) => `$${v}` },
    { title: 'Remaining', dataIndex: 'remainingAmount', key: 'remainingAmount', render: (v) => `$${v}` },
    { title: 'Method', dataIndex: 'method', key: 'method' },
    { title: 'Date', dataIndex: 'paymentDate', key: 'paymentDate', render: (d) => d ? new Date(d).toLocaleString() : '' },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (s) => <Tag color={statusColor(s)}>{s}</Tag> },
  ];

  const summary = payments.reduce((acc, item) => {
    const total = Number(item.totalAmount || item.amountPaid || 0);
    const paid = Number(item.amountPaid || 0);
    const remaining = Number(item.remainingAmount || Math.max(total - paid, 0));
    acc.totalRent += total;
    acc.paid += paid;
    acc.remaining += remaining;
    return acc;
  }, { totalRent: 0, paid: 0, remaining: 0 });

  return (
    <div className="page-shell payments-page-shell">
      <section className="section-card payments-shell">
        <div className="payments-header">
          <div>
            <span className="eyebrow">Payment management</span>
            <h2 className="section-title">Payments</h2>
            <p className="section-subtitle">Track rent, partial payment balances, and your payment history.</p>
          </div>
          <Button type="primary" onClick={() => setOpen(true)}>Make a Payment</Button>
        </div>

        <Row gutter={[16, 16]} style={{ marginTop: 20 }}>
          <Col xs={24} md={6}><Card className="payment-stat-card"><Statistic title="Total Rent" value={summary.totalRent} prefix="Rs " formatter={(value) => Number(value).toLocaleString()} /></Card></Col>
          <Col xs={24} md={6}><Card className="payment-stat-card"><Statistic title="Paid Amount" value={summary.paid} prefix="Rs " formatter={(value) => Number(value).toLocaleString()} /></Card></Col>
          <Col xs={24} md={6}><Card className="payment-stat-card warning-card"><Statistic title="Remaining" value={summary.remaining} prefix="Rs " formatter={(value) => Number(value).toLocaleString()} /></Card></Col>
          <Col xs={24} md={6}><Card className="payment-stat-card success-card"><Statistic title="Status" value={summary.remaining > 0 ? 'Partial' : 'Current'} /></Card></Col>
        </Row>

        <div className="payment-table-wrap" style={{ marginTop: 24 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40 }}><Spin size="large" /></div>
          ) : error ? (
            <Alert type="error" message={error} />
          ) : (
            <Table dataSource={payments} rowKey={(r) => r.id} columns={columns} pagination={{ pageSize: 8 }} className="modern-payment-table" />
          )}
        </div>

        <Modal open={open} onCancel={() => setOpen(false)} footer={null} title="Make a Payment">
          <Form layout="vertical" form={form} onFinish={submit}>
            <Form.Item name="fullName" label="Full Name" rules={[{ required: true }]}><Input /></Form.Item>
            <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}><Input /></Form.Item>
            <Form.Item name="phone" label="Phone" rules={[{ required: true }]}><Input /></Form.Item>
            <Form.Item name="propertyName" label="Property Name" rules={[{ required: true }]}><Input /></Form.Item>
            <Form.Item name="propertyType" label="Property Type"><Select><Select.Option value="House">House</Select.Option><Select.Option value="Flat">Flat</Select.Option><Select.Option value="Apartment">Apartment</Select.Option></Select></Form.Item>
            <Form.Item name="bookingId" label="Booking ID"><Input /></Form.Item>
            <Form.Item name="totalAmount" label="Total Amount" rules={[{ required: true }]}><Input /></Form.Item>
            <Form.Item name="advanceAmount" label="Advance Amount"><Input /></Form.Item>
            <Form.Item name="paymentAmount" label="Payment Amount" rules={[{ required: true }]}><Input /></Form.Item>
            <Form.Item name="paymentMethod" label="Payment Method" rules={[{ required: true }]}>
              <Select>
                <Select.Option value="Cash">Cash</Select.Option>
                <Select.Option value="Bank Transfer">Bank Transfer</Select.Option>
                <Select.Option value="Card">Card</Select.Option>
                <Select.Option value="Other">Other</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item name="paymentDate" label="Payment Date"><DatePicker style={{ width: '100%' }} /></Form.Item>
            <Form.Item name="dueDate" label="Due Date"><DatePicker style={{ width: '100%' }} /></Form.Item>
            <Form.Item name="notes" label="Notes"><Input.TextArea rows={3} /></Form.Item>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Button onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit">Submit Payment</Button>
            </div>
          </Form>
        </Modal>
      </section>
    </div>
  );
}

export default PaymentsPage;

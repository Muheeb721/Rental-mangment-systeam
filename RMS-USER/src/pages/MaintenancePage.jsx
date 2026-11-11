import { useEffect, useMemo, useState } from 'react';
import { Card, Row, Col, Table, Tag, Button, Form, Input, Select, DatePicker, Modal } from 'antd';
import { add, read, update } from '../services/maintenanceService.jsx';
import './MaintenancePage.css';

const statusColor = (status) => {
  if (status === 'Open') return 'red';
  if (status === 'In Progress') return 'gold';
  if (status === 'Resolved') return 'green';
  return 'blue';
};

function MaintenancePage() {
  const [requests, setRequests] = useState([]);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    const loadRequests = async () => {
      const next = await read();
      setRequests(next);
    };

    loadRequests();
  }, []);

  const summary = useMemo(() => {
    const counts = { open: 0, inProgress: 0, resolved: 0 };
    requests.forEach((item) => {
      if (item.status === 'Open') counts.open += 1;
      else if (item.status === 'In Progress') counts.inProgress += 1;
      else if (item.status === 'Resolved') counts.resolved += 1;
    });

    return counts;
  }, [requests]);

  const handleSubmit = async (values) => {
    await add({
      tenantName: values.tenantName,
      tenantEmail: values.tenantEmail,
      propertyName: values.propertyName,
      propertyType: values.propertyType,
      category: values.category,
      priority: values.priority,
      issue: values.issue,
      status: 'Open',
      dueDate: values.dueDate ? values.dueDate.format('YYYY-MM-DD') : undefined,
    });

    const next = await read();
    setRequests(next);
    form.resetFields();
    setOpen(false);
  };

  const handleStatusUpdate = async (id, status) => {
    await update(id, { status });
    const next = await read();
    setRequests(next);
  };

  const columns = [
    { title: 'Tenant', dataIndex: 'tenantName', key: 'tenantName' },
    { title: 'Property', dataIndex: 'propertyName', key: 'propertyName' },
    { title: 'Category', dataIndex: 'category', key: 'category' },
    { title: 'Priority', dataIndex: 'priority', key: 'priority', render: (value) => <Tag color={value === 'High' ? 'red' : value === 'Medium' ? 'gold' : 'blue'}>{value}</Tag> },
    { title: 'Issue', dataIndex: 'issue', key: 'issue' },
    { title: 'Due', dataIndex: 'dueDate', key: 'dueDate', render: (value) => value ? new Date(value).toLocaleDateString() : '—' },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (value) => <Tag color={statusColor(value)}>{value}</Tag> },
    {
      title: 'Action',
      key: 'action',
      render: (_, row) => (
        <Select
          value={row.status}
          size="small"
          style={{ width: 130 }}
          onChange={(value) => handleStatusUpdate(row.id, value)}
          options={[
            { value: 'Open', label: 'Open' },
            { value: 'In Progress', label: 'In Progress' },
            { value: 'Resolved', label: 'Resolved' },
          ]}
        />
      ),
    },
  ];

  return (
    <div className="page-shell maintenance-page-shell">
      <section className="section-card maintenance-shell">
        <div className="maintenance-header">
          <div>
            <span className="eyebrow">Complaint & maintenance</span>
            <h2 className="section-title">Service Requests</h2>
            <p className="section-subtitle">Submit issues, track priorities, and monitor maintenance progress.</p>
          </div>
          <Button type="primary" onClick={() => setOpen(true)}>New Request</Button>
        </div>

        <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
          <Col xs={24} md={8}><Card className="maintenance-stat-card"><strong>{requests.length}</strong><div>Total Requests</div></Card></Col>
          <Col xs={24} md={8}><Card className="maintenance-stat-card warning-card"><strong>{summary.open}</strong><div>Open</div></Card></Col>
          <Col xs={24} md={8}><Card className="maintenance-stat-card success-card"><strong>{summary.inProgress}</strong><div>In Progress</div></Card></Col>
        </Row>

        <div className="maintenance-table-wrap">
          <Table dataSource={requests} columns={columns} rowKey="id" pagination={{ pageSize: 8 }} className="modern-maintenance-table" />
        </div>
      </section>

      <Modal open={open} onCancel={() => setOpen(false)} footer={null} title="Submit maintenance request">
        <Form layout="vertical" form={form} onFinish={handleSubmit}>
          <Form.Item name="tenantName" label="Tenant Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="tenantEmail" label="Tenant Email" rules={[{ required: true, type: 'email' }]}><Input /></Form.Item>
          <Form.Item name="propertyName" label="Property Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="propertyType" label="Property Type" initialValue="Apartment">
            <Select>
              <Select.Option value="Apartment">Apartment</Select.Option>
              <Select.Option value="Flat">Flat</Select.Option>
              <Select.Option value="House">House</Select.Option>
              <Select.Option value="Hostel">Hostel</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="category" label="Category" initialValue="General">
            <Select>
              <Select.Option value="Plumbing">Plumbing</Select.Option>
              <Select.Option value="Electrical">Electrical</Select.Option>
              <Select.Option value="HVAC">HVAC</Select.Option>
              <Select.Option value="Security">Security</Select.Option>
              <Select.Option value="General">General</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="priority" label="Priority" initialValue="Medium">
            <Select>
              <Select.Option value="Low">Low</Select.Option>
              <Select.Option value="Medium">Medium</Select.Option>
              <Select.Option value="High">High</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="issue" label="Issue Details" rules={[{ required: true }]}><Input.TextArea rows={4} /></Form.Item>
          <Form.Item name="dueDate" label="Due Date"><DatePicker style={{ width: '100%' }} /></Form.Item>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="primary" htmlType="submit">Submit</Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
}

export default MaintenancePage;

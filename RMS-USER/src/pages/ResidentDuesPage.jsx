import { useEffect } from 'react';
import { Card, Row, Col, Progress, Tag, Button } from 'antd';
import { dues } from '../data/dummyData';
import './ResidentDuesPage.css';
import { addStoredNotification } from '../utils/notificationsStorage.jsx';

function ResidentDuesPage() {
  useEffect(() => {
    addStoredNotification({
      title: 'Rent Payment Reminder',
      message: 'Your rent dues are being reviewed. Please complete your payment to avoid late charges.',
      category: 'Rent',
      accent: 'warning',
      icon: '💳',
      action: 'Pay Now',
    }, []);
  }, []);
  return (
    <div className="page-shell">
      <section className="section-card">
        <h2 className="section-title">Resident Dues</h2>
        <p className="section-subtitle">Stay ahead of payments, overdue reminders, and invoice history.</p>
        <Row gutter={[16, 16]}>
          {dues.map((item) => (
            <Col xs={24} md={12} key={item.id}>
              <Card>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong>{item.title}</strong>
                  <Tag color={item.status === 'Paid' ? 'green' : item.status === 'Unpaid' ? 'volcano' : 'gold'}>{item.status}</Tag>
                </div>
                <div style={{ fontWeight: 700, fontSize: 22, marginTop: 8 }}>{item.amount}</div>
                <div style={{ color: '#64809b', marginTop: 4 }}>Due {item.dueDate} • {item.daysLeft} days remaining</div>
                <Progress percent={item.progress} style={{ marginTop: 12 }} />
                <div className="card-actions">
                  <Button type="primary">Download Invoice</Button>
                  <Button>Payment History</Button>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      </section>
    </div>
  );
}

export default ResidentDuesPage;

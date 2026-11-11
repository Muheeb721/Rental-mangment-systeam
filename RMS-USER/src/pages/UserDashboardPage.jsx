import { useEffect, useMemo, useState } from "react";
import { Row, Col, Card, Tag, Button, Divider, List, Spin, Alert } from "antd";
import { DeleteOutlined, InboxOutlined, HomeOutlined, WalletOutlined, BellOutlined, WarningOutlined, ToolOutlined } from "@ant-design/icons";
import {
  readDashboardSubmissions,
  removeDashboardSubmission,
} from "../utils/dashboardSubmissionStorage.jsx";
import api from '../services/api';
import "./UserDashboardPage.css";
import { read as readInquiries } from '../utils/propertyInquiriesStorage';
import { read as readVisits } from '../utils/propertyVisitsStorage';
import { read as readSavedSearches } from '../utils/savedSearchesStorage.jsx';

const formatDate = (value) => {
  if (!value) return "Just now";

  try {
    return new Date(value).toLocaleString("en-PK", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch (error) {
    return "Just now";
  }
};

function UserDashboardPage() {
  const [submissions, setSubmissions] = useState([]);
  const [inquiries, setInquiries] = useState([]);
  const [visits, setVisits] = useState([]);
  const [savedSearches, setSavedSearches] = useState([]);
  const [notificationsState, setNotificationsState] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refreshSubmissions = () => setSubmissions(readDashboardSubmissions());

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        // submissions from backend
        const subsRes = await api.request('/contact?type=Dashboard');
        const subs = subsRes?.data ?? subsRes ?? [];
        // inquiries, visits and saved searches via utils/services
        const [inq, v, saved] = await Promise.all([readInquiries(), readVisits(), readSavedSearches()]);
        const notifications = [];
        // fetch user bookings
        let bookingsList = [];
        try {
          const bk = await api.request('/bookings/me');
          if (bk && bk.success) bookingsList = bk.data || [];
        } catch (e) {
          console.warn('Unable to load user bookings for dashboard', e);
        }
        if (!mounted) return;
        setSubmissions(Array.isArray(subs) ? subs : []);
        setInquiries(inq || []);
        setVisits(v || []);
        setSavedSearches(saved || []);
        setNotificationsState(notifications);
        setBookings(bookingsList || []);
      } catch (e) {
        console.error('UserDashboard load failed', e);
        if (mounted) setError('Unable to load dashboard data');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();

    return () => { mounted = false; };
  }, []);

  const stats = useMemo(() => {
    const total = submissions.length;
    const newCount = submissions.filter((item) => item.status === "New").length;
    const propertyCount = submissions.filter((item) =>
      ["House", "Apartment", "Flat", "Room", "Hostel", "Property"].includes(item.propertyType || item.category),
    ).length;
    const uniqueTypes = new Set(submissions.map((item) => item.formType || item.source)).size;

    return { total, newCount, propertyCount, uniqueTypes };
  }, [submissions]);

  const groupedTypes = useMemo(() => {
    const map = new Map();

    submissions.forEach((item) => {
      const key = item.formType || item.source || "General";
      map.set(key, (map.get(key) || 0) + 1);
    });

    return [...map.entries()].map(([name, count]) => ({ name, count }));
  }, [submissions]);

  const handleDelete = (id) => {
    removeDashboardSubmission(id);
    refreshSubmissions();
  };

  return (
    <div className="page-shell dashboard-page-shell">
      <section className="section-card dashboard-shell">
        <div className="dashboard-header">
          <div>
            <span className="eyebrow">Tenant dashboard</span>
            <h2 className="section-title">User Dashboard</h2>
            <p className="section-subtitle">
              Your home, rental, payment, and service activity in one place.
            </p>
          </div>
          <Tag color="blue">{stats.total} total records</Tag>
        </div>

        <Row gutter={[16, 16]}>
          <Col xs={24} md={6}>
            <Card className="metric-card">
              <div className="metric-card-top"><HomeOutlined /> <span>Active Rentals</span></div>
              <strong className="metric-value">{stats.propertyCount || 2}</strong>
            </Card>
          </Col>
          <Col xs={24} md={6}>
            <Card className="metric-card">
              <div className="metric-card-top"><WalletOutlined /> <span>Pending Payments</span></div>
              <strong className="metric-value">{stats.newCount || 1}</strong>
            </Card>
          </Col>
          <Col xs={24} md={6}>
            <Card className="metric-card danger-card">
              <div className="metric-card-top"><WarningOutlined /> <span>Overdue</span></div>
              <strong className="metric-value">{stats.newCount > 0 ? 1 : 0}</strong>
            </Card>
          </Col>
          <Col xs={24} md={6}>
            <Card className="metric-card">
              <div className="metric-card-top"><ToolOutlined /> <span>Open Complaints</span></div>
              <strong className="metric-value">{stats.uniqueTypes || 2}</strong>
            </Card>
          </Col>
        </Row>

        <Divider />

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><Spin size="large" /></div>
        ) : error ? (
          <Alert type="error" message={error} style={{ marginBottom: 16 }} />
        ) : null}

        <Row gutter={[16,16]}>
          <Col xs={24} lg={8}>
            <Card title="My Inquiries" className="dashboard-panel">
              <List dataSource={(inquiries || []).slice(0,8)} renderItem={(item) => (
                <List.Item>
                  <div><strong>{item.propertyTitle || '—'}</strong><div style={{ fontSize: 12 }}>{item.name} — {item.status}</div></div>
                </List.Item>
              )} />
            </Card>
          </Col>
          <Col xs={24} lg={8}>
            <Card title="My Visit Requests" className="dashboard-panel">
              <List dataSource={(visits || []).slice(0,8)} renderItem={(item) => (
                <List.Item>
                  <div><strong>{item.propertyTitle || '—'}</strong><div style={{ fontSize: 12 }}>{item.name} — {item.status}</div></div>
                </List.Item>
              )} />
            </Card>
          </Col>
          <Col xs={24} lg={8}>
            <Card title="Notifications" className="dashboard-panel">
              <List dataSource={readStoredNotifications ? readStoredNotifications([]).slice(0, 5) : []} renderItem={(item) => (
                <List.Item>
                  <div><strong>{item.title}</strong><div style={{ fontSize: 12 }}>{item.message}</div></div>
                </List.Item>
              )} />
            </Card>
          </Col>
        </Row>

        <Divider />

        <Row gutter={[16, 16]}>
          <Col xs={24} lg={15}>
            <Card title="Recent submissions" className="dashboard-panel">
              {submissions.length === 0 ? (
                <div className="empty-state">
                  <InboxOutlined className="empty-icon" />
                  <p>No submissions yet. Forms submitted from the site will appear here automatically.</p>
                </div>
              ) : (
                <List
                  dataSource={submissions.slice(0, 8)}
                  renderItem={(item) => (
                    <List.Item
                      actions={[
                        <Button
                          key="delete"
                          danger
                          type="text"
                          icon={<DeleteOutlined />}
                          onClick={() => handleDelete(item.id)}
                        >
                          Delete
                        </Button>,
                      ]}
                    >
                      <div className="submission-row">
                        <div className="submission-header">
                          <strong>{item.title || item.formType}</strong>
                          <Tag color={item.status === "New" ? "blue" : "green"}>{item.status || "New"}</Tag>
                        </div>
                        <div className="submission-meta">
                          <span>{item.userName || "RMS User"}</span>
                          <span>{item.email || "No email"}</span>
                          <span>{item.formType || item.source}</span>
                        </div>
                        <div className="submission-footer">
                          <span>{item.location || item.propertyType || "General"}</span>
                          <span>{item.price || "—"}</span>
                          <span>{formatDate(item.submittedAt)}</span>
                        </div>
                        {item.description ? <p className="submission-description">{item.description}</p> : null}
                      </div>
                    </List.Item>
                  )}
                />
              )}
            </Card>
          </Col>
          <Col xs={24} lg={9}>
            <Card title="My Bookings" className="dashboard-panel">
              {(!bookings || bookings.length === 0) ? (
                <div className="empty-state compact"><p>No bookings yet.</p></div>
              ) : (
                <List dataSource={(bookings || []).slice(0,8)} renderItem={(item) => (
                  <List.Item>
                    <div>
                      <strong>{item.propertyTitle || item.propertyName || 'Property'}</strong>
                      <div style={{ fontSize: 12 }}>{item.bookingId || item._id || item.id} — {item.bookingStatus || item.status || 'Pending'}</div>
                    </div>
                  </List.Item>
                )} />
              )}
            </Card>
          </Col>

          <Col xs={24} lg={9}>
            <Card title="Submission breakdown" className="dashboard-panel">
              {groupedTypes.length === 0 ? (
                <div className="empty-state compact">
                  <p>No detailed form data available yet.</p>
                </div>
              ) : (
                <div className="type-list">
                  {groupedTypes.map(({ name, count }) => (
                    <div key={name} className="type-item">
                      <span>{name}</span>
                      <Tag color="geekblue">{count}</Tag>
                    </div>
                  ))}
                </div>
              )}
            </Card>
            <Card title="My Bookings" style={{ marginTop: 16 }}>
              {bookings && bookings.length > 0 ? (
                <List dataSource={bookings.slice(0,6)} renderItem={(b) => (
                  <List.Item>
                    <div style={{ width: '100%' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <strong>{b.propertyTitle || b.propertyName}</strong>
                        <Tag color={b.status === 'Approved' ? 'green' : b.status === 'Rejected' ? 'red' : 'gold'}>{b.status || b.bookingStatus || 'Pending'}</Tag>
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>{b.propertyType || 'Property'} — Rs {Number(b.rent || b.amount || 0).toLocaleString()}</div>
                      <div style={{ marginTop: 6, fontSize: 12 }}>{new Date(b.createdAt || b.bookingDate || Date.now()).toLocaleDateString()}</div>
                    </div>
                  </List.Item>
                )} />
              ) : (
                <div>No bookings yet. Browse properties to apply for rent.</div>
              )}
            </Card>
          </Col>
        </Row>
      </section>
    </div>
  );
}

export default UserDashboardPage;

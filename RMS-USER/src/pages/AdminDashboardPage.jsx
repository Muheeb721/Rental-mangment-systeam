import { useEffect, useState } from 'react';
import { Row, Col, Card, Table, List, Tag, Button, Select, Spin, Alert } from "antd";
import { adminMetrics, bookings } from "../data/dummyData";
import { getPayments } from '../services/paymentsService.jsx';
import "./AdminDashboardPage.css";
import { useProperties } from "../contexts/PropertyContext";
import { read as readInquiries, update as updateInquiry } from '../utils/propertyInquiriesStorage.jsx';
import { read as readVisits, update as updateVisit } from '../utils/propertyVisitsStorage.jsx';
import { read as readViews } from '../utils/propertyViewsStorage.jsx';
import { read as readComparisons } from '../utils/propertyComparisonsStorage.jsx';
import { read as readSavedSearches } from '../utils/savedSearchesStorage.jsx';
import { read as readPriceHistory } from '../utils/priceHistoryStorage.jsx';
import { read as readVerifications, setVerified } from '../utils/propertyVerificationStorage.jsx';
import { createNotification } from '../services/notificationService.jsx';
import { addStoredNotification } from '../utils/notificationsStorage.jsx';
import { toast } from 'react-toastify';

const columns = [
  { title: "Booking ID", dataIndex: "id", key: "id" },
  { title: "Client", dataIndex: "client", key: "client" },
  { title: "Property", dataIndex: "property", key: "property" },
  { title: "Status", dataIndex: "status", key: "status" },
];

export default function AdminDashboardPage() {
  const { properties, setPropertyStatus: setStatus, setPropertyVerified: setVerifiedInContext } = useProperties();

  const [inquiries, setInquiries] = useState([]);
  const [visits, setVisits] = useState([]);
  const [views, setViews] = useState({});
  const [priceHistory, setPriceHistory] = useState([]);
  const [verifications, setVerifications] = useState({});
  const [storedPayments, setStoredPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const onInquiries = async () => { try { const d = await readInquiries(); setInquiries(d || []); } catch (e) { console.warn(e); } };
    const onVisits = async () => { try { const d = await readVisits(); setVisits(d || []); } catch (e) { console.warn(e); } };
    const onPrice = async () => { try { const d = await readPriceHistory(); setPriceHistory(d || []); } catch (e) { console.warn(e); } };
    const onVerifications = async () => { try { const d = await readVerifications(); setVerifications(d || {}); } catch (e) { console.warn(e); } };

    window.addEventListener('rms-property-inquiries-updated', onInquiries);
    window.addEventListener('rms-property-visits-updated', onVisits);
    window.addEventListener('rms-price-history-updated', onPrice);
    window.addEventListener('rms-property-verification-updated', onVerifications);

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [loadedInquiries, loadedVisits, loadedViews, loadedPriceHistory, loadedVerifications] = await Promise.all([
          readInquiries(), readVisits(), readViews(), readPriceHistory(), readVerifications(),
        ]);
        setInquiries(loadedInquiries || []);
        setVisits(loadedVisits || []);
        setViews(loadedViews || {});
        setPriceHistory(loadedPriceHistory || []);
        setVerifications(loadedVerifications || {});
      } catch (e) {
        console.warn('Failed to load admin data', e);
        setError('Failed to load admin data');
      }

      try {
        const payments = await getPayments();
        setStoredPayments(payments || []);
      } catch (e) {
        console.warn('Failed to load payments', e);
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      window.removeEventListener('rms-property-inquiries-updated', onInquiries);
      window.removeEventListener('rms-property-visits-updated', onVisits);
      window.removeEventListener('rms-price-history-updated', onPrice);
      window.removeEventListener('rms-property-verification-updated', onVerifications);
    };
  }, []);

  const totalProperties = properties.length;
  const totalPaymentsCount = storedPayments.length;
  const totalRevenue = storedPayments.reduce((s, p) => s + Number(p.amountPaid || 0), 0);
  const pendingPaymentsCount = storedPayments.filter((p) => p.status === 'Pending').length;
  const partialPaymentsCount = storedPayments.filter((p) => p.status === 'Partial Payment').length;
  const overduePaymentsCount = storedPayments.filter((p) => p.status === 'Overdue').length;
  const totalOutstanding = storedPayments.reduce((s, p) => s + Number(p.remainingAmount || 0), 0);

  const normalizeStatus = (value) => {
    const raw = String(value || '').trim();
    const lowered = raw.toLowerCase();
    if (!raw || ['available', 'available now', 'ready', 'soon available'].includes(lowered)) return 'Available';
    if (['booked', 'occupied', 'reserved', 'approved', 'confirmed'].includes(lowered)) return 'Booked';
    if (['rented', 'leased'].includes(lowered)) return 'Rented';
    if (['for rent', 'rent'].includes(lowered)) return 'For Rent';
    if (['sold', 'closed'].includes(lowered)) return 'Sold';
    return raw;
  };

  const available = properties.filter((p) => normalizeStatus(p.status || p.availability) === 'Available').length;
  const reserved = properties.filter((p) => normalizeStatus(p.status || p.availability) === 'Booked').length;
  const sold = properties.filter((p) => normalizeStatus(p.status || p.availability) === 'Sold').length;
  const forRent = properties.filter((p) => normalizeStatus(p.status || p.availability) === 'For Rent').length;
  const totalInquiries = inquiries.length;
  const pendingVisits = visits.filter((v) => v.status === 'Pending').length;
  const mostViewedId = Object.entries(views).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  const mostViewedProperty = properties.find((p) => String(p.id) === String(mostViewedId));

  const [totalFavorites, setTotalFavorites] = useState(0);
  const [favoriteCounts, setFavoriteCounts] = useState({});
  const [mostFavoritedProperty, setMostFavoritedProperty] = useState(null);

  useEffect(() => {
    let mounted = true;
    import('../services/api').then(({ default: api }) => {
      api.request('/favorites/aggregate').then((res) => {
        if (!mounted) return;
        if (res && res.success && res.data) {
          const { totalFavorites: total, byProperty } = res.data;
          const counts = {};
          (byProperty || []).forEach((b) => { counts[String(b._id)] = b.count; });
          setTotalFavorites(total || 0);
          setFavoriteCounts(counts);
          const topId = (byProperty || [])[0]?._id || null;
          if (topId) setMostFavoritedProperty(properties.find((p) => String(p.id) === String(topId)) || null);
        }
      }).catch((e) => { console.error('Unable to fetch favorite aggregation', e); });
    });
    return () => { mounted = false; };
  }, [properties]);

  const handleInquiryStatus = (id, status) => {
    updateInquiry(id, { status });
    try {
      const note = createNotification({ type: 'contact', title: 'Inquiry Status Updated', message: `Inquiry ${id} status changed to ${status}` });
      addStoredNotification(note);
    } catch (e) {}
    window.dispatchEvent(new Event('rms-property-inquiries-updated'));
  };

  const handleVisitStatus = (id, status) => {
    (async () => {
      await updateVisit(id, { status });
      const updated = await readVisits();
      setVisits(updated);
    })();
    try {
      const note = createNotification({ type: 'contact', title: 'Visit Request Updated', message: `Visit ${id} status changed to ${status}` });
      addStoredNotification(note);
    } catch (e) {}
    window.dispatchEvent(new Event('rms-property-visits-updated'));
  };

  return (
    <div className="page-shell">
      <section className="section-card">
        <h2 className="section-title">Admin Dashboard</h2>
        <p className="section-subtitle">Operate users, properties, hostels, bookings, and payments from a single admin console.</p>
        {loading ? <div style={{ textAlign: 'center', padding: 20 }}><Spin size="large" /></div> : null}
        {error ? <div style={{ marginBottom: 12 }}><Alert type="error" message={error} /></div> : null}
        <Row gutter={[16, 16]}>
          <Col xs={24} md={4}><Card><strong>{totalProperties}</strong><div>Total Properties</div></Card></Col>
          <Col xs={24} md={4}><Card><strong>{available}</strong><div>Available</div></Card></Col>
          <Col xs={24} md={4}><Card><strong>{reserved}</strong><div>Reserved</div></Card></Col>
          <Col xs={24} md={4}><Card><strong>{sold}</strong><div>Sold</div></Card></Col>
          <Col xs={24} md={4}><Card><strong>{forRent}</strong><div>For Rent</div></Card></Col>
          <Col xs={24} md={4}><Card><strong>{totalPaymentsCount}</strong><div>Total Payments</div></Card></Col>
        </Row>

        <Row style={{ marginTop: 12 }}>
          <Col xs={24}>
            <Card title="Manage Properties">
              <Table
                dataSource={properties}
                rowKey={(r) => r.id}
                pagination={{ pageSize: 6 }}
                columns={[
                  { title: 'ID', dataIndex: 'id', key: 'id' },
                  { title: 'Title', dataIndex: 'title', key: 'title' },
                  { title: 'Area', dataIndex: 'area', key: 'area' },
                  { title: 'Price', dataIndex: 'price', key: 'price' },
                  { title: 'Status', key: 'status', render: (_, record) => (
                    <Select defaultValue={record.status || record.availability || 'Available'} style={{ width: 140 }} onChange={(val) => { setStatus(record.id, val); toast.success('Status updated'); }}>
                      <Select.Option value="Available">Available</Select.Option>
                      <Select.Option value="Reserved">Reserved</Select.Option>
                      <Select.Option value="Sold">Sold</Select.Option>
                      <Select.Option value="For Rent">For Rent</Select.Option>
                    </Select>
                  ) },
                  { title: 'Verified', key: 'verified', render: (_, record) => {
                    const isVer = Boolean(verifications[String(record.id)]);
                    return <Button type={isVer ? 'primary' : 'default'} onClick={async () => {
                      try {
                        await setVerified(String(record.id), !isVer);
                        setVerifications((prev) => ({ ...(prev || {}), [String(record.id)]: !isVer }));
                        setVerifiedInContext(record.id, !isVer);
                        toast.success(isVer ? 'Unverified' : 'Verified');
                      } catch (e) {
                        console.error('Failed to toggle verification', e);
                        toast.error('Failed to update verification');
                      }
                    }}>{isVer ? 'Verified' : 'Verify'}</Button>;
                  } },
                ]}
              />
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]} style={{ marginTop: 12 }}>
          <Col xs={24} lg={8}><Card title="Admin Metrics"><div>Total Inquiries: {totalInquiries}</div><div>Pending Visits: {pendingVisits}</div><div>Total Favorites: {totalFavorites}</div></Card></Col>
          <Col xs={24} lg={8}><Card title="Top Properties">{mostViewedProperty ? <div>Most Viewed: {mostViewedProperty.title} ({views[String(mostViewedProperty.id)] || 0})</div> : <div>No view data</div>}<div style={{ marginTop: 8 }}>{mostFavoritedProperty ? `Most Favorited: ${mostFavoritedProperty.title} (${favoriteCounts[String(mostFavoritedProperty.id)] || 0})` : 'No favorites yet'}</div></Card></Col>
          <Col xs={24} lg={8}><Card title="Price Changes">{priceHistory.slice(0,5).map((p) => (<div key={p.id} style={{ fontSize: 13 }}>{p.propertyId}: {p.previousPrice} → {p.newPrice} <Tag>{new Date(p.changedAt).toLocaleDateString()}</Tag></div>))}</Card></Col>
        </Row>

        <Row gutter={[16, 16]} style={{ marginTop: 12 }}>
          <Col xs={24} lg={12}>
            <Card title="Recent Inquiries">
              <List dataSource={inquiries.slice(0,8)} renderItem={(item) => (
                <List.Item actions={[
                  <Button key="status" onClick={() => handleInquiryStatus(item.id, item.status === 'New' ? 'Contacted' : 'Closed')}>{item.status === 'New' ? 'Mark Contacted' : 'Close'}</Button>
                ]}>
                  <div><strong>{item.name}</strong> <Tag>{item.status}</Tag><div style={{ fontSize: 12 }}>{item.propertyTitle}</div></div>
                </List.Item>
              )} />
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card title="Recent Visit Requests">
              <List dataSource={visits.slice(0,8)} renderItem={(item) => (
                <List.Item actions={[
                  <Button key="confirm" onClick={() => handleVisitStatus(item.id, 'Confirmed')}>Confirm</Button>,
                  <Button key="cancel" danger onClick={() => handleVisitStatus(item.id, 'Cancelled')}>Cancel</Button>
                ]}>
                  <div><strong>{item.name}</strong> <Tag>{item.status}</Tag><div style={{ fontSize: 12 }}>{item.propertyTitle} — {item.date || item.time}</div></div>
                </List.Item>
              )} />
            </Card>
          </Col>
        </Row>
      </section>
    </div>
  );
}

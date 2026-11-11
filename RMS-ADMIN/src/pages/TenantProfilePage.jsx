import { useMemo, useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import './TenantProfilePage.css';
import { formatCurrency, formatDate, formatDateTime } from '../utils/formatters';

const tabLabels = ['overview', 'personal', 'bookings', 'rent', 'payments', 'maintenance', 'activity'];

const normalizeKey = (value) => String(value || '').toLowerCase().trim();

function TenantProfilePage({ appData = {}, setAppData }) {
  useEffect(() => {
    const ensureData = async () => {
      try {
        const needs = !(appData.users || []).length || !(appData.bookings || []).length || !(appData.payments || []).length;
        if (!needs) return;
        const resp = await import('../services/api').then((m) => m.apiService.request('/admin/dashboard'));
        if (resp?.success && resp.data && typeof setAppData === 'function') {
          setAppData((prev) => ({ ...prev, ...resp.data }));
        }
      } catch (e) {
        console.warn('Unable to ensure tenant profile data', e?.message || e);
      }
    };
    ensureData();
  }, [setAppData]);
  const { tenantKey } = useParams();
  const [activeTab, setActiveTab] = useState('overview');

  const tenantCandidates = useMemo(() => {
    const users = appData.users || [];
    const tenants = appData.tenants || [];
    const bookings = appData.bookings || [];
    const payments = appData.payments || [];
    const rentRecords = appData.rentRecords || [];

    const exactTenant = [...tenants, ...users].find((item) => {
      const id = item?._id || item?.id;
      return String(id || '').toLowerCase() === normalizeKey(tenantKey);
    });

    if (exactTenant) return [exactTenant];

    const byName = [...tenants, ...users].filter((item) => {
      const names = [item?.fullName, item?.name, item?.customerName, item?.tenantName, item?.residentName, item?.email].filter(Boolean);
      return names.some((name) => normalizeKey(name) === normalizeKey(tenantKey));
    });

    if (byName.length) return byName;

    const bookingMatches = bookings.filter((booking) => normalizeKey(booking?.customerName) === normalizeKey(tenantKey));
    if (bookingMatches.length) {
      return bookingMatches.map((booking) => ({
        id: booking.id,
        fullName: booking.customerName,
        name: booking.customerName,
        email: booking.customerEmail || '',
        phone: booking.customerPhone || '',
        propertyId: booking.propertyId,
        propertyName: booking.propertyTitle,
        status: booking.bookingStatus || 'Active',
      }));
    }

    const paymentMatches = payments.filter((payment) => normalizeKey(payment?.user || payment?.customerName) === normalizeKey(tenantKey));
    if (paymentMatches.length) {
      return paymentMatches.map((payment) => ({
        id: payment.id || payment.paymentId,
        fullName: payment.user || payment.customerName,
        name: payment.user || payment.customerName,
        email: payment.email || '',
        phone: payment.phone || '',
        propertyId: payment.propertyId || payment.property,
        propertyName: payment.propertyTitle || payment.property,
        status: payment.status || 'Active',
      }));
    }

    const rentMatches = rentRecords.filter((record) => normalizeKey(record?.tenantName) === normalizeKey(tenantKey));
    if (rentMatches.length) {
      return rentMatches.map((record) => ({
        id: record.tenantId || record.id,
        fullName: record.tenantName,
        name: record.tenantName,
        email: '',
        phone: '',
        propertyId: record.propertyId,
        propertyName: record.propertyName,
        status: record.status || 'Active',
      }));
    }

    return [...tenants, ...users].slice(0, 1);
  }, [appData, tenantKey]);

  const tenant = tenantCandidates[0] || {
    id: tenantKey || 'tenant-unknown',
    fullName: tenantKey || 'Unknown Tenant',
    name: tenantKey || 'Unknown Tenant',
    email: '',
    phone: '',
    propertyName: '',
    status: 'Active',
  };

  const targetName = tenant.fullName || tenant.name || tenant.customerName || tenant.tenantName || tenant.residentName || 'Unknown Tenant';
  const targetEmail = tenant.email || '';
  const targetPhone = tenant.phone || tenant.customerPhone || '';

  const bookings = (appData.bookings || []).filter((booking) => {
    const customer = booking.customerName || booking.userName || '';
    const phone = booking.customerPhone || booking.userPhone || '';
    const propertyId = booking.propertyId || '';
    const tenantId = booking.userId || booking.tenantId || booking.customerId || '';
    return [customer, phone, propertyId, tenantId, booking.bookingId || ''].some((value) =>
      normalizeKey(value) === normalizeKey(targetName) ||
      normalizeKey(value) === normalizeKey(targetPhone) ||
      normalizeKey(value) === normalizeKey(targetEmail) ||
      normalizeKey(value) === normalizeKey(tenant.id) ||
      normalizeKey(value) === normalizeKey(tenant._id) ||
      normalizeKey(value) === normalizeKey(tenant.propertyId));
  });

  const payments = (appData.payments || []).filter((payment) => {
    const user = payment.user || payment.customerName || payment.userName || '';
    const property = payment.property || payment.propertyTitle || '';
    const tenantId = payment.userId || payment.tenantId || payment.customerId || '';
    return [user, property, payment.propertyId || '', tenantId, payment.bookingId || '', payment.userEmail || ''].some((value) =>
      normalizeKey(value) === normalizeKey(targetName) ||
      normalizeKey(value) === normalizeKey(targetEmail) ||
      normalizeKey(value) === normalizeKey(tenant.id) ||
      normalizeKey(value) === normalizeKey(tenant._id) ||
      normalizeKey(value) === normalizeKey(tenant.propertyId));
  });

  const rentRecords = (appData.rentRecords || []).filter((record) => {
    const tenantId = record.userId || record.tenantId || record.customerId || '';
    const tenantName = record.userName || record.tenantName || '';
    return normalizeKey(tenantId) === normalizeKey(tenant.id) || normalizeKey(tenantId) === normalizeKey(tenant._id) || normalizeKey(tenantName) === normalizeKey(targetName) || normalizeKey(record.propertyId || record.propertyName || '') === normalizeKey(tenant.propertyId || tenant.propertyName || '');
  });

  const dues = (appData.dues || []).filter((due) => {
    const resident = due.residentName || due.user || '';
    const property = due.propertyName || due.property || '';
    return [resident, property, due.propertyId || '', due.userId || ''].some((value) => normalizeKey(value) === normalizeKey(targetName) || normalizeKey(value) === normalizeKey(targetPhone) || normalizeKey(value) === normalizeKey(tenant.id) || normalizeKey(value) === normalizeKey(tenant.propertyId || tenant.propertyName || ''));
  });

  const maintenanceItems = (appData.maintenanceItems || []).filter((item) => {
    const assignee = item.assignee || item.tenantName || item.user || '';
    return normalizeKey(assignee) === normalizeKey(targetName) || normalizeKey(item.propertyId || item.propertyName || '') === normalizeKey(tenant.propertyId || tenant.propertyName || '');
  });

  const activityLogs = (appData.activityLogs || []).filter((entry) => {
    const text = [entry.action, entry.details, entry.type || '', entry.timestamp || ''].join(' ');
    return text.toLowerCase().includes(targetName.toLowerCase()) || text.toLowerCase().includes((tenant.propertyName || '').toLowerCase());
  });

  const totalPaid = payments.reduce((sum, payment) => sum + Number(payment.amount || payment.totalAmount || 0), 0);
  const totalRent = rentRecords.reduce((sum, record) => sum + Number(record.amount || record.monthlyRent || 0), 0);
  const outstanding = dues.reduce((sum, due) => sum + Number(due.remainingAmount || due.currentCharge || due.amount || 0), 0);
  const approvedBookings = bookings.filter((booking) => booking.bookingStatus === 'Approved').length;
  const activeMaintenances = maintenanceItems.filter((item) => item.status !== 'Resolved').length;

  const breakdown = [
    { label: 'Total Paid', value: formatCurrency(totalPaid) },
    { label: 'Outstanding', value: formatCurrency(outstanding) },
    { label: 'Approved Bookings', value: String(approvedBookings) },
    { label: 'Rent Records', value: String(rentRecords.length) },
    { label: 'Open Maintenance', value: String(activeMaintenances) },
    { label: 'Total Rent', value: formatCurrency(totalRent) },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'personal':
        return (
          <div className="tenant-detail-grid">
            <div className="detail-card"><label>Full Name</label><strong>{targetName}</strong></div>
            <div className="detail-card"><label>Email</label><strong>{targetEmail || '—'}</strong></div>
            <div className="detail-card"><label>Phone</label><strong>{targetPhone || '—'}</strong></div>
            <div className="detail-card"><label>Primary Property</label><strong>{tenant.propertyName || '—'}</strong></div>
            <div className="detail-card"><label>Tenant ID</label><strong>{tenant.id || tenant._id || '—'}</strong></div>
            <div className="detail-card"><label>Status</label><strong>{tenant.status || 'Active'}</strong></div>
          </div>
        );
      case 'bookings':
        return (
          <div className="table-wrap compact-table">
            <table>
              <thead>
                <tr><th>Booking</th><th>Property</th><th>Visit</th><th>Amount</th><th>Status</th></tr>
              </thead>
              <tbody>
                {bookings.length ? bookings.map((booking) => (
                  <tr key={booking.id || booking.bookingId}>
                    <td>{booking.id || booking.bookingId}</td>
                    <td>{booking.propertyTitle || booking.propertyName || '—'}</td>
                    <td>{formatDate(booking.visitDate || booking.bookingDate)}</td>
                    <td>{formatCurrency(booking.amount || 0)}</td>
                    <td><span className={`status-badge ${String(booking.bookingStatus || booking.status || 'Pending').toLowerCase()}`}>{booking.bookingStatus || booking.status || 'Pending'}</span></td>
                  </tr>
                )) : <tr><td colSpan="5">No bookings found for this tenant.</td></tr>}
              </tbody>
            </table>
          </div>
        );
      case 'rent':
        return (
          <div className="table-wrap compact-table">
            <table>
              <thead>
                <tr><th>Month</th><th>Property</th><th>Due</th><th>Paid</th><th>Balance</th><th>Status</th></tr>
              </thead>
              <tbody>
                {rentRecords.length ? rentRecords.map((record) => (
                  <tr key={record.id || record._id}>
                    <td>{record.month || formatDate(record.dueDate)}</td>
                    <td>{record.propertyName || '—'}</td>
                    <td>{formatDate(record.dueDate)}</td>
                    <td>{formatCurrency(record.paidAmount || 0)}</td>
                    <td>{formatCurrency(record.remainingAmount || record.amount || 0)}</td>
                    <td><span className={`status-badge ${String(record.status || 'Pending').toLowerCase()}`}>{record.status || 'Pending'}</span></td>
                  </tr>
                )) : <tr><td colSpan="6">No rent records linked to this tenant.</td></tr>}
              </tbody>
            </table>
          </div>
        );
      case 'payments':
        return (
          <div className="table-wrap compact-table">
            <table>
              <thead>
                <tr><th>Payment ID</th><th>Date</th><th>Method</th><th>Amount</th><th>Status</th></tr>
              </thead>
              <tbody>
                {payments.length ? payments.map((payment) => (
                  <tr key={payment.id || payment.paymentId}>
                    <td>{payment.id || payment.paymentId}</td>
                    <td>{formatDate(payment.paymentDate || payment.date)}</td>
                    <td>{payment.method || payment.paymentMethod || 'Bank Transfer'}</td>
                    <td>{formatCurrency(payment.amount || 0)}</td>
                    <td><span className={`status-badge ${String(payment.status || 'Pending').toLowerCase()}`}>{payment.status || 'Pending'}</span></td>
                  </tr>
                )) : <tr><td colSpan="5">No payment records found.</td></tr>}
              </tbody>
            </table>
          </div>
        );
      case 'maintenance':
        return (
          <div className="table-wrap compact-table">
            <table>
              <thead>
                <tr><th>Issue</th><th>Property</th><th>Priority</th><th>Status</th><th>Updated</th></tr>
              </thead>
              <tbody>
                {maintenanceItems.length ? maintenanceItems.map((item) => (
                  <tr key={item.id || item._id || item.issue}>
                    <td>{item.issue || item.title || item.subject || 'Maintenance request'}</td>
                    <td>{item.propertyName || item.property || '—'}</td>
                    <td>{item.priority || 'Normal'}</td>
                    <td><span className={`status-badge ${String(item.status || 'Open').toLowerCase()}`}>{item.status || 'Open'}</span></td>
                    <td>{formatDateTime(item.updatedAt || item.createdAt || item.date)}</td>
                  </tr>
                )) : <tr><td colSpan="5">No maintenance activity linked to this tenant.</td></tr>}
              </tbody>
            </table>
          </div>
        );
      case 'activity':
        return (
          <div className="timeline-list">
            {activityLogs.length ? activityLogs.map((entry) => (
              <div key={entry.id || `${entry.action}-${entry.timestamp}`} className="timeline-item">
                <div className="timeline-dot" />
                <div>
                  <strong>{entry.action}</strong>
                  <p>{entry.details || entry.message || 'No further details.'}</p>
                  <small>{formatDateTime(entry.timestamp)}</small>
                </div>
              </div>
            )) : <p>No recent activity was attached to this tenant profile.</p>}
          </div>
        );
      case 'overview':
      default:
        return (
          <div className="overview-grid">
            <div className="overview-card accent">
              <label>Rental status</label>
              <strong>{rentRecords.some((record) => String(record.status || '').toLowerCase() === 'overdue') ? 'At risk' : 'On track'}</strong>
              <small>{rentRecords.length} rent records across the tenant lifecycle.</small>
            </div>
            <div className="overview-card">
              <label>Booking health</label>
              <strong>{approvedBookings}</strong>
              <small>Approved bookings booked against this tenant profile.</small>
            </div>
            <div className="overview-card">
              <label>Payment follow-up</label>
              <strong>{formatCurrency(outstanding)}</strong>
              <small>Open balance from dues and active payments.</small>
            </div>
            <div className="overview-card">
              <label>Maintenance queue</label>
              <strong>{activeMaintenances}</strong>
              <small>Current open maintenance or repair items.</small>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="page-section tenant-profile-page">
      <section className="panel-card profile-header-card">
        <div className="profile-summary">
          <div className="member-avatar">{(targetName || 'T').slice(0, 2).toUpperCase()}</div>
          <div>
            <p className="eyebrow">Tenant profile</p>
            <h2>{targetName}</h2>
            <div className="profile-meta-row">
              <span>{targetEmail || 'No email on file'}</span>
              <span>•</span>
              <span>{targetPhone || 'No phone on file'}</span>
            </div>
          </div>
        </div>
        <div className="profile-summary-badges">
          <span className="mini-badge success">{tenant.status || 'Active'}</span>
          <span className="mini-badge">{tenant.propertyName || 'No property assigned'}</span>
        </div>
      </section>

      <section className="panel-card stats-strip">
        {breakdown.map((item) => (
          <div key={item.label} className="stat-card">
            <p>{item.label}</p>
            <h3>{item.value}</h3>
          </div>
        ))}
      </section>

      <section className="panel-card tab-panel">
        <div className="tab-row">
          {tabLabels.map((tab) => (
            <button
              key={tab}
              type="button"
              className={activeTab === tab ? 'tab-button active' : 'tab-button'}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
        {renderTabContent()}
      </section>
    </div>
  );
}

export default TenantProfilePage;

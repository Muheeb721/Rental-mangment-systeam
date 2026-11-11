import { useMemo, useEffect, useState } from 'react';
import './DashboardPage.css';
import { formatCurrency, formatDate } from '../utils/formatters';
import { apiService } from '../services/api';

function DashboardPage({ appData, setAppData }) {
  const [loading, setLoading] = useState(false);
  const properties = appData.properties || [];
  const bookings = appData.bookings || [];
  const payments = appData.payments || [];
  const dues = appData.dues || [];
  const users = appData.users || [];
  const tenants = appData.tenants || [];
  const activityLogs = appData.activityLogs || [];
  const adminName = appData.profile?.fullName || appData.profile?.name || appData.admin?.fullName || appData.admin?.name || 'Admin';

  const normalizeValue = (value) => String(value ?? '').trim().toLowerCase();
  const matchesAnyStatus = (value, statuses = []) => statuses.some((status) => normalizeValue(value) === normalizeValue(status));

  const stats = useMemo(() => {
    const totalProperties = properties.length;
    const availableProperties = properties.filter((item) => matchesAnyStatus(item.status, ['available', 'vacant', 'open'])).length;
    const rentedProperties = properties.filter((item) => matchesAnyStatus(item.status, ['for rent', 'rented', 'occupied', 'leased'])).length;
    const reservedProperties = properties.filter((item) => matchesAnyStatus(item.status, ['reserved', 'holding'])).length;
    const soldProperties = properties.filter((item) => matchesAnyStatus(item.status, ['sold', 'sold out'])).length;
    const pendingBookings = bookings.filter((item) => matchesAnyStatus(item.bookingStatus || item.status, ['pending', 'in review', 'awaiting approval'])).length;
    const pendingPayments = payments.filter((item) => !matchesAnyStatus(item.status, ['paid', 'approved', 'completed', 'success', 'settled'])).length;
    const totalRevenue = payments
      .filter((payment) => matchesAnyStatus(payment.status, ['paid', 'approved', 'completed', 'success', 'settled']))
      .reduce((sum, payment) => sum + Number(payment.amount || payment.totalAmount || 0), 0);
    const outstandingDues = dues
      .filter((due) => !matchesAnyStatus(due.paymentStatus || due.status, ['paid', 'completed', 'settled']))
      .reduce((sum, due) => sum + Number(due.remainingAmount || due.currentCharge || due.amount || 0), 0);
    const activeTenants = tenants.filter((tenant) => matchesAnyStatus(tenant.status, ['active', 'current'])).length;
    const maintenanceCount = (appData.maintenanceItems || []).filter((item) => !matchesAnyStatus(item.status, ['resolved', 'completed', 'closed'])).length;

    return {
      totalProperties,
      availableProperties,
      rentedProperties,
      reservedProperties,
      soldProperties,
      pendingBookings,
      pendingPayments,
      totalUsers: users.length,
      totalRevenue,
      outstandingDues,
      activeTenants,
      maintenanceCount,
    };
  }, [properties, payments, dues, users, bookings, tenants, appData.maintenanceItems]);

  const cards = [
    { label: 'Total Users', value: stats.totalUsers, icon: '👥', tone: 'primary' },
    { label: 'Active Tenants', value: stats.activeTenants, icon: '🏠', tone: 'success' },
    { label: 'Total Properties', value: stats.totalProperties, icon: '🏘️', tone: 'primary' },
    { label: 'Available Properties', value: stats.availableProperties, icon: '✅', tone: 'success' },
    { label: 'Rented Properties', value: stats.rentedProperties, icon: '📌', tone: 'info' },
    { label: 'Reserved Properties', value: stats.reservedProperties, icon: '🟡', tone: 'warning' },
    { label: 'Sold Properties', value: stats.soldProperties, icon: '🔴', tone: 'danger' },
    { label: 'Pending Bookings', value: stats.pendingBookings, icon: '📅', tone: 'warning' },
    { label: 'Pending Payments', value: stats.pendingPayments, icon: '⏳', tone: 'info' },
    { label: 'Monthly Revenue', value: formatCurrency(stats.totalRevenue), icon: '💰', tone: 'success' },
    { label: 'Rent Due', value: formatCurrency(stats.outstandingDues), icon: '📄', tone: 'danger' },
    { label: 'Maintenance Requests', value: stats.maintenanceCount, icon: '🛠️', tone: 'warning' },
  ];

  const statusBreakdown = [
    { label: 'Available', value: properties.filter((item) => matchesAnyStatus(item.status, ['available', 'vacant', 'open'])).length, color: '#16a34a' },
    { label: 'Reserved', value: properties.filter((item) => matchesAnyStatus(item.status, ['reserved', 'holding'])).length, color: '#f59e0b' },
    { label: 'Sold', value: properties.filter((item) => matchesAnyStatus(item.status, ['sold', 'sold out'])).length, color: '#dc2626' },
    { label: 'For Rent', value: properties.filter((item) => matchesAnyStatus(item.status, ['for rent', 'rented', 'occupied', 'leased'])).length, color: '#0ea5e9' },
  ];

  const recentTransactions = [...payments]
    .sort((a, b) => new Date(b.paymentDate || b.date || 0) - new Date(a.paymentDate || a.date || 0))
    .slice(0, 5);

  const maxStatusValue = Math.max(...statusBreakdown.map((item) => item.value), 1);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        setLoading(true);
        const needs = !(appData.properties || []).length || !(appData.users || []).length || !(appData.bookings || []).length;
        if (!needs) {
          setLoading(false);
          return;
        }
        const resp = await apiService.request('/admin/dashboard');
        if (resp?.success && resp.data) {
          setAppData((prev) => ({ ...prev, ...resp.data }));
        }
      } catch (e) {
        console.warn('Unable to load dashboard data', e?.message || e);
      } finally {
        setLoading(false);
      }
    };
    loadDashboard();
  }, [setAppData, appData.properties, appData.users, appData.bookings]);

  if (loading && !properties.length && !users.length && !bookings.length) {
    return (
      <div className="page-section dashboard-page">
        <section className="panel-card"><div className="skeleton skeleton-line short" /></section>
        <div className="stats-grid dashboard-stats">
          {Array.from({ length: 12 }).map((_, index) => (
            <div key={`skeleton-stat-${index}`} className="stat-card skeleton-card">
              <div className="skeleton skeleton-line" />
              <div className="skeleton skeleton-box" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="page-section dashboard-page">
      <section className="welcome-card panel-card">
        <div>
          <p className="eyebrow">Overview</p>
          <h2>Welcome back, {adminName} 👋</h2>
        </div>
        <div className="date-pill">{formatDate(new Date().toISOString())}</div>
      </section>

      <div className="stats-grid dashboard-stats">
        {cards.map((card, index) => (
          <div key={`${card.label || 'card'}-${index}`} className={`stat-card tone-${card.tone}`}>
            <div className="stat-card-icon">{card.icon}</div>
            <p>{card.label}</p>
            <h3>{card.value}</h3>
            <span className="trend up">Live</span>
          </div>
        ))}
      </div>

      <div className="content-grid two-column">
        <section className="panel-card">
          <div className="card-header">
            <h3>Property Status</h3>
            <span className="mini-badge">Live data</span>
          </div>
          <div className="status-list">
            {statusBreakdown.map((item, index) => (
              <div key={`${item.label || 'status'}-${index}`} className="status-row">
                <div className="status-info">
                  <span className="status-dot" style={{ background: item.color }} />
                  <span>{item.label}</span>
                </div>
                <div className="status-bar-track">
                  <span style={{ width: `${(item.value / maxStatusValue) * 100}%`, background: item.color }} />
                </div>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="panel-card">
          <div className="card-header">
            <h3>Recent Activity</h3>
            <span className="mini-badge">Updated</span>
          </div>
          <div className="activity-list">
            {activityLogs.slice(0, 5).map((item, index) => (
              <div key={`activity-${item?.id || item?._id || item?.action || 'unknown'}-${index}`} className="activity-row">
                <div className="dot-indicator" />
                <div>
                  <strong>{item.action}</strong>
                  <small>{item.details}</small>
                </div>
                <span>{formatDate(item.timestamp)}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="content-grid two-column">
        <section className="panel-card">
          <div className="card-header">
            <h3>Recent Transactions</h3>
            <span className="mini-badge">Latest</span>
          </div>
          <div className="table-wrap compact-table">
            <table>
              <thead>
                <tr>
                  <th>Transaction</th>
                  <th>User</th>
                  <th>Property</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentTransactions.map((payment, index) => (
                  <tr key={`${payment.id || payment.paymentId || 'payment'}-${index}`}>
                    <td>{payment.paymentId || payment.id}</td>
                    <td>{payment.userName || payment.user}</td>
                    <td>{payment.propertyName || payment.property}</td>
                    <td>{formatCurrency(payment.amount)}</td>
                    <td>{payment.paymentMethod || payment.method}</td>
                    <td>{formatDate(payment.paymentDate || payment.date)}</td>
                    <td><span className={`status-badge ${String(payment.status).toLowerCase()}`}>{payment.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel-card">
          <div className="card-header">
            <h3>Recent Bookings</h3>
            <span className="mini-badge">{bookings.length} total</span>
          </div>
          <div className="table-wrap compact-table">
            <table>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Property</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {bookings.slice(0, 5).map((booking, index) => (
                  <tr key={`${booking.id || booking.bookingId || 'booking'}-${index}`}>
                    <td>{booking.customerName}</td>
                    <td>{booking.propertyTitle}</td>
                    <td>{formatCurrency(booking.amount)}</td>
                    <td><span className={`status-badge ${String(booking.bookingStatus).toLowerCase()}`}>{booking.bookingStatus}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

export default DashboardPage;

import { useEffect } from 'react';
import './ReportsPage.css';
import { apiService } from '../services/api';
import { formatCurrency, formatDate } from '../utils/formatters';

const normalizeStatus = (value) => String(value ?? '').trim().toLowerCase();
const isPaidStatus = (value) => ['paid', 'approved', 'completed', 'success', 'settled'].includes(normalizeStatus(value));

function ReportsPage({ appData, setAppData }) {
  useEffect(() => {
    const loadReportsData = async () => {
      try {
        const needs = !(appData.payments || []).length || !(appData.properties || []).length || !(appData.users || []).length;
        if (!needs) return;
        const resp = await apiService.request('/admin/dashboard');
        if (resp?.success && resp.data) setAppData((prev) => ({ ...prev, ...resp.data }));
      } catch (e) {
        console.warn('Unable to load reports data', e?.message || e);
      }
    };
    loadReportsData();
  }, [setAppData, appData.payments, appData.properties, appData.users]);

  const payments = appData.payments || [];
  const bookings = appData.bookings || [];
  const dues = appData.dues || [];
  const users = appData.users || [];
  const properties = appData.properties || [];

  const totalRevenue = payments
    .filter((payment) => isPaidStatus(payment.status))
    .reduce((sum, payment) => sum + Number(payment.amount || payment.totalAmount || 0), 0);

  const approvedBookings = bookings.filter((booking) => ['approved', 'confirmed', 'accepted'].includes(normalizeStatus(booking.bookingStatus || booking.status))).length;
  const openTickets = (appData.messages || []).filter((message) => ['open', 'new', 'pending'].includes(normalizeStatus(message.status))).length;
  const overdueDues = dues.filter((due) => !['paid', 'completed', 'settled'].includes(normalizeStatus(due.status || due.paymentStatus))).length;
  const activeUsers = users.filter((user) => ['active', 'enabled', 'verified'].includes(normalizeStatus(user.status))).length;
  const occupancyRate = properties.length > 0
    ? Math.round((properties.filter((property) => ['available', 'reserved', 'vacant'].includes(normalizeStatus(property.status))).length / properties.length) * 100)
    : 0;

  const propertyMix = ['Available', 'Reserved', 'Sold', 'For Rent'].map((status) => ({
    label: status,
    value: properties.filter((property) => normalizeStatus(property.status) === normalizeStatus(status)).length,
  }));

  const userRoleMix = ['Tenant', 'Buyer', 'Landlord', 'Admin'].map((role) => ({
    label: role,
    value: users.filter((user) => normalizeStatus(user.role) === normalizeStatus(role)).length,
  }));

  const monthlyRevenue = Array.from({ length: 6 }, (_, index) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (5 - index));
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const revenue = payments
      .filter((payment) => isPaidStatus(payment.status))
      .filter((payment) => {
        const paymentDate = new Date(payment.paymentDate || payment.date || payment.createdAt || Date.now());
        return `${paymentDate.getFullYear()}-${String(paymentDate.getMonth() + 1).padStart(2, '0')}` === monthKey;
      })
      .reduce((sum, payment) => sum + Number(payment.amount || payment.totalAmount || 0), 0);

    return {
      month: date.toLocaleDateString('en-US', { month: 'short' }),
      revenue,
    };
  });

  const maxRevenue = Math.max(...monthlyRevenue.map((month) => month.revenue), 1);

  const topProperties = [...properties]
    .map((property) => ({
      name: property.title || property.name || 'Untitled property',
      value: bookings.filter((booking) => {
        const propertyTitle = booking.propertyTitle || booking.propertyName || booking.property || '';
        return propertyTitle === (property.title || property.name);
      }).length,
      revenue: payments
        .filter((payment) => {
          const paymentProperty = payment.property || payment.propertyName || payment.propertyTitle || '';
          return paymentProperty === (property.title || property.name) && isPaidStatus(payment.status);
        })
        .reduce((sum, payment) => sum + Number(payment.amount || payment.totalAmount || 0), 0),
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const riskWatch = [...dues]
    .sort((a, b) => Number(b.remainingAmount || b.currentCharge || b.amount || 0) - Number(a.remainingAmount || a.currentCharge || a.amount || 0))
    .slice(0, 5)
    .map((due) => ({
      label: due.residentName || due.user || due.name || 'Unknown tenant',
      value: formatCurrency(due.remainingAmount || due.currentCharge || due.amount || 0),
      status: due.status || due.paymentStatus || 'Pending',
    }));

  const breakdown = [
    { label: 'Revenue', value: formatCurrency(totalRevenue) },
    { label: 'Approved bookings', value: String(approvedBookings) },
    { label: 'Open tickets', value: String(openTickets) },
    { label: 'Overdue dues', value: String(overdueDues) },
    { label: 'Active users', value: String(activeUsers) },
    { label: 'Occupancy', value: `${occupancyRate}%` },
  ];

  return (
    <div className="page-section reports-page">
      <div className="summary-strip report-strip">
        {breakdown.map((item) => (
          <div key={item.label} className="summary-item primary">
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>

      <div className="stats-grid three-column">
        {breakdown.map((item) => (
          <div key={item.label} className="stat-card">
            <p>{item.label}</p>
            <h3>{item.value}</h3>
          </div>
        ))}
      </div>

      <div className="content-grid two-column">
        <section className="panel-card">
          <div className="card-header">
            <h3>Monthly revenue trend</h3>
          </div>
          <div className="mini-chart">
            {monthlyRevenue.map((item) => (
              <div key={item.month} className="mini-chart-bar-wrap">
                <span className="mini-chart-bar" style={{ height: `${Math.max(12, (item.revenue / maxRevenue) * 100)}%` }} />
                <small>{item.month}</small>
                <strong>{formatCurrency(item.revenue)}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="panel-card">
          <div className="card-header">
            <h3>Inventory mix</h3>
          </div>
          <div className="analytics-list">
            {propertyMix.map((item) => {
              const maxCount = Math.max(...propertyMix.map((entry) => entry.value), 1);
              return (
                <div key={item.label} className="analytics-row">
                  <span>{item.label}</span>
                  <div className="analytics-bar">
                    <span style={{ width: `${Math.max(12, (item.value / maxCount) * 100)}%` }} />
                  </div>
                  <strong>{item.value}</strong>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <div className="content-grid two-column">
        <section className="panel-card">
          <div className="card-header">
            <h3>Top performing properties</h3>
          </div>
          <div className="table-wrap compact-table">
            <table>
              <thead>
                <tr>
                  <th>Property</th>
                  <th>Bookings</th>
                  <th>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {topProperties.map((property) => (
                  <tr key={property.name}>
                    <td>{property.name}</td>
                    <td>{property.value}</td>
                    <td>{formatCurrency(property.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel-card">
          <div className="card-header">
            <h3>Tenant segment mix</h3>
          </div>
          <div className="analytics-list">
            {userRoleMix.map((item) => {
              const maxCount = Math.max(...userRoleMix.map((entry) => entry.value), 1);
              return (
                <div key={item.label} className="analytics-row">
                  <span>{item.label}</span>
                  <div className="analytics-bar">
                    <span style={{ width: `${Math.max(12, (item.value / maxCount) * 100)}%` }} />
                  </div>
                  <strong>{item.value}</strong>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <div className="content-grid two-column">
        <section className="panel-card">
          <div className="card-header">
            <h3>Recent payments</h3>
          </div>
          <div className="table-wrap compact-table">
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Property</th>
                  <th>Amount</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {payments.slice(0, 5).map((payment, index) => (
                  <tr key={payment.id || payment.paymentId || payment._id || `payment-${index}`}>
                    <td>{payment.userName || payment.user || payment.customerName || 'Unknown user'}</td>
                    <td>{payment.propertyName || payment.property || payment.propertyTitle || 'Unknown property'}</td>
                    <td>{formatCurrency(payment.amount || payment.totalAmount || 0)}</td>
                    <td>{formatDate(payment.paymentDate || payment.date || payment.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel-card">
          <div className="card-header">
            <h3>Risk watch</h3>
          </div>
          <div className="user-list">
            {riskWatch.map((item) => (
              <div className="user-row" key={item.label}>
                <div className="user-avatar">{item.label.slice(0, 2).toUpperCase()}</div>
                <div className="user-meta">
                  <strong>{item.label}</strong>
                  <small>{item.status}</small>
                </div>
                <span className="status-badge overdue">{item.value}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export default ReportsPage;


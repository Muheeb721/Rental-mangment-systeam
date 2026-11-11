import { Link } from 'react-router-dom';
import {
  Building2, CalendarCheck, ClipboardList, CreditCard, Home, Mail, Plus, RefreshCw, Users, Wallet, Wrench, Percent,
} from 'lucide-react';
import { api } from '../lib/api';
import { date, money, moneyShort, timeAgo, titleCase } from '../lib/format';
import { Badge, Button, ErrorState, LoadingBlock, PageHeader, StatCard, useAsync } from '../components/ui';
import { BarChart, DonutChart, HBarChart, PALETTE, moneyAxis } from '../components/charts';

export default function DashboardView() {
  const { data, loading, error, reload } = useAsync(() => api.get('/admin/analytics').then((response) => response.data), []);

  if (loading && !data) return <LoadingBlock label="Loading dashboard…" />;
  if (error && !data) return <ErrorState message={error} onRetry={reload} />;

  const s = data.summary;
  const charts = data.charts;
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Live overview of listings, rentals and revenue from the database."
        actions={(
          <>
            <Button icon={RefreshCw} onClick={reload} loading={loading}>Refresh</Button>
            <Link to="/properties/new" className="btn btn-primary"><Plus size={15} /> Add property</Link>
          </>
        )}
      />

      <div className="grid grid-4">
        <StatCard icon={Building2} label="Total properties" value={s.totalProperties} hint={`${s.availableProperties} available · ${s.featuredProperties} featured`} />
        <StatCard icon={Percent} tone="green" label="Occupancy" value={`${s.occupancyRate}%`} hint={`${s.bookedProperties + s.rentedProperties} booked or rented`} />
        <StatCard icon={Users} tone="violet" label="Registered users" value={s.totalUsers} hint={`${s.totalFavorites} favourites saved`} />
        <StatCard icon={Wallet} tone="sky" label="Revenue collected" value={moneyShort(s.totalRevenue + s.rentCollected)} hint={`${moneyShort(s.rentOutstanding)} rent outstanding`} />
      </div>

      <div className="grid grid-4 mt-16">
        <Link to="/bookings" style={{ textDecoration: 'none' }}><StatCard icon={CalendarCheck} tone="amber" label="Pending bookings" value={s.pendingBookings} hint={`${s.totalBookings} total`} /></Link>
        <Link to="/applications" style={{ textDecoration: 'none' }}><StatCard icon={ClipboardList} tone="amber" label="Pending applications" value={s.pendingApplications} hint={`${s.totalApplications} total`} /></Link>
        <Link to="/maintenance" style={{ textDecoration: 'none' }}><StatCard icon={Wrench} tone="red" label="Open maintenance" value={s.openMaintenance} /></Link>
        <Link to="/messages" style={{ textDecoration: 'none' }}><StatCard icon={Mail} tone="blue" label="New messages" value={s.newMessages} hint={`${s.pendingPayments} payments to review`} /></Link>
      </div>

      <div className="grid grid-wide mt-16">
        <div className="card">
          <div className="card-header"><h2>Revenue (last 6 months)</h2><span className="muted small">Approved payments + collected rent</span></div>
          <div className="card-body">
            <BarChart
              data={charts.revenueByMonth}
              series={[{ key: 'payments', label: 'Payments', color: PALETTE[0] }, { key: 'rent', label: 'Rent collected', color: PALETTE[1] }]}
              format={moneyAxis}
            />
          </div>
        </div>
        <div className="card">
          <div className="card-header"><h2>Property status</h2></div>
          <div className="card-body"><DonutChart data={charts.propertiesByStatus} centerLabel="listings" /></div>
        </div>
      </div>

      <div className="grid grid-3 mt-16">
        <div className="card">
          <div className="card-header"><h2>Listings by type</h2></div>
          <div className="card-body"><HBarChart data={charts.propertiesByType} color={PALETTE} /></div>
        </div>
        <div className="card">
          <div className="card-header"><h2>Rent vs sale</h2></div>
          <div className="card-body"><DonutChart data={charts.propertiesByPurpose} centerLabel="listings" size={130} /></div>
        </div>
        <div className="card">
          <div className="card-header"><h2>New users per month</h2></div>
          <div className="card-body"><BarChart data={charts.signupsByMonth} series={[{ key: 'value', label: 'Users', color: PALETTE[3] }]} height={150} /></div>
        </div>
      </div>

      <div className="grid grid-wide-alt mt-16">
        <div className="card">
          <div className="card-header"><h2>Latest bookings</h2><Link to="/bookings" className="small strong">View all</Link></div>
          {data.recentBookings.length === 0 ? <div className="empty" style={{ padding: 28 }}>No bookings yet.</div> : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Tenant</th><th>Property</th><th className="num">Rent</th><th>Status</th></tr></thead>
                <tbody>
                  {data.recentBookings.map((booking) => (
                    <tr key={booking._id}>
                      <td><div className="cell-main">{booking.userName || '—'}</div><div className="cell-sub">{date(booking.createdAt)}</div></td>
                      <td className="truncate" style={{ maxWidth: 240 }}>{booking.propertyTitle || booking.propertyName}</td>
                      <td className="num">{money(booking.rent || booking.amount)}</td>
                      <td><Badge>{booking.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="card">
          <div className="card-header"><h2>Recent activity</h2></div>
          <div className="list">
            {data.recentActivity.length === 0 && <div className="empty" style={{ padding: 28 }}>No activity yet.</div>}
            {data.recentActivity.map((item) => (
              <div key={item.id} className="list-item">
                <div className="list-icon tone-blue"><Home size={16} /></div>
                <div style={{ minWidth: 0 }}>
                  <div className="strong small">{titleCase(String(item.action || '').toLowerCase())}</div>
                  <div className="small muted">{item.details}</div>
                  <div className="small muted">{timeAgo(item.timestamp)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card mt-16">
        <div className="card-header"><h2>Newest users</h2><Link to="/users" className="small strong">Manage users</Link></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th></tr></thead>
            <tbody>
              {data.recentUsers.map((user) => (
                <tr key={user._id}>
                  <td className="cell-main">{user.name}</td>
                  <td>{user.email}</td>
                  <td><Badge dot={false}>{titleCase(user.role)}</Badge></td>
                  <td><Badge>{user.status || 'Active'}</Badge></td>
                  <td>{date(user.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="muted small mt-16"><CreditCard size={12} style={{ verticalAlign: -1 }} /> All figures are calculated live from MongoDB.</p>
    </>
  );
}

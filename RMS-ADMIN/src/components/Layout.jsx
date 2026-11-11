import { useCallback, useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  MapPinned,
  Bell, Building2, CalendarCheck, ClipboardList, CreditCard, ExternalLink, Globe, LayoutDashboard,
  LogOut, Mail, Menu, Megaphone, Receipt, Star, UserCircle, Users, Wrench,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { api, USER_SITE_URL } from '../lib/api';
import { timeAgo } from '../lib/format';
import { Avatar, IconButton } from './ui';

const NAV = [
  { group: 'Overview', items: [{ to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true }] },
  { group: 'Listings', items: [{ to: '/properties', label: 'Properties', icon: Building2 }, { to: '/areas', label: 'Areas', icon: MapPinned }] },
  {
    group: 'Rentals',
    items: [
      { to: '/bookings', label: 'Bookings', icon: CalendarCheck, count: 'pendingBookings' },
      { to: '/applications', label: 'Rent Applications', icon: ClipboardList, count: 'pendingApplications' },
      { to: '/rent', label: 'Rent & Dues', icon: Receipt },
      { to: '/payments', label: 'Payments', icon: CreditCard, count: 'pendingPayments' },
      { to: '/maintenance', label: 'Maintenance', icon: Wrench, count: 'openMaintenance' },
    ],
  },
  {
    group: 'People',
    items: [
      { to: '/users', label: 'Users', icon: Users },
      { to: '/messages', label: 'Messages', icon: Mail, count: 'newMessages' },
      { to: '/reviews', label: 'Reviews', icon: Star },
      { to: '/notifications', label: 'Notifications', icon: Megaphone },
    ],
  },
  {
    group: 'Settings',
    items: [
      { to: '/site-content', label: 'Site Content', icon: Globe },
      { to: '/profile', label: 'My Profile', icon: UserCircle },
    ],
  },
];

const TITLES = [
  ['/properties/new', 'Add Property'], ['/properties/', 'Edit Property'], ['/properties', 'Properties'], ['/areas', 'Areas'], ['/bookings', 'Bookings'],
  ['/applications', 'Rent Applications'], ['/rent', 'Rent & Dues'], ['/payments', 'Payments'], ['/maintenance', 'Maintenance'],
  ['/users', 'Users'], ['/messages', 'Messages'], ['/reviews', 'Reviews'], ['/notifications', 'Notifications'],
  ['/site-content', 'Site Content'], ['/profile', 'My Profile'],
];

function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const ref = useRef(null);

  const load = useCallback(() => {
    api.get('/notifications/admin/all').then((response) => setItems(response.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 30000);
    window.addEventListener('rms-admin:notifications-changed', load);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('rms-admin:notifications-changed', load);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return undefined;
    const onClick = (event) => { if (!ref.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const unread = items.filter((item) => !item.isRead);
  const markAll = async () => {
    await api.post('/notifications/mark-all-read').catch(() => {});
    load();
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <IconButton icon={Bell} label="Notifications" badge={unread.length} onClick={() => setOpen((value) => !value)} />
      {open && (
        <div className="card" style={{ position: 'absolute', right: 0, top: 42, width: 360, maxWidth: 'calc(100vw - 32px)', boxShadow: 'var(--shadow-lg)', zIndex: 50 }}>
          <div className="card-header" style={{ padding: '12px 16px' }}>
            <h3>Notifications</h3>
            {unread.length > 0 && <button type="button" className="btn btn-ghost btn-sm" onClick={markAll}>Mark all read</button>}
          </div>
          <div className="list" style={{ maxHeight: 360, overflowY: 'auto' }}>
            {items.length === 0 && <div className="empty" style={{ padding: 24 }}>You're all caught up.</div>}
            {items.slice(0, 8).map((item) => (
              <div key={item._id} className={`list-item ${item.isRead ? '' : 'unread'}`} style={{ padding: '10px 16px' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="strong truncate">{item.title}</div>
                  <div className="small muted" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.message}</div>
                  <div className="small muted">{timeAgo(item.createdAt)}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ padding: 10, borderTop: '1px solid var(--border)' }}>
            <button type="button" className="btn btn-secondary btn-sm btn-block" onClick={() => { setOpen(false); navigate('/notifications'); }}>View all</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState({});

  useEffect(() => {
    let active = true;
    const load = () => api.get('/admin/analytics').then((response) => { if (active) setCounts(response.data?.summary || {}); }).catch(() => {});
    load();
    const timer = window.setInterval(load, 60000);
    window.addEventListener('rms-admin:counts-changed', load);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('rms-admin:counts-changed', load);
    };
  }, []);

  const title = location.pathname === '/' ? 'Dashboard' : (TITLES.find(([prefix]) => location.pathname.startsWith(prefix))?.[1] || 'RMS Admin');
  useEffect(() => { document.title = `${title} · RMS Admin`; }, [title]);

  return (
    <div className="app-shell">
      <aside className={`sidebar ${open ? 'open' : ''}`} aria-label="Main navigation">
        <div className="sidebar-brand">
          <div className="brand-mark">RMS</div>
          <div className="brand-text">
            <strong>RMS Admin</strong>
            <small>Lahore Rental Management</small>
          </div>
        </div>
        <nav className="sidebar-nav">
          {NAV.map((group) => (
            <div key={group.group} className="nav-group">
              <div className="nav-group-label">{group.group}</div>
              {group.items.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setOpen(false)} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  <item.icon size={17} />
                  <span>{item.label}</span>
                  {item.count && counts[item.count] > 0 && <span className="nav-count">{counts[item.count]}</span>}
                </NavLink>
              ))}
            </div>
          ))}
          <div className="nav-group">
            <div className="nav-group-label">Public site</div>
            <a className="nav-link" href={USER_SITE_URL} target="_blank" rel="noreferrer"><ExternalLink size={17} /><span>Open user site</span></a>
          </div>
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <Avatar name={user?.name} src={user?.profileImage} />
            <div style={{ minWidth: 0 }}>
              <strong className="truncate">{user?.name || 'Admin'}</strong>
              <small className="truncate" style={{ display: 'block' }}>{user?.email}</small>
            </div>
            <button type="button" className="icon-btn" style={{ color: '#c7d2e5' }} onClick={logout} title="Sign out" aria-label="Sign out"><LogOut size={16} /></button>
          </div>
        </div>
      </aside>
      <div className={`sidebar-backdrop ${open ? 'open' : ''}`} onClick={() => setOpen(false)} />

      <div className="main">
        <header className="topbar">
          <button type="button" className="icon-btn menu-btn" onClick={() => setOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
          <div className="topbar-title">{title}</div>
          <div className="topbar-spacer" />
          <NotificationBell />
          <NavLink to="/profile" className="row" style={{ textDecoration: 'none', color: 'inherit' }} title="My profile">
            <Avatar name={user?.name} src={user?.profileImage} />
          </NavLink>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}


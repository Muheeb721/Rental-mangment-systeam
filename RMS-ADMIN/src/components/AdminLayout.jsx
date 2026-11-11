import { Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useMemo, useRef, useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { approveAdminBooking, rejectAdminBooking } from '../services/adminBookingService';
import { apiConfig, apiService } from '../services/api';
import { getAdminImageUrl } from '../utils/adminImageUrl';
import './AdminLayout.css';
import './admin-theme.css';
import DashboardPage from '../pages/DashboardPage';
import AdminHomePage from '../pages/AdminHomePage';
import PropertiesPage from '../pages/PropertiesPage';
import HousesPage from '../pages/HousesPage';
import ApartmentsPage from '../pages/ApartmentsPage';
import FlatsPage from '../pages/FlatsPage';
import UsersPage from '../pages/UsersPage';
import BookingsPage from '../pages/BookingsPage';
import PaymentsPage from '../pages/PaymentsPage';
import DuesPage from '../pages/DuesPage';
import NotificationsPage from '../pages/NotificationsPage';
import AnnouncementsPage from '../pages/AnnouncementsPage';
import AreasPage from '../pages/AreasPage';
import ReviewsPage from '../pages/ReviewsPage';
import ReportsPage from '../pages/ReportsPage';
import AdminProfile from '../pages/AdminProfile';
import SettingsPage from '../pages/SettingsPage';
import RentManagementPage from '../pages/RentManagementPage';
import TenantProfilePage from '../pages/TenantProfilePage';
import TenantProfilesPage from '../pages/TenantProfilesPage';
import ImageManagementPage from '../pages/ImageManagementPage';

const navItems = [
  { label: 'Dashboard', path: '/', icon: '⌂' },
  { label: 'Admin Home', path: '/home', icon: '⌂' },
  { label: 'Houses', path: '/houses', icon: '▣' },
  { label: 'Apartments', path: '/apartments', icon: '▤' },
  { label: 'Flats', path: '/flats', icon: '▥' },
  { label: 'Properties', path: '/properties', icon: '◍' },
  { label: 'Image Management', path: '/images', icon: '🖼' },
  { label: 'Users', path: '/users', icon: '👥' },
  { label: 'Bookings', path: '/bookings', icon: '🗓' },
  { label: 'Payments', path: '/payments', icon: '💳' },
  { label: 'Dues', path: '/dues', icon: '📄' },
  { label: 'Rent Management', path: '/rent-management', icon: '₹' },
  { label: 'Tenant Profiles', path: '/tenant-profiles', icon: '🏷' },
  { label: 'Notifications', path: '/notifications', icon: '🔔' },
  { label: 'Reviews', path: '/reviews', icon: '⭐' },
  { label: 'Reports', path: '/reports', icon: '📊' },
  { label: 'Announcements', path: '/announcements', icon: '📣' },
  { label: 'Areas', path: '/areas', icon: '📍' },
  { label: 'Settings', path: '/settings', icon: '⚙' },
  { label: 'Admin Profile', path: '/profile', icon: '👤' },
];

function AdminLayout({ appData, setAppData, onLogout, notify }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const autoApprovingBookingIds = useRef(new Set());
  const searchResults = useMemo(() => {
    const term = globalSearch.trim().toLowerCase();
    if (!term) return [];

    const matches = [];
    const addMatches = (items, type, route) => {
      items.forEach((item) => {
        const haystack = [
          item?.name,
          item?.fullName,
          item?.email,
          item?.phone,
          item?.title,
          item?.propertyName,
          item?.propertyTitle,
          item?.location,
          item?.city,
          item?.customerName,
          item?.bookingId,
          item?.paymentId,
          item?.transactionId,
          item?.id,
          item?._id,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        if (haystack.includes(term)) {
          matches.push({
            type,
            route,
            label: item?.fullName || item?.name || item?.title || item?.propertyName || item?.propertyTitle || item?.customerName || item?.email || item?.bookingId || item?.paymentId || item?.id || item?._id,
            detail: item?.email || item?.location || item?.city || item?.propertyType || item?.status || item?.bookingStatus || item?.paymentType || item?.role || 'Record',
          });
        }
      });
    };

    addMatches(appData?.users || [], 'User', '/admin/users');
    addMatches(appData?.properties || [], 'Property', '/admin/properties');
    addMatches(appData?.bookings || [], 'Booking', '/admin/bookings');
    addMatches(appData?.tenants || [], 'Tenant', '/admin/tenant-profiles');
    addMatches(appData?.payments || [], 'Payment', '/admin/payments');

    return matches.slice(0, 6);
  }, [appData, globalSearch]);

  const unreadCount = useMemo(
    () => (appData?.notifications || []).filter((item) => !item.read).length,
    [appData.notifications],
  );

  const settings = appData.settings || {};
  const darkMode = settings.darkMode ?? false;
  const notificationsEnabled = settings.notifications ?? true;
  const adminName = appData.profile?.fullName || appData.admin?.fullName || appData.admin?.name || 'Admin';
  const adminImage = getAdminImageUrl(appData.profile?.profileImage || appData.admin?.profileImage);

  useEffect(() => {
    let cancelled = false;

    const syncAdminNotifications = async () => {
      try {
        const response = await apiService.request('/notifications/admin/all');
        if (!response?.success || !Array.isArray(response.data)) return;

        const nextNotifications = response.data.map((item, index) => ({
          ...item,
          id: item._id || item.id || `notif-${index + 1}`,
          _id: item._id || item.id || `notif-${index + 1}`,
          title: item.title || item.actionType || 'Notification',
          message: item.message || item.detail || '',
          detail: item.message || item.detail || '',
          read: item.isRead ?? item.read ?? false,
          time: item.time || (item.createdAt ? new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'),
        }));

        if (!cancelled) {
          setAppData((prev) => ({
            ...prev,
            notifications: nextNotifications,
          }));
        }
      } catch (error) {
        console.warn('Unable to sync admin notifications from backend:', error?.message || error);
      }
    };

    syncAdminNotifications();
    const timer = window.setInterval(syncAdminNotifications, 15000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [setAppData]);

  useEffect(() => {
    const token = window.localStorage.getItem('rms_admin_token') || window.localStorage.getItem('rms_token');
    if (!token) return undefined;

    const autoApproveNewBooking = async (notification) => {
      if (!settings.autoApprove || notification?.actionType !== 'BOOKING_SUBMITTED') return;

      const bookingId = String(notification.metadata?.bookingId || notification.entityId || '');
      if (!bookingId || autoApprovingBookingIds.current.has(bookingId)) return;

      autoApprovingBookingIds.current.add(bookingId);
      try {
        const approvedBooking = await approveAdminBooking(bookingId);
        setAppData((prev) => {
          const found = (prev.bookings || []).some((booking) => String(booking._id || booking.id) === bookingId);
          const updatedBookings = (prev.bookings || []).map((booking) =>
            String(booking._id || booking.id) === bookingId
              ? { ...booking, ...approvedBooking, bookingStatus: 'Approved', status: 'Approved' }
              : booking,
          );
          return {
            ...prev,
            bookings: found ? updatedBookings : [{ ...approvedBooking, bookingStatus: 'Approved', status: 'Approved' }, ...updatedBookings],
          };
        });
        notify({ message: 'New booking automatically approved.', variant: 'success' });
      } catch (error) {
        autoApprovingBookingIds.current.delete(bookingId);
        console.error('Automatic booking approval failed:', error);
        notify({ message: error?.message || 'Unable to automatically approve the new booking.', variant: 'error' });
      }
    };

    const socket = io(apiConfig.socketUrl || 'http://localhost:5000', {
      auth: { token },
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });

    socket.on('notification:new', (item) => {
      setAppData((prev) => {
        const id = String(item?._id || item?.id || '');
        if (!id) return prev;
        const current = prev.notifications || [];
        const normalized = {
          ...item,
          id,
          _id: id,
          detail: item.message || item.detail || '',
          read: item.isRead ?? item.read ?? false,
          time: item.createdAt
            ? new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : 'Just now',
        };
        const withoutDuplicate = current.filter((notification) => String(notification.id || notification._id) !== id);
        return { ...prev, notifications: [normalized, ...withoutDuplicate] };
      });
      autoApproveNewBooking(item);
    });

    return () => socket.disconnect();
  }, [setAppData, settings.autoApprove, notify]);

  useEffect(() => {
    if (!sidebarOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setSidebarOpen(false);
    };

    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [sidebarOpen]);

  const handleSearchNavigate = (result) => {
    setGlobalSearch('');
    navigate(result.route);
  };

  const titleMap = {
    '/': 'Dashboard',
    '/home': 'Admin Home',
    '/houses': 'Houses',
    '/apartments': 'Apartments',
    '/flats': 'Flats',
    '/properties': 'Properties',
    '/images': 'Image Management',
    '/users': 'Users',
    '/bookings': 'Bookings',
    '/payments': 'Payments',
    '/dues': 'Dues',
    '/notifications': 'Notifications',
    '/reviews': 'Reviews',
    '/reports': 'Reports',
    '/announcements': 'Announcements',
    '/areas': 'Areas',
    '/rent-management': 'Rent Management',
    '/settings': 'Settings',
    '/profile': 'Admin Profile',
    '/tenant-profiles': 'Tenant Profiles',
  };

  const currentRoute = location.pathname.replace(/^\/admin/, '') || '/';
  const currentTitle = titleMap[currentRoute] || (currentRoute.startsWith('/tenant-profile/') ? 'Tenant Profile' : 'Dashboard');

  const handleBookingDecision = async (bookingId, bookingStatus) => {
    try {
      const booking = (appData.bookings || []).find((b) => String(b.id) === String(bookingId) || String(b._id) === String(bookingId));
      const targetId = booking?._id || bookingId;

      if (bookingStatus === 'Approved') {
        await approveAdminBooking(targetId);
      } else {
        await rejectAdminBooking(targetId, `Booking marked as ${bookingStatus.toLowerCase()} by admin.`);
      }

      setAppData((prev) => ({
        ...prev,
        bookings: (prev.bookings || []).map((b) =>
          (String(b.id) === String(bookingId) || String(b._id) === String(bookingId))
            ? { ...b, bookingStatus, paymentStatus: bookingStatus === 'Approved' ? 'Paid' : b.paymentStatus }
            : b,
        ),
        notifications: [
          {
            id: `notif-${Date.now()}`,
            title: `Booking ${bookingStatus}`,
            message: `Booking ${bookingId} was marked as ${bookingStatus.toLowerCase()}.`,
            type: 'Booking',
            recipient: 'Admin',
            date: new Date().toISOString(),
            read: false,
            priority: 'High',
          },
          ...(prev.notifications || []),
        ],
        activityLogs: [
          {
            id: `log-${Date.now()}`,
            action: 'Booking updated',
            details: `Booking ${bookingId} status changed to ${bookingStatus}.`,
            timestamp: new Date().toISOString(),
          },
          ...(prev.activityLogs || []),
        ],
      }));

      notify({ message: `Booking ${bookingStatus.toLowerCase()} successfully.`, variant: 'success' });
    } catch (error) {
      console.error('Booking decision failed (AdminLayout):', error);
      notify({ message: error?.message || 'Unable to update booking status.', variant: 'error' });
    }
  };

  return (
    <div className={`dashboard-shell ${collapsed ? 'sidebar-collapsed' : ''}`} data-theme={darkMode ? 'dark' : 'light'}>
      <button
        type="button"
        className="menu-toggle"
        onClick={() => setSidebarOpen((prev) => !prev)}
        aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
        aria-expanded={sidebarOpen}
        aria-controls="admin-sidebar"
      >
        {sidebarOpen ? '×' : '☰'}
      </button>
      <div className={`sidebar-backdrop ${sidebarOpen ? 'show' : ''}`} onClick={() => setSidebarOpen(false)} />

      <aside id="admin-sidebar" className={`sidebar ${sidebarOpen ? 'open' : ''}`} aria-label="Admin navigation">
        <div className="sidebar-header">
          <div className="app-brand">RMS</div>
          {!collapsed && (
            <div className="brand-copy">
              <strong>RMS Admin</strong>
              <small>Operations Suite</small>
            </div>
          )}
          <button
            type="button"
            className="collapse-toggle"
            onClick={() => setCollapsed((prev) => !prev)}
            aria-label="Collapse sidebar"
          >
            {collapsed ? '→' : '←'}
          </button>
        </div>

        <nav className="sidebar-nav" aria-label="Sidebar navigation">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={`/admin${item.path}`}
              end={item.path === '/'}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}
              title={collapsed ? item.label : ''}
            >
              <span className="nav-icon">{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button type="button" className="outline-button" onClick={() => navigate('/admin/profile')}>
            {!collapsed ? 'View Profile' : '👤'}
          </button>
          <button type="button" className="primary-button" onClick={onLogout}>
            {!collapsed ? 'Logout' : '⇠'}
          </button>
        </div>
      </aside>

      <main className="content-area">
        <header className="topbar">
          <div className="topbar-heading">
            <p className="eyebrow">Operations</p>
            <h2>{currentTitle}</h2>
          </div>

          <div className="topbar-actions">
            <div className="search-box global-search">
              <span aria-hidden="true">⌕</span>
              <input
                type="text"
                value={globalSearch}
                onChange={(event) => setGlobalSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && searchResults[0]) {
                    handleSearchNavigate(searchResults[0]);
                  }
                }}
                placeholder="Search users, properties, bookings..."
                aria-label="Global search"
              />
              {searchResults.length > 0 && (
                <div className="search-results">
                  {searchResults.map((result) => (
                    <button type="button" key={`${result.type}-${result.label}`} className="search-result-item" onClick={() => handleSearchNavigate(result)}>
                      <span className="search-result-type">{result.type}</span>
                      <span>{result.label}</span>
                      <small>{result.detail}</small>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              className="header-icon-button notification-button"
              aria-label="Open notifications"
              title="Open notifications"
              onClick={() => navigate('/admin/notifications')}
            >
              🔔
              {notificationsEnabled && unreadCount > 0 && <span className="header-badge">{unreadCount}</span>}
            </button>
            <button type="button" className="profile-pill" onClick={() => navigate('/admin/profile')}>
              <span className="avatar-wrap">
                {adminName.slice(0, 2).toUpperCase()}
                {adminImage && (
                  <img
                    className="profile-avatar-image"
                    src={adminImage}
                    alt={`${adminName} profile`}
                    onError={(event) => {
                      event.currentTarget.style.display = 'none';
                    }}
                  />
                )}
              </span>
              {!collapsed && (
                <span className="profile-meta">
                  <strong>{adminName}</strong>
                  <small>Admin</small>
                </span>
              )}
            </button>
          </div>
        </header>

        <Routes>
          <Route path="/" element={<DashboardPage appData={appData} setAppData={setAppData} />} />
          <Route path="/home" element={<AdminHomePage appData={appData} setAppData={setAppData} notify={notify} />} />
          <Route path="/houses" element={<HousesPage appData={appData} setAppData={setAppData} notify={notify} />} />
          <Route path="/apartments" element={<ApartmentsPage appData={appData} setAppData={setAppData} notify={notify} />} />
          <Route path="/flats" element={<FlatsPage appData={appData} setAppData={setAppData} notify={notify} />} />
          <Route path="/properties" element={<PropertiesPage appData={appData} setAppData={setAppData} notify={notify} />} />
          <Route path="/images" element={<ImageManagementPage appData={appData} setAppData={setAppData} notify={notify} />} />
          <Route path="/users" element={<UsersPage appData={appData} setAppData={setAppData} notify={notify} />} />
          <Route path="/bookings" element={<BookingsPage appData={appData} setAppData={setAppData} notify={notify} onBookingDecision={handleBookingDecision} />} />
          <Route path="/payments" element={<PaymentsPage appData={appData} setAppData={setAppData} notify={notify} />} />
          <Route path="/dues" element={<DuesPage appData={appData} setAppData={setAppData} notify={notify} />} />
            <Route path="/rent-management" element={<RentManagementPage appData={appData} setAppData={setAppData} notify={notify} />} />
          <Route path="/notifications" element={<NotificationsPage appData={appData} setAppData={setAppData} notify={notify} />} />
          <Route path="/announcements" element={<AnnouncementsPage appState={appData} setAppState={setAppData} notify={notify} />} />
          <Route path="/areas" element={<AreasPage appData={appData} setAppData={setAppData} notify={notify} />} />
          <Route path="/reviews" element={<ReviewsPage appData={appData} setAppData={setAppData} notify={notify} />} />
          <Route path="/reports" element={<ReportsPage appData={appData} setAppData={setAppData} />} />
          <Route path="/tenant-profile/:tenantKey" element={<TenantProfilePage appData={appData} setAppData={setAppData} />} />
          <Route path="/profile" element={<AdminProfile appData={appData} setAppData={setAppData} notify={notify} />} />
          <Route path="/settings" element={<SettingsPage appData={appData} setAppData={setAppData} notify={notify} />} />
          <Route path="/tenant-profiles" element={<TenantProfilesPage appData={appData} setAppData={setAppData} notify={notify} />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default AdminLayout;

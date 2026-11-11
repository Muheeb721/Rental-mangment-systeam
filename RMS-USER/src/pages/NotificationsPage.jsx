import { useEffect, useMemo, useState } from "react";
import { Spin, Alert } from 'antd';
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from 'react-redux';
import {
  BellOutlined,
  SearchOutlined,
  UserOutlined,
  DeleteOutlined,
  MoreOutlined,
  HomeOutlined,
  ApartmentOutlined,
  DashboardOutlined,
  SettingOutlined,
  DollarCircleOutlined,
  ToolOutlined,
  MessageOutlined,
} from "@ant-design/icons";
import "./NotificationsPage.css";
import {
  readStoredNotifications,
  saveStoredNotifications,
} from "../utils/notificationsStorage.jsx";
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';
import {
  fetchNotificationsFromServer,
  markAllNotificationsOnServer,
  deleteNotificationOnServer,
  markNotificationAsReadOnServer,
} from '../services/notificationService.jsx';
import {
  markAllNotificationsAsRead,
  markNotificationAsRead,
  removeNotification,
  setNotifications as setReduxNotifications,
} from '../redux/store';

const navItems = [
  { label: "Home", to: "/", icon: <HomeOutlined /> },
  { label: "Properties", to: "/properties", icon: <ApartmentOutlined /> },
  { label: "Dashboard", to: "/dashboard", icon: <DashboardOutlined /> },
  { label: "Settings", to: "/settings", icon: <SettingOutlined /> },
  { label: "Payments", to: "/payments", icon: <DollarCircleOutlined /> },
  { label: "Maintenance", to: "/maintenance", icon: <ToolOutlined /> },
  { label: "Messages", to: "/contact", icon: <MessageOutlined /> },
];

const initialNotifications = [
  {
    id: 1,
    title: "Rent Payment Due",
    message:
      "Your monthly rent payment of PKR 45,000 is due on August 15, 2026. Please make your payment before the due date.",
    time: "2 hours ago",
    category: "Rent",
    unread: true,
    accent: "warning",
    icon: "💳",
    action: "Pay Rent",
    source: "Property Management",
    recipient: "Amina Khan",
    propertyName: "Apartment 4B",
    amount: "PKR 45,000",
    dueDate: "August 15, 2026",
    notes: "Invoice was generated from the monthly dues system.",
  },
  {
    id: 2,
    title: "Rent Payment Overdue",
    message:
      "Your rent payment for August is overdue. Please clear your outstanding balance as soon as possible.",
    time: "Yesterday",
    category: "Rent",
    unread: true,
    accent: "danger",
    icon: "⚠️",
    action: "View Payment",
    source: "Finance Team",
    recipient: "Amina Khan",
    propertyName: "Apartment 4B",
    amount: "PKR 45,000",
    dueDate: "August 1, 2026",
    notes: "Late fee may apply if payment is not completed today.",
  },
  {
    id: 3,
    title: "Property Successfully Sold",
    message:
      "Your property at House #24, Block B has been successfully sold. Check your property details for more information.",
    time: "Yesterday",
    category: "Property",
    unread: false,
    accent: "success",
    icon: "🏠",
    action: "View Property",
    source: "RMS Admin",
    recipient: "Amina Khan",
    propertyName: "House #24, Block B",
    buyer: "Ali Hassan",
    amount: "PKR 8,500,000",
    saleDate: "August 10, 2026",
    notes: "The property sale was completed and the transaction record was updated.",
  },
  {
    id: 4,
    title: "New Property Available",
    message:
      "A new house is now available for sale in Block C. View the property details, price and available facilities.",
    time: "1 day ago",
    category: "Property",
    unread: true,
    accent: "info",
    icon: "🏡",
    action: "View Property",
  },
  {
    id: 5,
    title: "Maintenance Request Updated",
    message:
      "Your maintenance request #RM1024 has been assigned to our maintenance team.",
    time: "3 days ago",
    category: "Maintenance",
    unread: false,
    accent: "maintenance",
    icon: "🛠️",
    action: "View Request",
    status: "In Progress",
  },
  {
    id: 6,
    title: "Important Community Announcement",
    message:
      "Management has announced that the main entrance will remain closed from 10:00 AM to 2:00 PM on Saturday due to maintenance work.",
    time: "Today, 9:30 AM",
    category: "Announcements",
    unread: true,
    accent: "announcement",
    icon: "📢",
    action: "Read Announcement",
    featured: true,
  },
];

const filters = [
  "All",
  "Unread",
  "Rent",
  "Property",
  "Maintenance",
  "Announcements",
];

function NotificationsPage() {
  const dispatch = useDispatch();
  const { isAuthenticated, user } = useAuth();
  const storedNotifications = useSelector((state) => Array.isArray(state.auth?.notifications) ? state.auth.notifications : []);
  const [activeFilter, setActiveFilter] = useState("All");
  const [notifications, setNotificationsList] = useState(() => readStoredNotifications(initialNotifications));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const authKey = `${Boolean(isAuthenticated)}-${user?.email || user?.id || 'guest'}`;

  useEffect(() => {
    if (!isAuthenticated && !user?.email) {
      const fallbackNotifications = initialNotifications.map(normalizeIncoming);
      setNotificationsList(fallbackNotifications);
      dispatch(setReduxNotifications(fallbackNotifications));
      setLoading(false);
      setError(null);
      return undefined;
    }

    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetchNotificationsFromServer();
        if (!mounted) return;

        if (res && res.success && Array.isArray(res.data)) {
          const normalized = res.data.map(normalizeIncoming);
          setNotificationsList(normalized);
          dispatch(setReduxNotifications(normalized));
          saveStoredNotifications(normalized);
          setLoading(false);
          return;
        }

        const fallbackNotifications = [];
        setNotificationsList(fallbackNotifications);
        dispatch(setReduxNotifications(fallbackNotifications));
        saveStoredNotifications(fallbackNotifications);
      } catch (e) {
        console.warn('fetch notifications failed', e);
        if (!mounted) return;
        setError('Unable to load notifications.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, [authKey, dispatch, isAuthenticated, user?.email, user?.id]);

  const normalizeIncoming = (it) => {
    const id = it.id || it._id || it._id?.toString() || Date.now();
    const title = it.title || it.actionType || 'Notification';
    const message = it.message || it.body || 'You have a new notification.';
    const createdAt = it.createdAt || it.time || new Date().toISOString();
    const date = new Date(createdAt);
    const time = String(it.time || date.toLocaleString('en-PK', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }));
    const unread = typeof it.unread === 'boolean' ? it.unread : (it.isRead === true ? false : true);
    const accent = it.accent || (it.type === 'payment' ? 'warning' : (it.type === 'property' ? 'success' : 'info'));
    const icon = it.icon || (accent === 'warning' ? '💳' : (accent === 'success' ? '🏠' : '🔔'));
    const category = it.category || (it.type ? String(it.type).charAt(0).toUpperCase() + String(it.type).slice(1) : 'General');
    return { ...it, id, title, message, time, createdAt, unread, accent, icon, category, action: it.action || 'View', featured: !!it.featured, propertyName: it.propertyName || it.raw?.propertyName || '' };
  };

  useEffect(() => {
    if (storedNotifications.length) {
      setNotificationsList(storedNotifications);
    }
  }, [storedNotifications]);

  // Defensive notification handling: ensure arrays and safe date parsing
  const notificationsArr = Array.isArray(notifications) ? notifications : [];

  const filteredNotifications = useMemo(() => {
    const sorted = [...notificationsArr].sort((a, b) => {
      const timeA = Number(Date.parse(a?.createdAt || a?.time)) || 0;
      const timeB = Number(Date.parse(b?.createdAt || b?.time)) || 0;
      return timeB - timeA;
    });

    return sorted.filter((item) => {
      if (activeFilter === "Unread") return Boolean(item?.unread);
      if (activeFilter === "All") return true;
      return item?.category === activeFilter;
    });
  }, [activeFilter, notificationsArr]);

  const unreadCount = notificationsArr.filter((item) => Boolean(item?.unread)).length;
  const rentCount = notificationsArr.filter((item) => item?.category === "Rent").length;
  const propertyCount = notificationsArr.filter((item) => item?.category === "Property").length;
  const maintenanceCount = notificationsArr.filter((item) => item?.category === "Maintenance").length;
  const announcementCount = notificationsArr.filter((item) => item?.category === "Announcements").length;

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsOnServer();
    } catch (error) {
      console.warn('Mark all notifications read via API failed:', error);
    }

    dispatch(markAllNotificationsAsRead());
    const next = notifications.map((item) => ({ ...item, unread: false }));
    setNotificationsList(next);
    saveStoredNotifications(next);
  };

  const handleMarkAsRead = async (id) => {
    const notificationId = String(id);
    try {
      await markNotificationAsReadOnServer(notificationId);
    } catch (error) {
      console.warn('Mark one notification read via API failed:', error);
    }

    dispatch(markNotificationAsRead(notificationId));
    const next = notifications.map((item) =>
      String(item.id) === notificationId ? { ...item, unread: false } : item,
    );
    setNotificationsList(next);
    saveStoredNotifications(next);
  };

  const handleDelete = (id) => {
    (async () => {
      try {
        await deleteNotificationOnServer(String(id));
      } catch (e) {
        console.warn('Delete notification on server failed', e);
      }
    })();
    dispatch(removeNotification(id));
    const next = notifications.filter((item) => item.id !== id);
    setNotificationsList(next);
    saveStoredNotifications(next);
  };

  const handleClearAll = () => {
    dispatch(setReduxNotifications([]));
    setNotificationsList([]);
    saveStoredNotifications([]);
  };

  const openNotificationDetails = (item) => {
    setSelectedNotification(item);
  };

  const closeNotificationDetails = () => {
    setSelectedNotification(null);
  };

  // Wrap render in try/catch to avoid crashing the whole app if a single notification has malformed data
  let pageContent;
  try {
    pageContent = (
      <div className="notifications-page">
      <aside className="notifications-sidebar">
        <div className="brand-block">
          <div className="brand-icon">🏠</div>
          <div>
            <h3>RMS</h3>
            <p>Property Hub</p>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <Link
              key={item.label}
              to={item.to}
              className={`sidebar-link ${item.label === "Home" ? "active" : ""}`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="sidebar-card">
          <h4>Need help?</h4>
          <p>
            Review your latest property updates and resident announcements
            instantly.
          </p>
          <Link to="/contact" className="sidebar-btn">
            Contact Support
          </Link>
        </div>
      </aside>

      <main className="notifications-main">
        <header className="notifications-topbar">
          <div className="topbar-title">
            <h2>Notifications</h2>
            <p>Stay connected with your property activities.</p>
          </div>
          <div className="topbar-actions">
            <button type="button" className="icon-btn" aria-label="Search">
              <SearchOutlined />
            </button>
            <button
              type="button"
              className="icon-btn bell-btn"
              aria-label="Notifications"
            >
              <BellOutlined />
              <span className="badge-dot">{unreadCount}</span>
            </button>
            <Link to="/profile" className="user-pill">
              <UserOutlined />
              <span>Admin</span>
            </Link>
          </div>
        </header>

        <section className="page-header-card">
          <div>
            <p className="section-eyebrow">RMS Updates</p>
            <h1>Notifications</h1>
            <p className="page-subtitle">
              Stay updated with your property, rent, sales and community
              announcements.
            </p>
          </div>
          <div className="page-header-actions">
            <button
              type="button"
              className="secondary-btn"
              onClick={handleMarkAllRead}
            >
              Mark all as read
            </button>
            <button
              type="button"
              className="secondary-btn"
              onClick={handleClearAll}
            >
              Clear all
            </button>
            <button type="button" className="primary-btn">
              Notification Settings
            </button>
          </div>
        </section>

        <section className="filters-row">
          <div className="filter-tabs">
            {filters.map((filter) => (
              <button
                key={filter}
                type="button"
                className={`filter-chip ${activeFilter === filter ? "active" : ""}`}
                onClick={() => setActiveFilter(filter)}
              >
                {filter}
              </button>
            ))}
          </div>
          <select className="date-filter" defaultValue="Today">
            <option>Filter by date</option>
            <option>Today</option>
            <option>This week</option>
            <option>This month</option>
          </select>
        </section>

        <div className="content-grid">
          <div className="notification-list">
            {loading ? (
              <div style={{ textAlign: 'center', padding: 40 }}><Spin size="large" /></div>
            ) : error ? (
              <Alert type="error" message={error} />
            ) : filteredNotifications.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🔔</div>
                <h3>You&apos;re All Caught Up!</h3>
                <p>
                  New notifications about your property, rent and community will
                  appear here.
                </p>
              </div>
            ) : (
              filteredNotifications.map((item) => (
                <article
                  key={item.id}
                  className={`notification-card ${item.unread ? "unread" : ""} ${item.featured ? "featured" : ""}`}
                >
                  <div className={`notification-icon ${item.accent}`}>
                    {item.icon}
                  </div>
                  <div className="notification-body">
                    <div className="notification-heading">
                      <div>
                        <div className="notification-title-row">
                          <h3>{item.title}</h3>
                          {item.unread && <span className="status-dot" />}
                        </div>
                        <p>{item.message}</p>
                      </div>
                      <span className="notification-time">{item.time}</span> 
                    </div>
                    <div className="notification-footer">
                      <div className="notification-meta">
                        {item.status && (
                          <span className="status-pill">{item.status}</span>
                        )}
                        <span className="category-pill">{item.category}</span>
                      </div>
                      <div className="notification-actions">
                        {item.unread && (
                          <button
                            type="button"
                            className="text-btn"
                            onClick={() => handleMarkAsRead(item.id)}
                          >
                            Mark read
                          </button>
                        )}
                        <button
                          type="button"
                          className="action-btn"
                          onClick={() => openNotificationDetails(item)}
                        >
                          {item.action}
                        </button>
                        <button
                          type="button"
                          className="icon-btn small"
                          aria-label="Delete notification"
                          onClick={() => handleDelete(item.id)}
                        >
                          <DeleteOutlined />
                        </button>
                        <button
                          type="button"
                          className="icon-btn small"
                          aria-label="More options"
                        >
                          <MoreOutlined />
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>

          <aside className="right-rail">
            <div className="summary-card">
              <h3>Notification Overview</h3>
              <ul>
                <li>
                  <span className="dot blue" />
                  {unreadCount} Unread
                </li>
                <li>
                  <span className="dot orange" />
                  {rentCount} Rent Notifications
                </li>
                <li>
                  <span className="dot green" />
                  {propertyCount} Property Updates
                </li>
                <li>
                  <span className="dot purple" />
                  {maintenanceCount} Maintenance Updates
                </li>
                <li>
                  <span className="dot teal" />
                  {announcementCount} Announcements
                </li>
              </ul>
            </div>

            <div className="announcement-card">
              <div className="announcement-icon">📢</div>
              <h3>Latest Announcement</h3>
              <p>Important Notice for Residents</p>
              <span>
                Please be informed that all residents are requested to update
                their emergency contact information in the RMS system.
              </span>
              <button type="button" className="primary-btn">
                Read More
              </button>
            </div>
          </aside>
        </div>
      </main>

      {selectedNotification && (
        <div className="notification-modal-backdrop" onClick={closeNotificationDetails}>
          <div className="notification-modal-card" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="modal-close-btn" onClick={closeNotificationDetails}>
              ×
            </button>
            <div className={`notification-icon ${selectedNotification.accent}`}>
              {selectedNotification.icon}
            </div>
            <p className="modal-eyebrow">{selectedNotification.category} Update</p>
            <h3>{selectedNotification.title}</h3>
            <p className="modal-message">{selectedNotification.message}</p>

            <div className="modal-details-grid">
              {selectedNotification.source && (
                <div>
                  <span>Source</span>
                  <strong>{selectedNotification.source}</strong>
                </div>
              )}
              {selectedNotification.recipient && (
                <div>
                  <span>Recipient</span>
                  <strong>{selectedNotification.recipient}</strong>
                </div>
              )}
              {selectedNotification.propertyName && (
                <div>
                  <span>Property</span>
                  <strong>{selectedNotification.propertyName}</strong>
                </div>
              )}
              {selectedNotification.buyer && (
                <div>
                  <span>Buyer</span>
                  <strong>{selectedNotification.buyer}</strong>
                </div>
              )}
              {selectedNotification.amount && (
                <div>
                  <span>Amount</span>
                  <strong>{selectedNotification.amount}</strong>
                </div>
              )}
              {selectedNotification.dueDate && (
                <div>
                  <span>Due Date</span>
                  <strong>{selectedNotification.dueDate}</strong>
                </div>
              )}
              {selectedNotification.saleDate && (
                <div>
                  <span>Sale Date</span>
                  <strong>{selectedNotification.saleDate}</strong>
                </div>
              )}
            </div>

            {(selectedNotification.notes || selectedNotification.time) && (
              <div className="modal-notes">
                <h4>Additional Details</h4>
                <p>{selectedNotification.notes || "This notification was created from the RMS system."}</p>
                <span>Received: {selectedNotification.time}</span>
              </div>
            )}
          </div>
        </div>
      )}
      </div>
    );
  } catch (renderErr) {
    // Log the error and render a friendly fallback so tests can continue
    // eslint-disable-next-line no-console
    console.error("NotificationsPage render error:", renderErr);
    pageContent = (
      <div className="notifications-page error-state">
        <div className="empty-state">
          <div className="empty-icon">⚠️</div>
          <h3>Unable to display notifications</h3>
          <p>There was an issue loading notifications. Please refresh the page or contact support.</p>
        </div>
      </div>
    );
  }

  return pageContent;
}

export default NotificationsPage;

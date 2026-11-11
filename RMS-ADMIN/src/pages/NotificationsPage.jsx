import './NotificationsPage.css';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import { getAdminImageUrl } from '../utils/adminImageUrl';

const normalizeNotification = (item, index) => ({
  ...item,
  id: item._id || item.id || `notif-${index + 1}`,
  _id: item._id || item.id || `notif-${index + 1}`,
  title: item.title || item.actionType || 'Notification',
  message: item.message || item.detail || '',
  detail: item.message || item.detail || '',
  read: item.isRead ?? item.read ?? false,
  time: item.time || (item.createdAt ? new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'),
});

function NotificationsPage({ appData, setAppData, notify }) {
  const notifications = appData.notifications || [];
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const summary = {
    total: notifications.length,
    unread: notifications.filter((item) => !(item.read ?? item.isRead ?? false)).length,
    responded: notifications.filter((item) => item.propertyType || item.entityType).length,
  };

  const filteredNotifications = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return notifications;
    return notifications.filter((item) => [
      item.title,
      item.message,
      item.detail,
      item.entityType,
      item.actionType,
      item.userName,
      item.actorName,
    ].filter(Boolean).join(' ').toLowerCase().includes(term));
  }, [notifications, search]);

  const groupedNotifications = useMemo(() => {
    return filteredNotifications.reduce((groups, item) => {
      const date = item.createdAt ? new Date(item.createdAt) : new Date();
      const key = Number.isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleDateString();
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
      return groups;
    }, {});
  }, [filteredNotifications]);

  useEffect(() => {
    const loadNotifications = async () => {
      try {
        const response = await apiService.request('/notifications/admin/all');
        if (response?.success) {
          const nextItems = (response.data || []).map(normalizeNotification);
          setAppData((prev) => ({
            ...prev,
            notifications: nextItems,
          }));
        }
      } catch (error) {
        console.warn('Unable to load notifications from backend:', error?.message || error);
      }
    };

    loadNotifications();
  }, [setAppData]);

  const markAllRead = async () => {
    try {
      await apiService.request('/notifications/mark-all-read', { method: 'POST' });
      setAppData((prev) => ({
        ...prev,
        notifications: (prev.notifications || []).map((item) => ({ ...item, read: true, isRead: true })),
      }));
      notify({ message: 'All notifications marked as read.', variant: 'success' });
    } catch (error) {
      console.error('Mark all notifications failed:', error);
      notify({ message: error.message || 'Unable to mark notifications as read.', variant: 'error' });
    }
  };

  const toggleRead = async (notificationId) => {
    try {
      await apiService.request(`/notifications/${notificationId}/read`, { method: 'POST' });
      setAppData((prev) => ({
        ...prev,
        notifications: (prev.notifications || []).map((item) =>
          (item.id === notificationId || item._id === notificationId) ? { ...item, read: true, isRead: true } : item,
        ),
      }));
    } catch (error) {
      console.error('Toggle notification read failed:', error);
      notify({ message: error.message || 'Unable to update notification status.', variant: 'error' });
    }
  };

  const deleteNotification = async (notificationId) => {
    try {
      await apiService.request(`/notifications/${notificationId}`, { method: 'DELETE' });
      setAppData((prev) => ({
        ...prev,
        notifications: (prev.notifications || []).filter((item) => item.id !== notificationId && item._id !== notificationId),
      }));
    } catch (error) {
      console.error('Delete notification failed:', error);
      notify({ message: error.message || 'Unable to delete notification.', variant: 'error' });
    }
  };

  const downloadAgreement = async (applicationId) => {
    try {
      await apiService.download(
        `/applications/${encodeURIComponent(applicationId)}/agreement`,
        `rental-agreement-${applicationId}.pdf`,
      );
    } catch (error) {
      console.error('Download rental agreement failed:', error);
      notify({ message: error.message || 'Unable to download rental agreement.', variant: 'error' });
    }
  };

  const handleRespond = (notification) => {
    const entityType = String(notification.entityType || notification.propertyType || '').toLowerCase();
    if (entityType === 'property' || entityType === 'properties') {
      navigate('/admin/properties');
      return;
    }
    if (entityType === 'booking' || entityType === 'bookings') {
      navigate('/admin/bookings');
      return;
    }
    if (entityType === 'payment' || entityType === 'payments') {
      navigate('/admin/payments');
      return;
    }
    if (entityType === 'user' || entityType === 'users') {
      navigate('/admin/users');
      return;
    }
    navigate('/admin/notifications');
  };

  return (
    <div className="page-section notifications-page">
      <div className="summary-card">
        <div className="summary-item highlight">
          <span>Total</span>
          <strong>{summary.total}</strong>
        </div>
        <div className="summary-item">
          <span>Unread</span>
          <strong>{summary.unread}</strong>
        </div>
        <div className="summary-item">
          <span>Actionable</span>
          <strong>{summary.responded}</strong>
        </div>
      </div>

      <section className="panel-card">
        <div className="card-header">
          <h3>All Notifications</h3>
          <div className="notification-actions">
            <input
              className="table-input"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search notifications"
              aria-label="Search notifications"
            />
            <button type="button" className="mini-button" onClick={markAllRead}>Mark All Read</button>
          </div>
        </div>
        <div className="list-stack large">
          {Object.entries(groupedNotifications).map(([date, items]) => (
            <div key={date}>
              <h4>{date}</h4>
              {items.map((notification) => (
                <div key={notification.id} className={`list-row ${notification.read ? 'read' : 'unread'}`}>
                  <div>
                    <strong>{notification.title}</strong>
                    <small>{notification.detail || notification.message}</small>
                    {notification.metadata?.email && (
                      <small>
                        {notification.metadata.email}
                        {notification.metadata.phone ? ` · ${notification.metadata.phone}` : ''}
                        {notification.metadata.rent ? ` · PKR ${Number(notification.metadata.rent).toLocaleString()}` : ''}
                      </small>
                    )}
                    {notification.metadata?.profileImage && (
                      <img src={getAdminImageUrl(notification.metadata.profileImage)} alt={`${notification.userName || 'User'} profile`} style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: '50%', marginTop: 8, marginRight: 8 }} />
                    )}
                    {notification.metadata?.cnicImage && (
                      <a href={getAdminImageUrl(notification.metadata.cnicImage)} target="_blank" rel="noreferrer">View CNIC</a>
                    )}
                    {notification.metadata?.rentalApplicationId && (
                      <div>
                        <small>Property: {notification.metadata.propertyName || notification.message}</small>
                        <button
                          type="button"
                          className="table-button light"
                          onClick={() => downloadAgreement(notification.metadata.rentalApplicationId)}
                        >
                          Download rental agreement
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="notification-actions">
                    <span className="time-tag">{notification.time || 'Just now'}</span>
                    <button type="button" className="table-button light" onClick={() => handleRespond(notification)}>
                      Respond
                    </button>
                    <button type="button" className="table-button light" onClick={() => toggleRead(notification.id)}>
                      {notification.read ? 'Read' : 'Mark Read'}
                    </button>
                    <button type="button" className="table-button light" onClick={() => deleteNotification(notification.id)}>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))}
          {!filteredNotifications.length && (
            <div className="empty-state">No notifications found.</div>
          )}
        </div>
      </section>
    </div>
  );
}

export default NotificationsPage;

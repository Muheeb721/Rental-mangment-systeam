import * as notificationService from '../services/notificationService.jsx';

const normalizeNotification = (it) => ({
  id: it._id || it.id || Date.now(),
  title: it.title || it.actionType || 'Notification',
  message: it.message || it.body || '',
  unread: it.isRead === true ? false : !(it.isRead === true),
  type: (it.entityType || it.actionType || 'system').toLowerCase(),
  category: it.entityType || it.actionType || 'General',
  createdAt: it.createdAt || new Date().toISOString(),
  time: it.createdAt || it.time || new Date().toISOString(),
  raw: it,
});

// Async API-backed methods
export const fetchNotifications = async () => {
  try {
    const res = await notificationService.fetchNotificationsFromServer();
    if (res && res.success) return res.data.map((d) => normalizeNotification(d.raw || d));
    return [];
  } catch (e) {
    console.error('fetchNotifications failed', e);
    return [];
  }
};

export const markAsRead = async (id) => {
  try {
    const res = await notificationService.markNotificationAsReadOnServer(id);
    return res && res.success ? res.data : null;
  } catch (e) {
    console.error('markAsRead failed', e);
    return null;
  }
};

export const markAllAsRead = async () => {
  try {
    const res = await notificationService.markAllNotificationsOnServer();
    return res && res.success;
  } catch (e) {
    console.error('markAllAsRead failed', e);
    return false;
  }
};

export const deleteNotification = async (id) => {
  try {
    const res = await notificationService.deleteNotificationOnServer(id);
    return res && res.success;
  } catch (e) {
    console.error('deleteNotification failed', e);
    return false;
  }
};

// Deprecated localStorage helpers (kept for compatibility but not source of truth)
// Deprecated localStorage helpers removed. Use API-backed notification methods in ../services/notificationService.jsx
export const readStoredNotifications = (fallback = []) => {
  try {
    const raw = window.localStorage.getItem('rms_notifications');
    if (!raw) {
      // persist the provided fallback so UI remains consistent across reloads
      try {
        window.localStorage.setItem('rms_notifications', JSON.stringify(fallback));
      } catch (e) {}
      return Array.isArray(fallback) ? fallback : [];
    }
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : Array.isArray(fallback) ? fallback : [];
  } catch (e) {
    console.warn('readStoredNotifications failed, returning fallback', e);
    return Array.isArray(fallback) ? fallback : [];
  }
};

export const saveStoredNotifications = (items = []) => {
  try {
    window.localStorage.setItem('rms_notifications', JSON.stringify(Array.isArray(items) ? items : []));
  } catch (e) {
    console.warn('saveStoredNotifications failed', e);
  }
};

export const addStoredNotification = async (note) => {
  try {
    const res = await notificationService.createNotificationOnServer(note);
    if (res && res.success && res.data) return { success: true, data: res.data };

    const local = notificationService.createNotification(note);
    return {
      success: false,
      message: res?.message || 'Notification was queued locally because the backend rejected it.',
      data: local,
    };
  } catch (e) {
    console.error('addStoredNotification failed', e);
    try {
      const local = notificationService.createNotification(note);
      return { success: false, message: 'Unable to sync notification to the server.', data: local };
    } catch (err) {
      return { success: false, message: 'Unable to sync notification to the server.', data: null };
    }
  }
};

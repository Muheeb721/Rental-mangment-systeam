import { useEffect, useMemo, useState } from 'react';
import { Badge } from 'antd';
import { LuBell } from 'react-icons/lu';
import { useDispatch, useSelector } from 'react-redux';
import { io } from 'socket.io-client';
import { toast } from 'react-toastify';
import NotificationDrawer from './NotificationDrawer';
import {
  markAllNotificationsAsRead,
  markNotificationAsRead,
  removeNotification,
  setNotifications,
} from '../../redux/store';
import {
  deleteNotificationOnServer,
  downloadRentalAgreement,
  fetchNotificationsFromServer,
  getUnreadCountFromServer,
  markAllNotificationsOnServer,
  markNotificationAsReadOnServer,
  readSessionUser,
} from '../../services/notificationService.jsx';

function NotificationBell() {
  const dispatch = useDispatch();
  const notifications = useSelector((state) => Array.isArray(state.auth?.notifications) ? state.auth.notifications : []);
  const [isOpen, setIsOpen] = useState(false);
  const [serverUnread, setServerUnread] = useState(null);
  const session = readSessionUser();
  const sessionKey = useMemo(
    () => `${session?.email || session?.id || session?.userId || ''}-${session?.role || 'user'}`,
    [session?.email, session?.id, session?.userId, session?.role],
  );
  const unreadCount = notifications.filter((item) => item.unread !== false).length;

  useEffect(() => {
    if (!sessionKey || sessionKey.startsWith('-')) {
      setServerUnread(null);
      return undefined;
    }

    let active = true;
    getUnreadCountFromServer().then((response) => {
      if (active && response?.success) setServerUnread(response.data?.count ?? 0);
    });
    return () => { active = false; };
  }, [sessionKey]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const sessionUser = readSessionUser();
    if (!sessionUser?.email && !sessionUser?.id && !sessionUser?.userId) {
      return undefined;
    }

    let active = true;
    const loadNotifications = async () => {
      const response = await fetchNotificationsFromServer();
      if (!active) return;
      if (!response?.success || !Array.isArray(response.data)) {
        toast.warn('Unable to load server notifications. Showing notifications already available in this session.');
        return;
      }

      dispatch(setNotifications(response.data));
      setServerUnread(response.data.filter((notification) => notification.unread !== false).length);
    };

    loadNotifications().catch((error) => {
      console.error('Unable to load notifications when opening the drawer', error);
      if (active) toast.warn('Unable to sync notifications from server.');
    });

    return () => { active = false; };
  }, [dispatch, isOpen]);

  useEffect(() => {
    const sessionUser = readSessionUser();
    const userId = sessionUser?.id || sessionUser?.userId;
    if (!userId) return undefined;

    // Same-origin by default (Vite proxies /socket.io in dev; production serves both from one origin).
    const socketUrl = import.meta.env.VITE_SOCKET_URL || window.location.origin;
    const socket = io(socketUrl, {
      autoConnect: true,
      withCredentials: true,
      transports: ['websocket', 'polling'],
      auth: {
        token: window.__RMS_AUTH_TOKEN || window.localStorage.getItem('rms_token') || window.__rms_inmemory_token || '',
        userId,
        role: sessionUser.role || 'user',
      },
    });

    socket.emit('join-user', {
      userId,
      userRole: sessionUser.role || 'user',
    });
    socket.on('notification:new', async () => {
      const response = await getUnreadCountFromServer();
      if (response?.success) setServerUnread(response.data?.count ?? 0);
      if (isOpen) {
        const latest = await fetchNotificationsFromServer();
        if (latest?.success && Array.isArray(latest.data)) dispatch(setNotifications(latest.data));
      }
    });

    return () => socket.disconnect();
  }, [dispatch, isOpen, sessionKey]);

  const handleMarkRead = async (id) => {
    const response = await markNotificationAsReadOnServer(id);
    if (!response?.success) {
      toast.warn('Unable to mark this notification as read on the server.');
      return;
    }

    dispatch(markNotificationAsRead(id));
    setServerUnread((current) => current === null ? current : Math.max(0, current - 1));
  };

  const handleMarkAllRead = async () => {
    const response = await markAllNotificationsOnServer();
    if (!response?.success) {
      toast.warn('Unable to mark notifications as read on the server.');
      return;
    }

    dispatch(markAllNotificationsAsRead());
    setServerUnread(0);
  };

  const handleDelete = async (id) => {
    const response = await deleteNotificationOnServer(id);
    if (!response?.success) {
      toast.warn('Unable to delete this notification on the server.');
      return;
    }

    dispatch(removeNotification(id));
  };

  const handleDownloadAgreement = async (applicationId) => {
    try {
      await downloadRentalAgreement(applicationId);
    } catch (error) {
      console.error('Unable to download rental agreement:', error);
      toast.warn('Unable to download the rental agreement.');
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setIsOpen((previous) => !previous)}
        className="r-btn r-btn--ghost r-btn--icon"
        aria-label="Open notifications"
        aria-expanded={isOpen}
      >
        <Badge count={serverUnread ?? unreadCount} size="small" overflowCount={9} color="#c2410c">
          <LuBell size={19} />
        </Badge>
      </button>

      <NotificationDrawer
        open={isOpen}
        onClose={() => setIsOpen(false)}
        notifications={notifications}
        onMarkRead={handleMarkRead}
        onMarkAllRead={handleMarkAllRead}
        onDelete={handleDelete}
        onDownloadAgreement={handleDownloadAgreement}
      />
    </div>
  );
}

export default NotificationBell;

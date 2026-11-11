import { useEffect } from 'react';
import {
  BellOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import './NotificationDrawer.css';

function NotificationDrawer({
  open,
  onClose,
  notifications = [],
  onMarkRead,
  onMarkAllRead,
  onDelete,
  onDownloadAgreement,
}) {
  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  const unreadCount = notifications.filter((item) => item.unread !== false).length;

  const getTypeMeta = (type) => {
    switch (type) {
      case 'maintenance':
        return { icon: <ExclamationCircleOutlined />, color: 'maintenance' };
      case 'rent':
        return { icon: <CheckCircleOutlined />, color: 'rent' };
      case 'system':
        return { icon: <InfoCircleOutlined />, color: 'system' };
      default:
        return { icon: <BellOutlined />, color: 'default' };
    }
  };

  return (
    <>
      <div
        className="rms-notification-overlay"
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className="rms-notification-drawer"
        aria-label="Notifications drawer"
      >
        <div className="rms-notification-drawer__header">
          <div className="rms-notification-drawer__heading">
            <div className="rms-notification-drawer__bell">
              <BellOutlined />
            </div>

            <div>
              <h3>Notifications</h3>
              <p>{unreadCount} unread</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rms-notification-drawer__close"
          >
            Close <CloseOutlined />
          </button>
        </div>

        <div className="rms-notification-drawer__content">
          {notifications.length === 0 ? (
            <div className="rms-notification-drawer__empty">
              No notifications yet.
            </div>
          ) : (
            <div className="rms-notification-drawer__list">
              {notifications.map((notification) => {
                const isUnread = notification.unread !== false;
                const meta = getTypeMeta(notification.type);

                return (
                  <div
                    key={notification.id || `${notification.title}-${notification.createdAt}`}
                    className={`rms-notification-card ${isUnread ? 'is-unread' : ''}`}
                  >
                    <div className="rms-notification-card__main">
                      <div className="rms-notification-card__icon">
                        <span className={`rms-notification-card__icon-type ${meta.color}`}>
                          {meta.icon}
                        </span>
                      </div>

                      <div className="rms-notification-card__body">
                        <div className="rms-notification-card__title">
                          <p>{notification.title || 'New update'}</p>
                          {isUnread && (
                            <span className="rms-notification-card__new">New</span>
                          )}
                        </div>

                        <p className="rms-notification-card__message">
                          {notification.message || notification.body || 'No details available.'}
                        </p>
                        {notification.agreementApplicationId && (
                          <button
                            type="button"
                            onClick={() => onDownloadAgreement?.(notification.agreementApplicationId)}
                            className="rms-notification-card__agreement"
                          >
                            Download rental agreement
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="rms-notification-card__footer">
                      <div className="rms-notification-card__time">
                        <ClockCircleOutlined />
                        {notification.createdAt ? new Date(notification.createdAt).toLocaleString() : 'Just now'}
                      </div>

                      <div className="rms-notification-card__actions">
                        {isUnread && (
                          <button
                            type="button"
                            onClick={() => onMarkRead?.(notification.id)}
                            className="rms-notification-card__action"
                          >
                            Mark read
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => onDelete?.(notification.id)}
                          className="rms-notification-card__action"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rms-notification-drawer__footer">
          <button
            type="button"
            onClick={onMarkAllRead}
            className="rms-notification-drawer__mark-all"
          >
            Mark all as read
          </button>
        </div>
      </aside>
    </>
  );
}

export default NotificationDrawer;

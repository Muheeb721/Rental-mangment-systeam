import { Button } from 'antd';
import { useNavigate } from 'react-router-dom';
import NotificationItem from './NotificationItem';

function NotificationPanel({ notifications, onMarkRead, onDelete, onMarkAllRead, onClear, onClose }) {
  const navigate = useNavigate();
  const unreadCount = notifications.filter((item) => item.unread).length;

  return (
    <div
      style={{
        position: 'absolute',
        top: 'calc(100% + 10px)',
        right: 0,
        width: 'min(360px, calc(100vw - 24px))',
        maxWidth: 'calc(100vw - 24px)',
        background: '#fff',
        border: '1px solid #e7ebf2',
        borderRadius: 20,
        boxShadow: '0 24px 60px rgba(11, 36, 80, 0.12)',
        overflow: 'hidden',
        zIndex: 1200,
      }}
    >
      <div style={{ padding: '14px 16px', borderBottom: '1px solid #eef2f7', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 800, color: '#102a56' }}>Notifications</div>
          <div style={{ fontSize: 12, color: '#64809b' }}>{unreadCount} unread</div>
        </div>
        <Button type="text" onClick={onClose}>Close</Button>
      </div>

      <div style={{ padding: 12, display: 'grid', gap: 10, maxHeight: 'min(360px, 56vh)', overflowY: 'auto' }}>
        {notifications.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#64809b', borderRadius: 16, background: '#f8fbff' }}>
            No notifications yet.
          </div>
        ) : (
          notifications.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onMarkRead={onMarkRead}
              onDelete={onDelete}
            />
          ))
        )}
      </div>

      <div style={{ padding: '12px 16px', borderTop: '1px solid #eef2f7', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <Button size="small" onClick={onMarkAllRead}>Mark all read</Button>
        <Button size="small" danger onClick={onClear}>Clear all</Button>
        <Button size="small" type="link" onClick={() => { onClose(); navigate('/notifications'); }}>View full panel</Button>
      </div>
    </div>
  );
}

export default NotificationPanel;

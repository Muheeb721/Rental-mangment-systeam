import { Button } from 'antd';

function NotificationItem({ notification, onMarkRead, onDelete }) {
  return (
    <div
      className={`notification-item ${notification.unread ? 'unread' : ''}`}
      style={{
        padding: '14px 12px',
        borderRadius: 16,
        background: notification.unread ? '#f7fcf9' : '#fff',
        border: notification.unread ? '1px solid rgba(40, 180, 99, 0.2)' : '1px solid #e7ebf2',
        display: 'grid',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>{notification.icon}</span>
          <div>
            <div style={{ fontWeight: 700, color: '#102a56' }}>{notification.title}</div>
            <div style={{ fontSize: 12, color: '#64809b' }}>{notification.typeLabel}</div>
          </div>
        </div>
        {notification.unread ? (
          <span style={{ padding: '4px 8px', borderRadius: 999, background: '#eaf8f0', color: '#28b463', fontSize: 11, fontWeight: 700 }}>New</span>
        ) : null}
      </div>

      <div style={{ color: '#475569', fontSize: 13, lineHeight: 1.6 }}>{notification.message}</div>

      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, fontSize: 12, color: '#64809b' }}>
        <span>{notification.userName || 'RMS Admin'}</span>
        <span>{notification.time}</span>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {notification.unread ? (
          <Button size="small" type="primary" style={{ width: 'fit-content' }} onClick={() => onMarkRead(notification.id)}>
            Mark read
          </Button>
        ) : null}
        <Button size="small" danger onClick={() => onDelete(notification.id)}>
          Delete
        </Button>
      </div>
    </div>
  );
}

export default NotificationItem;

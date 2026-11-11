import { useMemo, useState } from 'react';

const FILTERS = ['all', 'unread', 'read'];

function Notifications({ notifications = [] }) {
  const [filter, setFilter] = useState('all');

  const visibleNotifications = useMemo(() => {
    if (!Array.isArray(notifications)) return [];

    return notifications.filter((item) => {
      if (filter === 'unread') return item.unread !== false;
      if (filter === 'read') return item.unread === false;
      return true;
    });
  }, [filter, notifications]);

  return (
    <div style={{ background: '#fff', borderRadius: 18, padding: 24, boxShadow: '0 12px 30px rgba(15, 23, 42, 0.05)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 30 }}>Notifications</h2>
          <p style={{ margin: '6px 0 0', color: '#667085' }}>Track account, payment, and property updates.</p>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {FILTERS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              style={{
                border: 'none',
                background: filter === value ? '#123a70' : '#eef3fa',
                color: filter === value ? '#fff' : '#1f2937',
                borderRadius: 999,
                padding: '8px 12px',
                fontWeight: 600,
                cursor: 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        {visibleNotifications.length === 0 ? (
          <div style={{ background: '#f8fafc', borderRadius: 12, padding: 18, color: '#475467' }}>
            No notifications in this category.
          </div>
        ) : (
          visibleNotifications.map((item) => (
            <div
              key={item.id || item._id || `${item.title}-${Math.random()}`}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 12,
                background: item.unread === false ? '#f8fafc' : '#fff',
                border: item.unread === false ? '1px solid #e2e8f0' : '1px solid #dbeafe',
                borderRadius: 12,
                padding: 16,
              }}
            >
              <div>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>{item.title || 'New update'}</div>
                <div style={{ color: '#475467', lineHeight: 1.6 }}>{item.message || item.body || 'No details available.'}</div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                <span
                  style={{
                    background: item.unread === false ? '#e2e8f0' : '#dbeafe',
                    color: item.unread === false ? '#334155' : '#1d4ed8',
                    borderRadius: 999,
                    padding: '4px 8px',
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {item.unread === false ? 'Read' : 'Unread'}
                </span>
                <span style={{ color: '#94a3b8', fontSize: 12 }}>
                  {item.createdAt ? new Date(item.createdAt).toLocaleString() : 'Just now'}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default Notifications;

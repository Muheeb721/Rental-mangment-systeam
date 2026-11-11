import { useMemo, useState } from 'react';
import { apiService } from '../services/api';
import './AnnouncementsPage.css';

function AnnouncementsPage({ appState, setAppState, notify }) {
  const notificationFeed = appState?.notifications || [];

  const announcements = useMemo(() => {
    const directAnnouncements = (appState?.announcements || []).map((item, index) => ({
      id: item.id || item._id || `announcement-${index}`,
      title: item.title || 'Announcement',
      audience: item.audience || 'All occupants',
      priority: item.priority || item.status || 'Medium',
      content: item.content || item.message || '',
      createdAt: item.createdAt || new Date().toISOString(),
      createdCount: item.createdCount || 1,
    }));

    const liveAnnouncements = notificationFeed
      .filter((item) => item?.actionType === 'ANNOUNCEMENT' || item?.entityType === 'GENERAL' || /announcement/i.test(item?.title || item?.message || ''))
      .map((item, index) => ({
        id: item.id || item._id || `live-announcement-${index}`,
        title: item.title || 'Announcement',
        audience: item.audience || 'All occupants',
        priority: item.priority || item.status || 'Medium',
        content: item.message || item.content || '',
        createdAt: item.createdAt || item.date || new Date().toISOString(),
        createdCount: item.createdCount || 1,
      }));

    return [...directAnnouncements, ...liveAnnouncements]
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 10);
  }, [appState?.announcements, notificationFeed]);

  const summary = useMemo(() => {
    const counts = announcements.reduce((acc, item) => {
      acc.total += 1;
      acc.recipients += Number(item.createdCount || 0);
      if (String(item.priority || '').toLowerCase() === 'high') acc.highPriority += 1;
      if (String(item.audience || '').toLowerCase().includes('tenant')) acc.tenants += 1;
      if (String(item.audience || '').toLowerCase().includes('landlord')) acc.landlords += 1;
      return acc;
    }, { total: 0, recipients: 0, highPriority: 0, tenants: 0, landlords: 0 });

    return {
      total: counts.total,
      recipients: counts.recipients,
      highPriority: counts.highPriority,
      audiences: new Set(announcements.map((item) => item.audience || 'All occupants')).size,
      tenants: counts.tenants,
      landlords: counts.landlords,
    };
  }, [announcements]);

  const [form, setForm] = useState({
    title: '',
    audience: 'All occupants',
    priority: 'Medium',
    content: '',
  });

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.title.trim() || !form.content.trim()) {
      notify?.({ message: 'Please add a title and announcement text.', variant: 'error' });
      return;
    }

    try {
      const payloadBase = {
        actorType: 'admin',
        actorName: appState?.profile?.fullName || appState?.admin?.name || appState?.admin?.fullName || 'Admin',
        actionType: 'ANNOUNCEMENT',
        entityType: 'GENERAL',
        title: form.title.trim(),
        message: form.content.trim(),
        status: form.priority || 'Medium',
        audience: form.audience,
      };

      let recipients = [];
      const usersResponse = await apiService.request('/admin/users');
      if (!usersResponse?.success) {
        throw new Error(usersResponse?.message || 'Unable to load announcement recipients.');
      }
      const allUsers = usersResponse?.data || [];

      if (form.audience === 'All occupants') {
        recipients = allUsers;
      } else if (form.audience === 'Tenants') {
        recipients = allUsers.filter((user) => ['tenant', 'resident'].includes(String(user.role || '').toLowerCase()));
      } else if (form.audience === 'Landlords') {
        recipients = allUsers.filter((user) => ['landlord', 'owner'].includes(String(user.role || '').toLowerCase()));
      }
      if (!recipients.length) throw new Error('No recipients were found for this audience.');

      const created = [];
      let failedCount = 0;
      for (const user of recipients) {
        const userId = user?._id || user?.id;
        if (!userId) {
          failedCount += 1;
          continue;
        }
        try {
          const note = await apiService.request('/notifications/create', {
            method: 'POST',
            body: {
              ...payloadBase,
              userId,
              userName: user.name || user.email || 'User',
            },
          });
          if (note?.success && note.data) created.push(note.data);
          else failedCount += 1;
        } catch (err) {
          console.warn('Failed to create announcement notification', userId, err);
          failedCount += 1;
        }
      }
      if (!created.length) throw new Error('Announcement was not delivered to any recipients.');

      const announcement = {
        id: Date.now(),
        title: form.title.trim(),
        audience: form.audience,
        priority: form.priority || 'Medium',
        content: form.content.trim(),
        createdCount: created.length,
        createdAt: new Date().toISOString(),
      };

      setAppState((prev) => ({
        ...prev,
        announcements: [announcement, ...(prev.announcements || [])],
        notifications: [
          ...created.map((item) => ({
            ...item,
            title: announcement.title,
            message: announcement.content,
            audience: announcement.audience,
            status: announcement.priority,
            priority: announcement.priority,
            actionType: 'ANNOUNCEMENT',
            entityType: 'GENERAL',
          })),
          ...(prev.notifications || []),
        ].slice(0, 30),
      }));

      notify?.({
        message: failedCount
          ? `Announcement sent to ${created.length} recipient(s); ${failedCount} failed.`
          : `Announcement sent to ${created.length} recipient(s).`,
        variant: failedCount ? 'warning' : 'success',
      });
      setForm({ title: '', audience: 'All occupants', priority: 'Medium', content: '' });
    } catch (error) {
      console.error('Announcement publish failed', error);
      notify?.({ message: error?.message || 'Unable to publish announcement.', variant: 'error' });
    }
  };

  return (
    <div className="page-section announcements-page">
      <div className="summary-strip">
        <div className="summary-item primary">
          <span>Total broadcasts</span>
          <strong>{summary.total}</strong>
        </div>
        <div className="summary-item success">
          <span>Recipients reached</span>
          <strong>{summary.recipients}</strong>
        </div>
        <div className="summary-item danger">
          <span>High priority</span>
          <strong>{summary.highPriority}</strong>
        </div>
        <div className="summary-item info">
          <span>Audience groups</span>
          <strong>{summary.audiences}</strong>
        </div>
      </div>

      <div className="content-grid two-column">
        <section className="panel-card announcement-composer">
          <div className="card-header">
            <div>
              <p className="eyebrow">Communication</p>
              <h3>Create announcement</h3>
            </div>
            <span className="mini-badge">Live send</span>
          </div>

          <form onSubmit={handleSubmit} className="property-form">
            <label>
              Title
              <input value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} />
            </label>
            <label>
              Audience
              <select value={form.audience} onChange={(e) => setForm((prev) => ({ ...prev, audience: e.target.value }))}>
                <option value="All occupants">All occupants</option>
                <option value="Tenants">Tenants</option>
                <option value="Landlords">Landlords</option>
              </select>
            </label>
            <label>
              Priority
              <select value={form.priority} onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value }))}>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </label>
            <label>
              Content
              <textarea value={form.content} rows="5" onChange={(e) => setForm((prev) => ({ ...prev, content: e.target.value }))} />
            </label>
            <button type="submit" className="primary-button">Publish announcement</button>
          </form>
        </section>

        <section className="panel-card announcement-feed">
          <div className="card-header">
            <div>
              <p className="eyebrow">Broadcasts</p>
              <h3>Recent announcements</h3>
            </div>
            <span className="mini-badge">{announcements.length} active</span>
          </div>

          <div className="list-stack large">
            {announcements.length === 0 ? (
              <div className="empty-state">No announcements yet.</div>
            ) : announcements.map((item) => (
              <article key={item.id} className="list-row announcement-row">
                <div className="announcement-copy">
                  <div className="announcement-meta">
                    <strong>{item.title}</strong>
                    <span className={`status-badge ${String(item.priority || 'medium').toLowerCase()}`}>{item.priority || 'Medium'}</span>
                  </div>
                  <small>{item.audience || 'All occupants'} · {new Date(item.createdAt).toLocaleString()}</small>
                  <p>{item.content || item.message || 'Announcement details not available.'}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export default AnnouncementsPage;

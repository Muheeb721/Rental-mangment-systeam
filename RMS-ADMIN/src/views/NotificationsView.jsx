import { useMemo, useState } from 'react';
import { Bell, CheckCheck, Megaphone, Send, Trash2, Undo2 } from 'lucide-react';
import { api } from '../lib/api';
import { dateTime, timeAgo, titleCase } from '../lib/format';
import {
  Badge, Button, EmptyState, ErrorState, Field, IconButton, LoadingBlock, PageHeader, Tabs, useAsync, useConfirm, useToast,
} from '../components/ui';

const changed = () => window.dispatchEvent(new Event('rms-admin:notifications-changed'));

function Inbox() {
  const toast = useToast();
  const [filter, setFilter] = useState('unread');
  const { data, loading, error, reload, setData } = useAsync(() => api.get('/notifications/admin/all').then((r) => r.data), []);
  const all = useMemo(() => data || [], [data]);
  const items = filter === 'unread' ? all.filter((n) => !n.isRead) : all;

  const markRead = async (note) => {
    try {
      await api.post(`/notifications/${note._id}/read`);
      setData((prev) => prev.map((n) => (n._id === note._id ? { ...n, isRead: true } : n)));
      changed();
    } catch (err) { toast.error(err.message); }
  };
  const markAll = async () => {
    try {
      await api.post('/notifications/mark-all-read');
      setData((prev) => prev.map((n) => ({ ...n, isRead: true })));
      toast.success('All notifications marked as read.');
      changed();
    } catch (err) { toast.error(err.message); }
  };
  const remove = async (note) => {
    try {
      await api.del(`/notifications/${note._id}`);
      setData((prev) => prev.filter((n) => n._id !== note._id));
      changed();
    } catch (err) { toast.error(err.message); }
  };

  return (
    <div className="card">
      <div className="toolbar">
        <div className="segmented">
          <button type="button" className={filter === 'unread' ? 'active' : ''} onClick={() => setFilter('unread')}>Unread ({all.filter((n) => !n.isRead).length})</button>
          <button type="button" className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>All ({all.length})</button>
        </div>
        <div className="toolbar-spacer" />
        <Button icon={CheckCheck} onClick={markAll} disabled={!all.some((n) => !n.isRead)}>Mark all read</Button>
      </div>
      {loading && !data ? <LoadingBlock /> : error ? <ErrorState message={error} onRetry={reload} /> : items.length === 0 ? (
        <EmptyState icon={Bell} title={filter === 'unread' ? 'No unread notifications' : 'No notifications'} message="New bookings, payments, messages and maintenance requests show up here." />
      ) : (
        <div className="list">
          {items.map((note) => (
            <div key={note._id} className={`list-item ${note.isRead ? '' : 'unread'}`}>
              <div className={`list-icon tone-${note.isRead ? 'gray' : 'blue'}`}><Bell size={16} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="row spread"><strong>{note.title}</strong><span className="small muted nowrap">{timeAgo(note.createdAt)}</span></div>
                <div className="muted">{note.message}</div>
                <div className="row mt-8"><Badge dot={false} tone="gray">{titleCase(String(note.entityType || note.type || '').toLowerCase())}</Badge></div>
              </div>
              <div className="actions row" style={{ gap: 0 }}>
                {!note.isRead && <IconButton icon={CheckCheck} label="Mark as read" onClick={() => markRead(note)} />}
                <IconButton icon={Trash2} label="Delete" danger onClick={() => remove(note)} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Announcements() {
  const toast = useToast();
  const confirm = useConfirm();
  const [form, setForm] = useState({ title: '', message: '', audience: 'all', userId: '' });
  const [errors, setErrors] = useState({});
  const [sending, setSending] = useState(false);
  const { data, loading, error, reload, setData } = useAsync(() => Promise.all([api.get('/notifications/admin/broadcasts'), api.get('/admin/users', { limit: 1000 })]).then(([b, u]) => ({ broadcasts: b.data, users: u.data })), []);
  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const send = async (event) => {
    event.preventDefault();
    const nextErrors = {};
    if (form.title.trim().length < 3) nextErrors.title = 'At least 3 characters.';
    if (form.message.trim().length < 5) nextErrors.message = 'At least 5 characters.';
    if (form.audience === 'user' && !form.userId) nextErrors.userId = 'Choose a user.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setSending(true);
    try {
      const response = await api.post('/notifications/broadcast', form);
      toast.success(response.message);
      setForm({ title: '', message: '', audience: 'all', userId: '' });
      reload();
    } catch (err) { toast.error(err.message); } finally { setSending(false); }
  };

  const withdraw = async (broadcast) => {
    const ok = await confirm({ title: 'Withdraw announcement?', message: `"${broadcast.title}" will be removed from ${broadcast.recipients} inbox(es).`, confirmLabel: 'Withdraw' });
    if (!ok) return;
    try {
      await api.del(`/notifications/admin/broadcasts/${broadcast.id}`);
      setData((prev) => ({ ...prev, broadcasts: prev.broadcasts.filter((b) => b.id !== broadcast.id) }));
      toast.success('Announcement withdrawn.');
    } catch (err) { toast.error(err.message); }
  };

  const audienceLabel = { all: 'All users', resident: 'Residents', owner: 'Owners', user: 'One user' };
  return (
    <div className="grid grid-wide-alt">
      <div className="card">
        <div className="card-header"><h2>Sent announcements</h2></div>
        {loading && !data ? <LoadingBlock /> : error ? <ErrorState message={error} onRetry={reload} /> : !data.broadcasts.length ? (
          <EmptyState icon={Megaphone} title="No announcements yet" message="Announcements appear in users' notification bell on the website." />
        ) : (
          <div className="list">
            {data.broadcasts.map((b) => (
              <div key={b.id} className="list-item">
                <div className="list-icon tone-violet"><Megaphone size={16} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row spread"><strong>{b.title}</strong><span className="small muted nowrap">{dateTime(b.createdAt)}</span></div>
                  <div className="muted">{b.message}</div>
                  <div className="row mt-8 small muted">
                    <Badge dot={false} tone="gray">{audienceLabel[b.audience] || b.audience}</Badge>
                    {b.recipients} recipient{b.recipients === 1 ? '' : 's'} · {b.read} read
                  </div>
                </div>
                <IconButton icon={Undo2} label="Withdraw" danger onClick={() => withdraw(b)} />
              </div>
            ))}
          </div>
        )}
      </div>
      <form className="card" onSubmit={send} noValidate style={{ alignSelf: 'start' }}>
        <div className="card-header"><h2>New announcement</h2></div>
        <div className="card-body stack">
          <Field label="Send to">
            <select className="select" value={form.audience} onChange={set('audience')}>
              <option value="all">All users</option><option value="resident">Residents / tenants</option><option value="owner">Owners / landlords</option><option value="user">A specific user</option>
            </select>
          </Field>
          {form.audience === 'user' && (
            <Field label="User" required error={errors.userId}>
              <select className={`select ${errors.userId ? 'invalid' : ''}`} value={form.userId} onChange={set('userId')}>
                <option value="">Select…</option>
                {(data?.users || []).filter((u) => u.role !== 'admin').map((u) => <option key={u._id} value={u._id}>{u.name} ({u.email})</option>)}
              </select>
            </Field>
          )}
          <Field label="Title" required error={errors.title}><input className={`input ${errors.title ? 'invalid' : ''}`} value={form.title} onChange={set('title')} placeholder="e.g. Water supply interruption" maxLength={150} /></Field>
          <Field label="Message" required error={errors.message}><textarea className={`textarea ${errors.message ? 'invalid' : ''}`} rows={5} value={form.message} onChange={set('message')} placeholder="Write the announcement…" maxLength={2000} /></Field>
          <Button type="submit" variant="primary" icon={Send} loading={sending}>Send announcement</Button>
        </div>
      </form>
    </div>
  );
}

export default function NotificationsView() {
  const [tab, setTab] = useState('inbox');
  return (
    <>
      <PageHeader title="Notifications" description="Your admin inbox and announcements sent to users." />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'inbox', label: 'Inbox' }, { value: 'announcements', label: 'Announcements' }]} />
      {tab === 'inbox' ? <Inbox /> : <Announcements />}
    </>
  );
}

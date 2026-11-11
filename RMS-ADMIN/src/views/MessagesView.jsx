import { useMemo, useState } from 'react';
import { Mail, MessageSquareReply, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { dateTime, matches, timeAgo } from '../lib/format';
import {
  Badge, Button, DataTable, DetailList, EmptyState, ErrorState, Field, IconButton, LoadingBlock, Modal, PageHeader, SearchInput, Tabs,
  useAsync, useConfirm, useToast,
} from '../components/ui';

const STATUSES = ['New', 'In Progress', 'Resolved', 'Closed'];
const bump = () => window.dispatchEvent(new Event('rms-admin:counts-changed'));

function MessageModal({ message, onClose, onSaved }) {
  const toast = useToast();
  const [status, setStatus] = useState(message.status === 'New' ? 'In Progress' : message.status);
  const [reply, setReply] = useState(message.adminReply || '');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      const body = { status };
      if (reply.trim() && reply.trim() !== message.adminReply) body.adminReply = reply.trim();
      const response = await api.put(`/contact/${message._id}`, body);
      toast.success(body.adminReply && message.userId ? 'Reply saved and sent to the user\'s notifications.' : 'Message updated.');
      onSaved(response.data);
      bump();
    } catch (err) { toast.error(err.message); } finally { setSaving(false); }
  };
  return (
    <Modal open size="lg" title={message.inquiryType || 'Message'} onClose={onClose} busy={saving}
      footer={<><Button onClick={onClose} disabled={saving}>Close</Button><Button variant="primary" icon={MessageSquareReply} loading={saving} onClick={save}>Save</Button></>}>
      <DetailList items={[
        ['From', message.fullName || message.name], ['Email', <a key="e" href={`mailto:${message.email}`}>{message.email}</a>], ['Phone', message.phone ? <a key="p" href={`tel:${message.phone}`}>{message.phone}</a> : ''],
        ['Property', message.propertyTitle || message.propertyName], ['Received', dateTime(message.createdAt)], ['Registered user', message.userId ? 'Yes' : 'No (visitor)'],
      ]} />
      <div className="section-title">Message</div>
      <p style={{ whiteSpace: 'pre-wrap', background: 'var(--surface-2)', padding: 14, borderRadius: 10 }}>{message.message}</p>
      <div className="section-title">Response</div>
      <div className="form-grid">
        <Field label="Status"><select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></Field>
        <div />
        <Field label="Reply / internal note" className="span-2" hint={message.userId ? 'Registered users receive this reply as a notification.' : 'Visitor messages: reply by email or phone; this note is stored for your team.'}>
          <textarea className="textarea" rows={4} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Write your reply…" />
        </Field>
      </div>
    </Modal>
  );
}

export default function MessagesView() {
  const toast = useToast();
  const confirm = useConfirm();
  const [tab, setTab] = useState('New');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(null);
  const { data, loading, error, reload, setData } = useAsync(() => api.get('/contact').then((r) => r.data), []);
  const all = useMemo(() => data || [], [data]);
  const rows = useMemo(() => all.filter((m) => (tab === 'all' || (m.status || 'New') === tab) && matches(m, search, ['fullName', 'name', 'email', 'phone', 'message', 'propertyName'])), [all, tab, search]);

  const remove = async (message) => {
    const ok = await confirm({ title: 'Delete message?', message: 'This message will be removed permanently.', confirmLabel: 'Delete' });
    if (!ok) return;
    try {
      await api.del(`/contact/${message._id}`);
      setData((prev) => prev.filter((m) => m._id !== message._id));
      toast.success('Message deleted.');
      bump();
    } catch (err) { toast.error(err.message); }
  };

  const columns = [
    { key: 'from', header: 'From', primary: true, render: (m) => <div><div className="cell-main">{m.fullName || m.name || '—'}</div><div className="cell-sub">{m.email}{m.phone && ` · ${m.phone}`}</div></div> },
    { key: 'message', header: 'Message', render: (m) => <div style={{ maxWidth: 380 }}><div className="small strong">{m.inquiryType}{m.propertyName && ` · ${m.propertyName}`}</div><div className="truncate muted small">{m.message}</div></div> },
    { key: 'status', header: 'Status', render: (m) => <Badge>{m.status || 'New'}</Badge> },
    { key: 'received', header: 'Received', render: (m) => <span className="nowrap">{timeAgo(m.createdAt)}</span> },
    { key: 'actions', header: '', className: 'num', render: (m) => (
      <div className="actions">
        <IconButton icon={MessageSquareReply} label="Open & reply" onClick={() => setOpen(m)} />
        <IconButton icon={Trash2} label="Delete" danger onClick={() => remove(m)} />
      </div>
    ) },
  ];

  return (
    <>
      <PageHeader title="Messages" description="Contact form submissions and property enquiries from the website." />
      <Tabs value={tab} onChange={setTab} tabs={[...STATUSES.map((s) => ({ value: s, label: s, count: all.filter((m) => (m.status || 'New') === s).length })), { value: 'all', label: 'All', count: all.length }]} />
      <div className="card">
        <div className="toolbar"><SearchInput value={search} onChange={setSearch} placeholder="Search name, email, message…" /></div>
        {loading && !data ? <LoadingBlock /> : error ? <ErrorState message={error} onRetry={reload} /> : (
          <DataTable columns={columns} rows={rows} resetKey={`${tab}|${search}`} onRowClick={undefined} empty={<EmptyState icon={Mail} title="No messages" message="Messages sent from the Contact page appear here." />} />
        )}
      </div>
      {open && <MessageModal message={open} onClose={() => setOpen(null)} onSaved={(saved) => { setData((prev) => prev.map((m) => (m._id === saved._id ? saved : m))); setOpen(null); }} />}
    </>
  );
}

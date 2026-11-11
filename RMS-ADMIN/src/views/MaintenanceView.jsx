import { useMemo, useState } from 'react';
import { Eye, Trash2, Wrench } from 'lucide-react';
import { api } from '../lib/api';
import { dateTime, matches, timeAgo } from '../lib/format';
import {
  Badge, Button, DataTable, DetailList, EmptyState, ErrorState, Field, IconButton, LoadingBlock, Modal, PageHeader, SearchInput, Select, Tabs,
  useAsync, useConfirm, useToast,
} from '../components/ui';

const STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed', 'Rejected'];
const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];
const bump = () => window.dispatchEvent(new Event('rms-admin:counts-changed'));

function ManageModal({ request, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ status: request.status, priority: request.priority, adminNotes: request.adminNotes || '' });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      const response = await api.patch(`/maintenance/${request._id}`, form);
      toast.success(form.status !== request.status ? `Status changed to ${form.status}; the tenant was notified.` : 'Request updated.');
      onSaved(response.data);
      bump();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal open size="lg" title={request.title} onClose={onClose} busy={saving}
      footer={<><Button onClick={onClose} disabled={saving}>Cancel</Button><Button variant="primary" loading={saving} onClick={save}>Save</Button></>}>
      <DetailList items={[
        ['Reported by', request.userName], ['Property', request.propertyName], ['Category', request.category],
        ['Submitted', dateTime(request.createdAt)], ['Last update', dateTime(request.updatedAt)],
      ]} />
      <div className="section-title">Description</div>
      <p style={{ whiteSpace: 'pre-wrap' }}>{request.description}</p>
      <div className="section-title">Manage</div>
      <div className="form-grid">
        <Field label="Status"><select className="select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Priority"><select className="select" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>{PRIORITIES.map((p) => <option key={p}>{p}</option>)}</select></Field>
        <Field label="Note to tenant" className="span-2" hint="Included in the notification when the status changes.">
          <textarea className="textarea" rows={3} value={form.adminNotes} onChange={(e) => setForm({ ...form, adminNotes: e.target.value })} placeholder="e.g. Plumber will visit on Saturday between 10am and 12pm." />
        </Field>
      </div>
    </Modal>
  );
}

export default function MaintenanceView() {
  const toast = useToast();
  const confirm = useConfirm();
  const [tab, setTab] = useState('active');
  const [priority, setPriority] = useState('all');
  const [search, setSearch] = useState('');
  const [managing, setManaging] = useState(null);
  const { data, loading, error, reload, setData } = useAsync(() => api.get('/maintenance/all').then((r) => r.data), []);
  const all = useMemo(() => data || [], [data]);
  const isActive = (r) => ['Open', 'In Progress'].includes(r.status);
  const rows = useMemo(() => all.filter((r) => (tab === 'all' || (tab === 'active' ? isActive(r) : !isActive(r)))
    && (priority === 'all' || r.priority === priority)
    && matches(r, search, ['title', 'description', 'userName', 'propertyName', 'category'])), [all, tab, priority, search]);

  const upsert = (saved) => { setData((prev) => prev.map((r) => (r._id === saved._id ? saved : r))); setManaging(null); };

  const quickStatus = async (request, status) => {
    try {
      const response = await api.patch(`/maintenance/${request._id}`, { status });
      setData((prev) => prev.map((r) => (r._id === request._id ? response.data : r)));
      toast.success(`Marked as ${status}. Tenant notified.`);
      bump();
    } catch (err) { toast.error(err.message); }
  };

  const remove = async (request) => {
    const ok = await confirm({ title: 'Delete request?', message: `"${request.title}" will be removed permanently.`, confirmLabel: 'Delete' });
    if (!ok) return;
    try {
      await api.del(`/maintenance/${request._id}`);
      setData((prev) => prev.filter((r) => r._id !== request._id));
      toast.success('Request deleted.');
      bump();
    } catch (err) { toast.error(err.message); }
  };

  const columns = [
    { key: 'title', header: 'Issue', primary: true, render: (r) => <div><div className="cell-main">{r.title}</div><div className="cell-sub">{r.category} · {r.propertyName || 'No property'}</div></div> },
    { key: 'user', header: 'Tenant', render: (r) => r.userName || '—' },
    { key: 'priority', header: 'Priority', render: (r) => <Badge>{r.priority}</Badge> },
    { key: 'status', header: 'Status', render: (r) => (
      <select className="select" style={{ height: 30, width: 130, fontSize: 13 }} value={r.status} onChange={(e) => quickStatus(r, e.target.value)} aria-label="Change status">
        {STATUSES.map((s) => <option key={s}>{s}</option>)}
      </select>
    ) },
    { key: 'age', header: 'Reported', render: (r) => <span className="nowrap">{timeAgo(r.createdAt)}</span> },
    { key: 'actions', header: '', className: 'num', render: (r) => (
      <div className="actions">
        <IconButton icon={Eye} label="View & manage" onClick={() => setManaging(r)} />
        <IconButton icon={Trash2} label="Delete" danger onClick={() => remove(r)} />
      </div>
    ) },
  ];

  return (
    <>
      <PageHeader title="Maintenance requests" description="Issues reported by tenants. Status changes notify the tenant automatically." />
      <Tabs value={tab} onChange={setTab} tabs={[
        { value: 'active', label: 'Active', count: all.filter(isActive).length },
        { value: 'done', label: 'Resolved / closed', count: all.filter((r) => !isActive(r)).length },
        { value: 'all', label: 'All', count: all.length },
      ]} />
      <div className="card">
        <div className="toolbar">
          <SearchInput value={search} onChange={setSearch} placeholder="Search issue, tenant, property…" />
          <Select value={priority} onChange={setPriority} options={[{ value: 'all', label: 'All priorities' }, ...PRIORITIES]} aria-label="Priority" />
        </div>
        {loading && !data ? <LoadingBlock /> : error ? <ErrorState message={error} onRetry={reload} /> : (
          <DataTable columns={columns} rows={rows} resetKey={`${tab}|${priority}|${search}`} empty={<EmptyState icon={Wrench} title="No maintenance requests" message="Requests submitted by tenants appear here." />} />
        )}
      </div>
      {managing && <ManageModal request={managing} onClose={() => setManaging(null)} onSaved={upsert} />}
    </>
  );
}

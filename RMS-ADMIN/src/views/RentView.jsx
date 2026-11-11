import { useMemo, useState } from 'react';
import { BadgeCheck, CalendarPlus, CheckCircle2, FileImage, HandCoins, Pencil, Plus, Receipt, Trash2, UserMinus, Users, Wallet } from 'lucide-react';
import { api, assetUrl } from '../lib/api';
import { date, matches, money, moneyShort, titleCase } from '../lib/format';
import {
  Badge, Button, DataTable, EmptyState, ErrorState, Field, IconButton, LoadingBlock, Modal, PageHeader, SearchInput, Select, StatCard, Tabs,
  useAsync, useConfirm, useToast,
} from '../components/ui';

const LEDGER_STATUS = { pending: 'Pending', on_time: 'Paid on time', late: 'Paid late', partial: 'Partial', overdue: 'Overdue' };
const LEDGER_TONE = { pending: 'amber', on_time: 'green', late: 'amber', partial: 'amber', overdue: 'red' };
const monthLabel = (key) => {
  const [y, m] = String(key || '').split('-').map(Number);
  return y && m ? new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' }) : key;
};

// ---------------------------------------------------------------- tenants
function TenantModal({ tenant, properties, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(() => ({
    name: tenant?.name || '', email: tenant?.email || '', phone: tenant?.phone || '', cnic: tenant?.cnic || '',
    propertyId: tenant?.propertyId || '', monthlyRent: tenant?.monthlyRent || '', securityDeposit: tenant?.securityDeposit || '',
    dueDay: tenant?.dueDay || 5, moveInDate: (tenant?.moveInDate || '').slice(0, 10), status: tenant?.status || 'active',
  }));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const set = (key) => (event) => {
    const value = event.target.value;
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'propertyId' && !prev.monthlyRent) next.monthlyRent = properties.find((p) => p._id === value)?.price || '';
      return next;
    });
  };
  const save = async () => {
    const nextErrors = {};
    if (form.name.trim().length < 2) nextErrors.name = 'Enter the tenant name.';
    if (!(Number(form.monthlyRent) > 0)) nextErrors.monthlyRent = 'Enter the monthly rent.';
    if (!(Number(form.dueDay) >= 1 && Number(form.dueDay) <= 28)) nextErrors.dueDay = 'Day 1 to 28.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setSaving(true);
    try {
      const body = { ...form, monthlyRent: Number(form.monthlyRent), securityDeposit: Number(form.securityDeposit || 0), dueDay: Number(form.dueDay) };
      const response = tenant ? await api.put(`/tenants/${tenant._id}`, body) : await api.post('/tenants', body);
      toast.success(tenant ? 'Tenant updated.' : 'Tenant added.');
      onSaved(response.data);
    } catch (err) { toast.error(err.message); } finally { setSaving(false); }
  };
  return (
    <Modal open title={tenant ? 'Edit tenant' : 'Add tenant'} onClose={onClose} busy={saving} size="lg"
      footer={<><Button onClick={onClose} disabled={saving}>Cancel</Button><Button variant="primary" loading={saving} onClick={save}>Save</Button></>}>
      <div className="form-grid">
        <Field label="Full name" required error={errors.name}><input className={`input ${errors.name ? 'invalid' : ''}`} value={form.name} onChange={set('name')} /></Field>
        <Field label="CNIC"><input className="input" value={form.cnic} onChange={set('cnic')} placeholder="35202-1234567-1" /></Field>
        <Field label="Phone"><input className="input" value={form.phone} onChange={set('phone')} /></Field>
        <Field label="Email"><input className="input" type="email" value={form.email} onChange={set('email')} /></Field>
        <Field label="Property" className="span-2">
          <select className="select" value={form.propertyId} onChange={set('propertyId')}>
            <option value="">Select property…</option>
            {properties.map((p) => <option key={p._id} value={p._id}>{p.title}</option>)}
          </select>
        </Field>
        <Field label="Monthly rent (PKR)" required error={errors.monthlyRent}><input className={`input ${errors.monthlyRent ? 'invalid' : ''}`} type="number" value={form.monthlyRent} onChange={set('monthlyRent')} /></Field>
        <Field label="Security deposit (PKR)"><input className="input" type="number" value={form.securityDeposit} onChange={set('securityDeposit')} /></Field>
        <Field label="Rent due day" error={errors.dueDay} hint="Day of the month (1–28)"><input className={`input ${errors.dueDay ? 'invalid' : ''}`} type="number" min="1" max="28" value={form.dueDay} onChange={set('dueDay')} /></Field>
        <Field label="Move-in date"><input className="input" type="date" value={form.moveInDate} onChange={set('moveInDate')} /></Field>
        {tenant && <Field label="Status"><select className="select" value={form.status} onChange={set('status')}><option value="active">Active</option><option value="left">Moved out</option></select></Field>}
      </div>
    </Modal>
  );
}

function RecordPaymentModal({ record, tenant, onClose, onSaved }) {
  const toast = useToast();
  const remaining = Math.max(0, Number(record.amountDue || 0) - Number(record.amountPaid || 0));
  const [form, setForm] = useState({ amount: remaining || record.amountDue, method: 'bank', paidDate: new Date().toISOString().slice(0, 10), notes: '' });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!(Number(form.amount) > 0)) { toast.error('Enter an amount greater than zero.'); return; }
    setSaving(true);
    try {
      const response = await api.post(`/rent/${record._id}/pay`, { ...form, amount: Number(form.amount), verifiedByAdmin: true });
      toast.success('Rent payment recorded.');
      onSaved(response.data);
    } catch (err) { toast.error(err.message); } finally { setSaving(false); }
  };
  return (
    <Modal open title="Record rent payment" onClose={onClose} busy={saving}
      footer={<><Button onClick={onClose} disabled={saving}>Cancel</Button><Button variant="primary" loading={saving} onClick={save}>Record payment</Button></>}>
      <p className="muted" style={{ marginBottom: 16 }}>{tenant?.name} · {monthLabel(record.month)} · due {money(record.amountDue)} (remaining {money(remaining)})</p>
      <div className="form-grid">
        <Field label="Amount received (PKR)" required><input className="input" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
        <Field label="Method"><select className="select" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}><option value="bank">Bank transfer</option><option value="cash">Cash</option><option value="jazzcash">JazzCash</option><option value="easypaisa">Easypaisa</option></select></Field>
        <Field label="Date received"><input className="input" type="date" value={form.paidDate} onChange={(e) => setForm({ ...form, paidDate: e.target.value })} /></Field>
        <Field label="Notes"><input className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

function TenantsTab() {
  const toast = useToast();
  const confirm = useConfirm();
  const [tab, setTab] = useState('ledger');
  const [search, setSearch] = useState('');
  const [month, setMonth] = useState('all');
  const [editingTenant, setEditingTenant] = useState(undefined);
  const [paying, setPaying] = useState(null);
  const [generating, setGenerating] = useState(false);
  const { data, loading, error, reload, setData } = useAsync(() => Promise.all([
    api.get('/admin/tenants-overview'), api.get('/rent'), api.get('/admin/properties', { purpose: 'Rent', limit: 500 }),
  ]).then(([t, r, p]) => ({ tenants: t.data, ledger: r.data, properties: p.data })), []);

  const tenants = useMemo(() => data?.tenants || [], [data]);
  const tenantById = useMemo(() => Object.fromEntries(tenants.map((t) => [t._id, t])), [tenants]);
  const ledger = useMemo(() => (data?.ledger || []).map((r) => ({ ...r, tenant: tenantById[String(r.tenantId)] })), [data, tenantById]);
  const months = useMemo(() => [...new Set(ledger.map((r) => r.month))].sort().reverse(), [ledger]);
  const ledgerRows = useMemo(() => ledger.filter((r) => (month === 'all' || r.month === month) && matches(r, search, [(x) => x.tenant?.name, (x) => x.tenant?.propertyTitle])), [ledger, month, search]);
  const tenantRows = useMemo(() => tenants.filter((t) => matches(t, search, ['name', 'email', 'phone', 'propertyTitle'])), [tenants, search]);
  const totals = useMemo(() => ({
    due: ledger.reduce((s, r) => s + Number(r.amountDue || 0), 0),
    paid: ledger.reduce((s, r) => s + Number(r.amountPaid || 0), 0),
    overdue: ledger.filter((r) => ['overdue', 'pending', 'partial'].includes(r.status) && r.dueDate && new Date(r.dueDate) < new Date()).length,
  }), [ledger]);

  const generate = async () => {
    setGenerating(true);
    try {
      const response = await api.post('/rent/generate');
      toast.success(response.data.created.length ? `Created ${response.data.created.length} rent record(s) for this month.` : 'This month\'s rent records already exist for all active tenants.');
      reload();
    } catch (err) { toast.error(err.message); } finally { setGenerating(false); }
  };

  const moveOut = async (tenant) => {
    const ok = await confirm({ title: `Mark ${tenant.name} as moved out?`, message: 'No further monthly rent will be generated for this tenant. Their payment history is kept.', confirmLabel: 'Mark as moved out' });
    if (!ok) return;
    try {
      const response = await api.del(`/tenants/${tenant._id}`);
      setData((prev) => ({ ...prev, tenants: prev.tenants.map((t) => (t._id === tenant._id ? { ...t, ...response.data } : t)) }));
      toast.success('Tenant marked as moved out.');
    } catch (err) { toast.error(err.message); }
  };

  if (loading && !data) return <LoadingBlock />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const ledgerColumns = [
    { key: 'tenant', header: 'Tenant', primary: true, render: (r) => <div><div className="cell-main">{r.tenant?.name || 'Unknown tenant'}</div><div className="cell-sub truncate" style={{ maxWidth: 260 }}>{r.tenant?.propertyTitle}</div></div> },
    { key: 'month', header: 'Month', render: (r) => monthLabel(r.month) },
    { key: 'due', header: 'Due', className: 'num', render: (r) => <div>{money(r.amountDue)}<div className="cell-sub">{date(r.dueDate)}</div></div> },
    { key: 'paid', header: 'Paid', className: 'num', render: (r) => <div>{money(r.amountPaid)}{r.paidDate && <div className="cell-sub">{date(r.paidDate)}</div>}</div> },
    { key: 'status', header: 'Status', render: (r) => <Badge tone={LEDGER_TONE[r.status]}>{LEDGER_STATUS[r.status] || titleCase(r.status)}</Badge> },
    { key: 'actions', header: '', className: 'num', render: (r) => (
      <div className="actions">
        {Number(r.amountPaid) < Number(r.amountDue) && <Button size="sm" icon={HandCoins} onClick={() => setPaying(r)}>Record payment</Button>}
      </div>
    ) },
  ];
  const tenantColumns = [
    { key: 'name', header: 'Tenant', primary: true, render: (t) => <div><div className="cell-main">{t.name}</div><div className="cell-sub">{[t.phone, t.email].filter(Boolean).join(' · ')}</div></div> },
    { key: 'property', header: 'Property', render: (t) => <div className="truncate" style={{ maxWidth: 260 }}>{t.propertyTitle || '—'}</div> },
    { key: 'rent', header: 'Rent', className: 'num', render: (t) => money(t.monthlyRent) },
    { key: 'due', header: 'Due day', render: (t) => `${t.dueDay}${['th', 'st', 'nd', 'rd'][t.dueDay % 10 > 3 || Math.floor(t.dueDay / 10) === 1 ? 0 : t.dueDay % 10]} of month` },
    { key: 'since', header: 'Since', render: (t) => date(t.moveInDate) },
    { key: 'status', header: 'Status', render: (t) => <Badge>{t.status === 'left' ? 'Left' : 'Active'}</Badge> },
    { key: 'actions', header: '', className: 'num', render: (t) => (
      <div className="actions">
        <IconButton icon={Pencil} label="Edit" onClick={() => setEditingTenant(t)} />
        {t.status !== 'left' && <IconButton icon={UserMinus} label="Mark as moved out" danger onClick={() => moveOut(t)} />}
      </div>
    ) },
  ];

  return (
    <>
      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        <StatCard icon={Users} label="Active tenants" value={tenants.filter((t) => t.status !== 'left').length} />
        <StatCard icon={Receipt} tone="sky" label="Rent billed" value={moneyShort(totals.due)} />
        <StatCard icon={Wallet} tone="green" label="Rent collected" value={moneyShort(totals.paid)} hint={totals.due ? `${Math.round((totals.paid / totals.due) * 100)}% collection rate` : ''} />
        <StatCard icon={Receipt} tone="red" label="Overdue / unpaid" value={totals.overdue} hint={moneyShort(Math.max(0, totals.due - totals.paid))} />
      </div>
      <div className="card">
        <div className="toolbar">
          <div className="segmented">
            <button type="button" className={tab === 'ledger' ? 'active' : ''} onClick={() => setTab('ledger')}>Rent ledger</button>
            <button type="button" className={tab === 'tenants' ? 'active' : ''} onClick={() => setTab('tenants')}>Tenants</button>
          </div>
          <SearchInput value={search} onChange={setSearch} placeholder="Search tenant or property…" />
          {tab === 'ledger' && <Select value={month} onChange={setMonth} options={[{ value: 'all', label: 'All months' }, ...months.map((m) => ({ value: m, label: monthLabel(m) }))]} aria-label="Month" />}
          <div className="toolbar-spacer" />
          {tab === 'ledger'
            ? <Button icon={CalendarPlus} loading={generating} onClick={generate}>Generate this month</Button>
            : <Button variant="primary" icon={Plus} onClick={() => setEditingTenant(null)}>Add tenant</Button>}
        </div>
        {tab === 'ledger'
          ? <DataTable columns={ledgerColumns} rows={ledgerRows} resetKey={`${month}|${search}`} empty={<EmptyState icon={Receipt} title="No rent records" message="Add tenants, then generate this month's rent." />} />
          : <DataTable columns={tenantColumns} rows={tenantRows} resetKey={search} empty={<EmptyState icon={Users} title="No tenants" message="Tenants are created automatically when you approve a booking, or add one manually." />} />}
      </div>
      {editingTenant !== undefined && (
        <TenantModal tenant={editingTenant} properties={data.properties} onClose={() => setEditingTenant(undefined)} onSaved={() => { setEditingTenant(undefined); reload(); }} />
      )}
      {paying && <RecordPaymentModal record={paying} tenant={paying.tenant} onClose={() => setPaying(null)} onSaved={(saved) => { setPaying(null); setData((prev) => ({ ...prev, ledger: prev.ledger.map((r) => (r._id === saved._id ? saved : r)) })); }} />}
    </>
  );
}

// ---------------------------------------------------------------- dues (user accounts)
function DueModal({ due, users, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(() => ({
    userId: due?.userId || '', propertyName: due?.propertyName || '', monthlyRent: due?.monthlyRent || '', paid: due?.paid || 0,
    dueDate: (due?.dueDate || new Date(new Date().getFullYear(), new Date().getMonth() + 1, 5).toISOString()).slice(0, 10), month: due?.month || '',
  }));
  const [saving, setSaving] = useState(false);
  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));
  const save = async () => {
    if (!due && !form.userId) { toast.error('Choose the tenant account.'); return; }
    if (!(Number(form.monthlyRent) > 0)) { toast.error('Enter the amount due.'); return; }
    setSaving(true);
    try {
      const user = users.find((u) => u._id === form.userId);
      const body = { ...form, monthlyRent: Number(form.monthlyRent), paid: Number(form.paid || 0), userName: user?.name || due?.userName };
      const response = due ? await api.put(`/rents/${due._id}`, body) : await api.post('/rents', body);
      toast.success(due ? 'Due updated.' : 'Due created; the tenant can see it on their account.');
      onSaved(response.data);
    } catch (err) { toast.error(err.message); } finally { setSaving(false); }
  };
  return (
    <Modal open title={due ? 'Edit due' : 'Create due'} onClose={onClose} busy={saving}
      footer={<><Button onClick={onClose} disabled={saving}>Cancel</Button><Button variant="primary" loading={saving} onClick={save}>Save</Button></>}>
      <div className="form-grid">
        {!due && (
          <Field label="Tenant account" required className="span-2">
            <select className="select" value={form.userId} onChange={set('userId')}>
              <option value="">Select user…</option>
              {users.filter((u) => u.role !== 'admin').map((u) => <option key={u._id} value={u._id}>{u.name} ({u.email})</option>)}
            </select>
          </Field>
        )}
        <Field label="Property" className="span-2"><input className="input" value={form.propertyName} onChange={set('propertyName')} /></Field>
        <Field label="Amount due (PKR)" required><input className="input" type="number" value={form.monthlyRent} onChange={set('monthlyRent')} /></Field>
        <Field label="Already paid (PKR)"><input className="input" type="number" value={form.paid} onChange={set('paid')} /></Field>
        <Field label="Due date"><input className="input" type="date" value={form.dueDate} onChange={set('dueDate')} /></Field>
        <Field label="Billing month" hint="e.g. December 2026"><input className="input" value={form.month} onChange={set('month')} /></Field>
      </div>
    </Modal>
  );
}

function DuesTab() {
  const toast = useToast();
  const confirm = useConfirm();
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(undefined);
  const { data, loading, error, reload, setData } = useAsync(() => Promise.all([api.get('/rents/all'), api.get('/admin/users', { limit: 1000 })]).then(([r, u]) => ({ dues: r.data, users: u.data })), []);
  const dues = useMemo(() => data?.dues || [], [data]);
  const rows = useMemo(() => dues.filter((d) => (status === 'all' || d.status === status || (status === 'review' && d.verification === 'submitted'))
    && matches(d, search, ['userName', 'propertyName', 'month'])), [dues, status, search]);
  const upsert = (saved) => setData((prev) => ({ ...prev, dues: prev.dues.some((d) => d._id === saved._id) ? prev.dues.map((d) => (d._id === saved._id ? saved : d)) : [saved, ...prev.dues] }));

  const markPaid = async (due) => {
    const ok = await confirm({ title: 'Mark as paid?', message: `${due.userName}'s ${due.month} rent of ${money(due.monthlyRent)} will be marked fully paid.`, confirmLabel: 'Mark paid', tone: 'success' });
    if (!ok) return;
    try { upsert((await api.put(`/rents/${due._id}`, { markPaid: true })).data); toast.success('Marked as paid.'); } catch (err) { toast.error(err.message); }
  };
  const verify = async (due, approve) => {
    let note = '';
    if (!approve) {
      note = await confirm({ title: 'Reject submitted payment', message: 'The tenant will be told why.', confirmLabel: 'Reject', input: { label: 'Reason', required: true } });
      if (!note) return;
    }
    try { upsert((await api.post(`/rents/${due._id}/verify`, { approve, note })).data); toast.success(approve ? 'Payment verified.' : 'Payment rejected.'); } catch (err) { toast.error(err.message); }
  };
  const remove = async (due) => {
    const ok = await confirm({ title: 'Delete due?', message: 'This rent record will be removed from the tenant\'s account.', confirmLabel: 'Delete' });
    if (!ok) return;
    try { await api.del(`/rents/${due._id}`); setData((prev) => ({ ...prev, dues: prev.dues.filter((d) => d._id !== due._id) })); toast.success('Due deleted.'); } catch (err) { toast.error(err.message); }
  };

  if (loading && !data) return <LoadingBlock />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const columns = [
    { key: 'user', header: 'Tenant', primary: true, render: (d) => <div><div className="cell-main">{d.userName || '—'}</div><div className="cell-sub truncate" style={{ maxWidth: 240 }}>{d.propertyName}</div></div> },
    { key: 'month', header: 'Month', render: (d) => <div>{d.month}<div className="cell-sub">Due {date(d.dueDate)}</div></div> },
    { key: 'amount', header: 'Amount', className: 'num', render: (d) => <div>{money(d.monthlyRent)}<div className="cell-sub">Remaining {money(d.remaining)}</div></div> },
    { key: 'status', header: 'Status', render: (d) => <div className="row row-wrap" style={{ gap: 4 }}><Badge>{d.status}</Badge>{d.verification === 'submitted' && <Badge tone="blue">Proof submitted</Badge>}</div> },
    { key: 'actions', header: '', className: 'num', render: (d) => (
      <div className="actions">
        {d.verification === 'submitted' && d.proofImage && <a className="icon-btn" href={assetUrl(d.proofImage)} target="_blank" rel="noreferrer" title="View receipt"><FileImage size={16} /></a>}
        {d.verification === 'submitted' && <IconButton icon={BadgeCheck} label={`Verify ${money(d.submittedAmount)}`} onClick={() => verify(d, true)} style={{ color: 'var(--success)' }} />}
        {d.verification === 'submitted' && <IconButton icon={Trash2} label="Reject submitted payment" danger onClick={() => verify(d, false)} />}
        {d.status !== 'Paid' && d.verification !== 'submitted' && <IconButton icon={CheckCircle2} label="Mark paid" onClick={() => markPaid(d)} />}
        <IconButton icon={Pencil} label="Edit" onClick={() => setEditing(d)} />
        <IconButton icon={Trash2} label="Delete" danger onClick={() => remove(d)} />
      </div>
    ) },
  ];
  return (
    <div className="card">
      <div className="toolbar">
        <SearchInput value={search} onChange={setSearch} placeholder="Search tenant, property, month…" />
        <Select value={status} onChange={setStatus} options={[{ value: 'all', label: 'All statuses' }, { value: 'review', label: 'Proof submitted' }, 'Pending', 'Partial', 'Overdue', 'Paid']} aria-label="Status" />
        <div className="toolbar-spacer" />
        <Button variant="primary" icon={Plus} onClick={() => setEditing(null)}>Create due</Button>
      </div>
      <DataTable columns={columns} rows={rows} resetKey={`${status}|${search}`} empty={<EmptyState icon={Receipt} title="No dues" message="Dues you create appear on the tenant's My Rent page on the website." />} />
      {editing !== undefined && <DueModal due={editing} users={data.users} onClose={() => setEditing(undefined)} onSaved={(saved) => { upsert(saved); setEditing(undefined); }} />}
    </div>
  );
}

export default function RentView() {
  const [tab, setTab] = useState('tenants');
  return (
    <>
      <PageHeader title="Rent & dues" description="Monthly rent for tenants, and dues shown on residents' website accounts." />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'tenants', label: 'Tenants & rent ledger' }, { value: 'dues', label: 'Resident dues (website)' }]} />
      {tab === 'tenants' ? <TenantsTab /> : <DuesTab />}
    </>
  );
}

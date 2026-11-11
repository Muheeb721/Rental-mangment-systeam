import { useMemo, useState } from 'react';
import { Check, CreditCard, Pencil, Plus, Trash2, Wallet, X, Clock } from 'lucide-react';
import { api } from '../lib/api';
import { date, matches, money, moneyShort } from '../lib/format';
import {
  Badge, Button, DataTable, EmptyState, ErrorState, Field, IconButton, LoadingBlock, Modal, PageHeader, SearchInput, Select, StatCard,
  useAsync, useConfirm, useToast,
} from '../components/ui';

const METHODS = ['Cash', 'Bank Transfer', 'JazzCash', 'Easypaisa', 'Card', 'Cheque', 'Other'];
const STATUSES = ['Pending', 'Approved', 'Rejected', 'Refunded'];
const bump = () => window.dispatchEvent(new Event('rms-admin:counts-changed'));

function PaymentFormModal({ payment, users, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(() => ({
    userId: payment?.userId || '',
    amount: payment?.amount || '',
    method: payment?.method && METHODS.includes(payment.method) ? payment.method : 'Bank Transfer',
    status: payment?.status || 'Approved',
    paymentType: payment?.paymentType || 'Rent',
    propertyName: payment?.propertyName || '',
    transactionId: payment?.transactionId || '',
    paymentDate: (payment?.paymentDate || new Date().toISOString()).slice(0, 10),
    notes: payment?.notes || '',
  }));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const save = async () => {
    const nextErrors = {};
    if (!payment && !form.userId) nextErrors.userId = 'Choose who paid.';
    if (!(Number(form.amount) > 0)) nextErrors.amount = 'Enter an amount greater than zero.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setSaving(true);
    try {
      const user = users.find((u) => u._id === form.userId);
      const body = { ...form, amount: Number(form.amount) };
      if (!payment && user) Object.assign(body, { userName: user.name, userEmail: user.email, userPhone: user.phone });
      const response = payment ? await api.put(`/payments/${payment._id}`, body) : await api.post('/payments', body);
      toast.success(response.message || 'Saved.');
      onSaved(response.data);
      bump();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open title={payment ? 'Edit payment' : 'Record payment'} onClose={onClose} busy={saving}
      footer={<><Button onClick={onClose} disabled={saving}>Cancel</Button><Button variant="primary" loading={saving} onClick={save}>{payment ? 'Save' : 'Record payment'}</Button></>}>
      <div className="form-grid">
        {!payment ? (
          <Field label="Paid by" required error={errors.userId} className="span-2">
            <select className={`select ${errors.userId ? 'invalid' : ''}`} value={form.userId} onChange={set('userId')}>
              <option value="">Select a user…</option>
              {users.filter((u) => u.role !== 'admin').map((u) => <option key={u._id} value={u._id}>{u.name} ({u.email})</option>)}
            </select>
          </Field>
        ) : <div className="span-2"><span className="muted">Paid by</span> <strong>{payment.userName || payment.userEmail}</strong></div>}
        <Field label="Amount (PKR)" required error={errors.amount}><input className={`input ${errors.amount ? 'invalid' : ''}`} type="number" min="0" value={form.amount} onChange={set('amount')} /></Field>
        <Field label="Method"><select className="select" value={form.method} onChange={set('method')}>{METHODS.map((m) => <option key={m}>{m}</option>)}</select></Field>
        <Field label="Status"><select className="select" value={form.status} onChange={set('status')}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Payment date"><input className="input" type="date" value={form.paymentDate} onChange={set('paymentDate')} /></Field>
        <Field label="Type"><select className="select" value={form.paymentType} onChange={set('paymentType')}>{['Rent', 'Advance', 'Security Deposit', 'Maintenance', 'Other'].map((t) => <option key={t}>{t}</option>)}</select></Field>
        <Field label="Transaction / reference"><input className="input" value={form.transactionId} onChange={set('transactionId')} /></Field>
        <Field label="Property" className="span-2"><input className="input" value={form.propertyName} onChange={set('propertyName')} placeholder="Property title (optional)" /></Field>
        <Field label="Notes" className="span-2"><textarea className="textarea" rows={2} value={form.notes} onChange={set('notes')} /></Field>
      </div>
    </Modal>
  );
}

export default function PaymentsView() {
  const toast = useToast();
  const confirm = useConfirm();
  const [status, setStatus] = useState('all');
  const [method, setMethod] = useState('all');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(undefined);
  const { data, loading, error, reload, setData } = useAsync(() => Promise.all([api.get('/payments'), api.get('/admin/users', { limit: 1000 })]).then(([p, u]) => ({ payments: p.data, users: u.data })), []);
  const payments = useMemo(() => data?.payments || [], [data]);
  const rows = useMemo(() => payments.filter((p) => (status === 'all' || p.status === status) && (method === 'all' || p.method === method)
    && matches(p, search, ['userName', 'userEmail', 'propertyName', 'transactionId'])), [payments, status, method, search]);
  const totals = useMemo(() => ({
    approved: payments.filter((p) => p.status === 'Approved').reduce((sum, p) => sum + Number(p.amount || 0), 0),
    pending: payments.filter((p) => p.status === 'Pending').length,
    pendingAmount: payments.filter((p) => p.status === 'Pending').reduce((sum, p) => sum + Number(p.amount || 0), 0),
  }), [payments]);

  const upsert = (saved) => setData((prev) => ({ ...prev, payments: prev.payments.some((p) => p._id === saved._id) ? prev.payments.map((p) => (p._id === saved._id ? saved : p)) : [saved, ...prev.payments] }));

  const setPaymentStatus = async (payment, next) => {
    let reason = '';
    if (next === 'Rejected') {
      reason = await confirm({ title: 'Reject payment', message: 'The user will be notified with this reason.', confirmLabel: 'Reject payment', input: { label: 'Reason', required: true, placeholder: 'e.g. Transaction ID not found in bank statement' } });
      if (!reason) return;
    } else {
      const ok = await confirm({ title: 'Approve payment?', message: `Confirm that ${money(payment.amount)} from ${payment.userName || 'the user'} was received.`, confirmLabel: 'Approve', tone: 'success' });
      if (!ok) return;
    }
    try {
      const response = await api.patch(`/payments/${payment._id}/status`, { status: next, reason });
      upsert(response.data);
      toast.success(response.message);
      bump();
    } catch (err) { toast.error(err.message); }
  };

  const remove = async (payment) => {
    const ok = await confirm({ title: 'Delete payment?', message: 'This removes the payment from the ledger permanently.', confirmLabel: 'Delete' });
    if (!ok) return;
    try {
      await api.del(`/payments/${payment._id}`);
      setData((prev) => ({ ...prev, payments: prev.payments.filter((p) => p._id !== payment._id) }));
      toast.success('Payment deleted.');
      bump();
    } catch (err) { toast.error(err.message); }
  };

  const columns = [
    { key: 'user', header: 'Paid by', primary: true, render: (p) => <div><div className="cell-main">{p.userName || '—'}</div><div className="cell-sub">{p.userEmail}</div></div> },
    { key: 'property', header: 'For', render: (p) => <div><div className="truncate" style={{ maxWidth: 220 }}>{p.propertyName || '—'}</div><div className="cell-sub">{p.paymentType}</div></div> },
    { key: 'amount', header: 'Amount', className: 'num', render: (p) => <span className="strong">{money(p.amount)}</span> },
    { key: 'method', header: 'Method', render: (p) => <div>{p.method}{p.transactionId && <div className="cell-sub">Ref: {p.transactionId}</div>}</div> },
    { key: 'date', header: 'Date', render: (p) => <span className="nowrap">{date(p.paymentDate || p.createdAt)}</span> },
    { key: 'status', header: 'Status', render: (p) => <Badge>{p.status}</Badge> },
    { key: 'actions', header: '', className: 'num', render: (p) => (
      <div className="actions">
        {p.status === 'Pending' && <IconButton icon={Check} label="Approve" onClick={() => setPaymentStatus(p, 'Approved')} style={{ color: 'var(--success)' }} />}
        {p.status === 'Pending' && <IconButton icon={X} label="Reject" danger onClick={() => setPaymentStatus(p, 'Rejected')} />}
        <IconButton icon={Pencil} label="Edit" onClick={() => setEditing(p)} />
        <IconButton icon={Trash2} label="Delete" danger onClick={() => remove(p)} />
      </div>
    ) },
  ];

  return (
    <>
      <PageHeader title="Payments" description="Payments submitted by tenants and recorded by admins." actions={<Button variant="primary" icon={Plus} onClick={() => setEditing(null)}>Record payment</Button>} />
      <div className="grid grid-3" style={{ marginBottom: 16 }}>
        <StatCard icon={Wallet} tone="green" label="Approved total" value={moneyShort(totals.approved)} />
        <StatCard icon={Clock} tone="amber" label="Awaiting review" value={totals.pending} hint={moneyShort(totals.pendingAmount)} />
        <StatCard icon={CreditCard} label="Transactions" value={payments.length} />
      </div>
      <div className="card">
        <div className="toolbar">
          <SearchInput value={search} onChange={setSearch} placeholder="Search payer, property, reference…" />
          <Select value={status} onChange={setStatus} options={[{ value: 'all', label: 'All statuses' }, ...STATUSES]} aria-label="Status" />
          <Select value={method} onChange={setMethod} options={[{ value: 'all', label: 'All methods' }, ...METHODS]} aria-label="Method" />
        </div>
        {loading && !data ? <LoadingBlock /> : error ? <ErrorState message={error} onRetry={reload} /> : (
          <DataTable columns={columns} rows={rows} resetKey={`${status}|${method}|${search}`} empty={<EmptyState icon={CreditCard} title="No payments" message="Payments appear here when tenants pay or you record one." />} />
        )}
      </div>
      {editing !== undefined && <PaymentFormModal payment={editing} users={data?.users || []} onClose={() => setEditing(undefined)} onSaved={(saved) => { upsert(saved); setEditing(undefined); }} />}
    </>
  );
}

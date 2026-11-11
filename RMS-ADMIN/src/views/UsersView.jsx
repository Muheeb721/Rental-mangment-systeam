import { useMemo, useState } from 'react';
import { Ban, Eye, Pencil, Plus, ShieldCheck, Trash2, UserCheck, Users } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { date, dateTime, matches, money, titleCase } from '../lib/format';
import {
  Avatar, Badge, Button, DataTable, EmptyState, ErrorState, Field, IconButton, LoadingBlock, Modal, PageHeader, SearchInput, Select,
  StatCard, useAsync, useConfirm, useToast,
} from '../components/ui';

const ROLES = [{ value: 'resident', label: 'Resident / tenant' }, { value: 'owner', label: 'Owner / landlord' }, { value: 'admin', label: 'Admin' }];
const EMPTY_FORM = { name: '', email: '', phone: '', role: 'resident', status: 'Active', password: '' };

function UserFormModal({ open, user, onClose, onSaved }) {
  const toast = useToast();
  // mounted fresh each time the modal opens (see key below), so initial state comes from props
  const [form, setForm] = useState(() => (user ? { name: user.name || '', email: user.email || '', phone: user.phone || '', role: user.role || 'resident', status: user.status || 'Active', password: '' } : EMPTY_FORM));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const save = async (event) => {
    event.preventDefault();
    const nextErrors = {};
    if (form.name.trim().length < 2) nextErrors.name = 'Enter a name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) nextErrors.email = 'Enter a valid email.';
    if (form.phone && !/^\+?[\d\s-]{7,20}$/.test(form.phone)) nextErrors.phone = 'Enter a valid phone number.';
    if (!user && form.password.length < 8) nextErrors.password = 'At least 8 characters.';
    if (user && form.password && form.password.length < 8) nextErrors.password = 'At least 8 characters.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setSaving(true);
    try {
      const body = { ...form, name: form.name.trim(), email: form.email.trim() };
      if (!body.password) delete body.password;
      const response = user ? await api.put(`/admin/users/${user._id}`, body) : await api.post('/admin/users', body);
      toast.success(response.message || 'Saved.');
      onSaved(response.data);
    } catch (error) {
      if (error.errors) setErrors(error.errors);
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={user ? 'Edit user' : 'Add user'}
      onClose={onClose}
      busy={saving}
      footer={<><Button onClick={onClose} disabled={saving}>Cancel</Button><Button variant="primary" loading={saving} onClick={save}>{user ? 'Save changes' : 'Create user'}</Button></>}
    >
      <form className="form-grid" onSubmit={save} noValidate>
        <Field label="Full name" required error={errors.name} className="span-2"><input className={`input ${errors.name ? 'invalid' : ''}`} value={form.name} onChange={set('name')} autoFocus /></Field>
        <Field label="Email" required error={errors.email}><input className={`input ${errors.email ? 'invalid' : ''}`} type="email" value={form.email} onChange={set('email')} /></Field>
        <Field label="Phone" error={errors.phone}><input className={`input ${errors.phone ? 'invalid' : ''}`} value={form.phone} onChange={set('phone')} placeholder="+92 300 1234567" /></Field>
        <Field label="Role"><select className="select" value={form.role} onChange={set('role')}>{ROLES.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}</select></Field>
        <Field label="Status"><select className="select" value={form.status} onChange={set('status')}><option>Active</option><option>Blocked</option></select></Field>
        <Field label={user ? 'New password' : 'Password'} required={!user} error={errors.password} hint={user ? 'Leave empty to keep the current password.' : 'At least 8 characters.'} className="span-2">
          <input className={`input ${errors.password ? 'invalid' : ''}`} type="password" autoComplete="new-password" value={form.password} onChange={set('password')} />
        </Field>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

function UserDetailModal({ userId, onClose }) {
  const { data, loading, error } = useAsync(() => (userId ? api.get(`/admin/users/${userId}`).then((r) => r.data) : Promise.resolve(null)), [userId]);
  const user = data?.user;
  return (
    <Modal open={Boolean(userId)} title="User details" onClose={onClose} size="lg">
      {loading ? <LoadingBlock /> : error ? <ErrorState message={error} /> : user && (
        <>
          <div className="row" style={{ gap: 16, marginBottom: 20 }}>
            <Avatar name={user.name} src={user.profileImage} size="lg" />
            <div>
              <h3 style={{ fontSize: 18 }}>{user.name}</h3>
              <div className="muted">{user.email} {user.phone && `· ${user.phone}`}</div>
              <div className="row mt-8"><Badge dot={false}>{titleCase(user.role)}</Badge><Badge>{user.status || 'Active'}</Badge></div>
            </div>
          </div>
          <div className="grid grid-3" style={{ marginBottom: 16 }}>
            <StatCard icon={Users} label="Bookings" value={data.counts.bookings} />
            <StatCard icon={Users} tone="violet" label="Applications" value={data.counts.applications} />
            <StatCard icon={Users} tone="green" label="Favourites" value={data.counts.favorites} />
          </div>
          <div className="section-title">Account</div>
          <dl className="dl">
            <dt>Joined</dt><dd>{dateTime(user.createdAt)}</dd>
            <dt>Last login</dt><dd>{dateTime(user.lastLoginAt)}</dd>
            <dt>Rental profile</dt><dd>{data.rentalProfile ? `${data.rentalProfile.occupation || '—'} · ${data.rentalProfile.city || ''} · ${data.rentalProfile.profileStatus || ''}` : 'Not completed'}</dd>
            {data.rentalProfile?.emergencyContactName && (<><dt>Emergency contact</dt><dd>{data.rentalProfile.emergencyContactName} {data.rentalProfile.emergencyContactPhone}</dd></>)}
          </dl>
          <div className="section-title">Recent bookings</div>
          {data.bookings.length === 0 ? <p className="muted">No bookings.</p> : data.bookings.slice(0, 5).map((booking) => (
            <div key={booking._id} className="row spread" style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
              <span className="truncate">{booking.propertyTitle}</span><span className="row"><span className="muted small">{date(booking.createdAt)}</span><Badge>{booking.status}</Badge></span>
            </div>
          ))}
          <div className="section-title">Recent payments</div>
          {data.payments.length === 0 ? <p className="muted">No payments.</p> : data.payments.slice(0, 5).map((payment) => (
            <div key={payment._id} className="row spread" style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
              <span>{money(payment.amount)} · {payment.method}</span><span className="row"><span className="muted small">{date(payment.paymentDate)}</span><Badge>{payment.status}</Badge></span>
            </div>
          ))}
        </>
      )}
    </Modal>
  );
}

export default function UsersView() {
  const toast = useToast();
  const confirm = useConfirm();
  const { user: me } = useAuth();
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('all');
  const [status, setStatus] = useState('all');
  const [editing, setEditing] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [viewing, setViewing] = useState('');
  const { data, loading, error, reload, setData } = useAsync(() => api.get('/admin/users', { limit: 1000 }).then((r) => r.data), []);

  const users = useMemo(() => (data || []).filter((user) => (role === 'all' || user.role === role)
    && (status === 'all' || (user.status || 'Active') === status)
    && matches(user, search, ['name', 'email', 'phone'])), [data, role, status, search]);

  const counts = useMemo(() => ({
    total: data?.length || 0,
    residents: (data || []).filter((u) => u.role === 'resident').length,
    owners: (data || []).filter((u) => u.role === 'owner').length,
    blocked: (data || []).filter((u) => u.status === 'Blocked').length,
  }), [data]);

  const upsert = (saved) => setData((prev) => (prev.some((u) => u._id === saved._id) ? prev.map((u) => (u._id === saved._id ? saved : u)) : [saved, ...prev]));

  const toggleBlock = async (user) => {
    const blocking = user.status !== 'Blocked';
    const ok = await confirm({
      title: blocking ? `Block ${user.name}?` : `Unblock ${user.name}?`,
      message: blocking ? 'They will be signed out and cannot log in until unblocked.' : 'They will be able to sign in again.',
      confirmLabel: blocking ? 'Block user' : 'Unblock user',
      tone: blocking ? 'danger' : 'success',
    });
    if (!ok) return;
    try {
      const response = await api.put(`/admin/users/${user._id}`, { status: blocking ? 'Blocked' : 'Active' });
      upsert(response.data);
      toast.success(blocking ? 'User blocked.' : 'User unblocked.');
    } catch (err) { toast.error(err.message); }
  };

  const changeRole = async (user, nextRole) => {
    try {
      const response = await api.put(`/admin/users/${user._id}`, { role: nextRole });
      upsert(response.data);
      toast.success(`${user.name} is now ${titleCase(nextRole)}.`);
    } catch (err) { toast.error(err.message); }
  };

  const remove = async (user) => {
    const ok = await confirm({ title: `Delete ${user.name}?`, message: 'The account, favourites, saved searches and notifications are permanently removed. Bookings and payments stay for your records.', confirmLabel: 'Delete user' });
    if (!ok) return;
    try {
      await api.del(`/admin/users/${user._id}`);
      setData((prev) => prev.filter((u) => u._id !== user._id));
      toast.success('User deleted.');
    } catch (err) { toast.error(err.message); }
  };

  const columns = [
    { key: 'name', header: 'User', primary: true, render: (u) => (
      <div className="row" style={{ gap: 10 }}>
        <Avatar name={u.name} src={u.profileImage} />
        <div style={{ minWidth: 0 }}><div className="cell-main">{u.name}{u._id === me?._id && <span className="muted small"> (you)</span>}</div><div className="cell-sub">{u.email}</div></div>
      </div>
    ) },
    { key: 'phone', header: 'Phone', render: (u) => u.phone || '—' },
    { key: 'role', header: 'Role', render: (u) => (
      <select className="select" style={{ height: 30, width: 150, fontSize: 13 }} value={u.role} disabled={u._id === me?._id} onChange={(event) => changeRole(u, event.target.value)} aria-label="Change role">
        {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
      </select>
    ) },
    { key: 'status', header: 'Status', render: (u) => <Badge>{u.status || 'Active'}</Badge> },
    { key: 'createdAt', header: 'Joined', render: (u) => <span className="nowrap">{date(u.createdAt)}</span> },
    { key: 'actions', header: '', className: 'num', render: (u) => (
      <div className="actions">
        <IconButton icon={Eye} label="View details" onClick={() => setViewing(u._id)} />
        <IconButton icon={Pencil} label="Edit" onClick={() => { setEditing(u); setFormOpen(true); }} />
        {u._id !== me?._id && <IconButton icon={u.status === 'Blocked' ? UserCheck : Ban} label={u.status === 'Blocked' ? 'Unblock' : 'Block'} onClick={() => toggleBlock(u)} />}
        {u._id !== me?._id && <IconButton icon={Trash2} label="Delete" danger onClick={() => remove(u)} />}
      </div>
    ) },
  ];

  return (
    <>
      <PageHeader title="Users" description="Residents, owners and admins registered on RMS." actions={<Button variant="primary" icon={Plus} onClick={() => { setEditing(null); setFormOpen(true); }}>Add user</Button>} />
      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        <StatCard icon={Users} label="Total users" value={counts.total} />
        <StatCard icon={Users} tone="green" label="Residents" value={counts.residents} />
        <StatCard icon={ShieldCheck} tone="violet" label="Owners" value={counts.owners} />
        <StatCard icon={Ban} tone="red" label="Blocked" value={counts.blocked} />
      </div>
      <div className="card">
        <div className="toolbar">
          <SearchInput value={search} onChange={setSearch} placeholder="Search name, email or phone…" />
          <Select value={role} onChange={setRole} options={[{ value: 'all', label: 'All roles' }, ...ROLES]} aria-label="Role" />
          <Select value={status} onChange={setStatus} options={[{ value: 'all', label: 'All statuses' }, 'Active', 'Blocked']} aria-label="Status" />
        </div>
        {loading && !data ? <LoadingBlock /> : error ? <ErrorState message={error} onRetry={reload} /> : (
          <DataTable columns={columns} rows={users} resetKey={`${search}|${role}|${status}`} empty={<EmptyState icon={Users} title="No users found" message="Try a different search or filter." />} />
        )}
      </div>
      {formOpen && <UserFormModal key={editing?._id || 'new'} open user={editing} onClose={() => setFormOpen(false)} onSaved={(saved) => { upsert(saved); setFormOpen(false); }} />}
      <UserDetailModal userId={viewing} onClose={() => setViewing('')} />
    </>
  );
}

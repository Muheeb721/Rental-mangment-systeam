import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'react-toastify';
import {
  LuBell, LuBookmark, LuCamera, LuCheck, LuCreditCard, LuDownload, LuFileText, LuHeart, LuLayoutDashboard,
  LuPlus, LuRefreshCw, LuSearch, LuTrash2, LuUser, LuWrench, LuArrowRight, LuCircleAlert, LuPaperclip, LuX,
} from 'react-icons/lu';
import api from '../../services/api';
import savedSearchService from '../../services/savedSearchService';
import {
  deleteNotificationOnServer, downloadRentalAgreement, fetchNotificationsFromServer, markAllNotificationsOnServer, markNotificationAsReadOnServer,
} from '../../services/notificationService.jsx';
import { useAuth } from '../../contexts/AuthContext';
import { useProperties } from '../../hooks/useProperties';
import { useFavoriteIds, syncFavorites } from '../../hooks/useFavoriteIds';
import PropertyCard, { PropertyCardSkeleton } from '../../components/site/PropertyCard';
import EmptyState from '../../components/site/EmptyState';
import Field from '../../components/site/Field';
import Modal from '../../components/site/Modal';
import Img from '../../components/site/Img';
import { formatDate, formatNumber, timeAgo } from '../../utils/property';
import { resolveImageUrl } from '../../utils/imageUrl';
import { isPhone, required, todayISO, validate } from '../../utils/validate';
import './Dashboard.css';

const TABS = [
  { id: 'overview', label: 'Overview', icon: LuLayoutDashboard },
  { id: 'saved', label: 'Saved homes', icon: LuHeart },
  { id: 'searches', label: 'Saved searches', icon: LuBookmark },
  { id: 'applications', label: 'Applications', icon: LuFileText },
  { id: 'payments', label: 'Rent & payments', icon: LuCreditCard },
  { id: 'maintenance', label: 'Maintenance', icon: LuWrench },
  { id: 'notifications', label: 'Notifications', icon: LuBell },
  { id: 'profile', label: 'Profile', icon: LuUser },
];

const listOf = (res) => (Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : []);

function useApiList(path) {
  const [state, setState] = useState({ items: [], loading: true, error: '' });
  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: '' }));
    try {
      const res = await api.request(path);
      setState({ items: listOf(res), loading: false, error: '' });
    } catch (e) {
      setState({ items: [], loading: false, error: e?.response?.data?.message || 'Could not load data.' });
    }
  }, [path]);
  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load };
}

const STATUS_TONE = {
  pending: 'warning', submitted: 'warning', open: 'warning', 'in progress': 'info', inprogress: 'info', review: 'info', new: 'info',
  accepted: 'success', approved: 'success', paid: 'success', completed: 'success', resolved: 'success', closed: 'success', verified: 'success', confirmed: 'success',
  rejected: 'danger', declined: 'danger', cancelled: 'danger', failed: 'danger', overdue: 'danger',
};
function Status({ value }) {
  const v = String(value || 'Pending');
  const tone = STATUS_TONE[v.toLowerCase()] || 'info';
  return <span className={`r-badge r-badge--${tone}`}>{v.charAt(0).toUpperCase() + v.slice(1)}</span>;
}

function Panel({ title, action, children }) {
  return (
    <section className="db-panel">
      {(title || action) ? <header className="db-panel__head"><h2>{title}</h2>{action}</header> : null}
      {children}
    </section>
  );
}

function RowsSkeleton({ n = 3 }) {
  return <div style={{ display: 'grid', gap: 10 }}>{Array.from({ length: n }).map((_, i) => <div key={i} className="r-skel" style={{ height: 72, borderRadius: 14 }} />)}</div>;
}

function ErrorRow({ message, onRetry }) {
  return (
    <div className="r-alert r-alert--error" style={{ alignItems: 'center' }}>
      <LuCircleAlert size={18} /><span style={{ flex: 1 }}>{message}</span>
      <button type="button" className="r-btn r-btn--sm" onClick={onRetry}><LuRefreshCw size={14} /> Retry</button>
    </div>
  );
}

/* ---------------- Overview ---------------- */
function Overview({ user, setTab, favCount }) {
  const apps = useApiList('/applications/me');
  const pays = useApiList('/payments/me');
  const maint = useApiList('/maintenance');
  const openMaint = maint.items.filter((m) => !/resolved|closed|completed/i.test(m.status || '')).length;
  const paid = pays.items.filter((p) => /approved|paid|completed|verified/i.test(p.status || '')).reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const stats = [
    { label: 'Saved homes', value: favCount, icon: LuHeart, tab: 'saved' },
    { label: 'Applications', value: apps.loading ? '–' : apps.items.length, icon: LuFileText, tab: 'applications' },
    { label: 'Paid (verified)', value: pays.loading ? '–' : `PKR ${formatNumber(paid)}`, icon: LuCreditCard, tab: 'payments' },
    { label: 'Open requests', value: maint.loading ? '–' : openMaint, icon: LuWrench, tab: 'maintenance' },
  ];
  return (
    <>
      <div className="db-stats">
        {stats.map((s, i) => (
          <motion.button key={s.label} type="button" className="db-stat" onClick={() => setTab(s.tab)} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <span className="db-stat__icon"><s.icon size={18} /></span>
            <strong>{s.value}</strong>
            <span>{s.label}</span>
          </motion.button>
        ))}
      </div>
      <div className="db-two">
        <Panel title="Recent applications" action={<button type="button" className="r-link db-linkbtn" onClick={() => setTab('applications')}>View all <LuArrowRight size={14} /></button>}>
          {apps.loading ? <RowsSkeleton n={2} /> : apps.items.length ? (
            <ul className="db-rows">
              {apps.items.slice(0, 3).map((a) => (
                <li key={a._id} className="db-row">
                  <div className="db-row__main"><strong>{a.propertyTitle || 'Rental application'}</strong><span>Submitted {timeAgo(a.submittedAt || a.createdAt).toLowerCase()}</span></div>
                  <Status value={a.applicationStatus} />
                </li>
              ))}
            </ul>
          ) : <p className="r-muted">You haven&apos;t applied for a property yet. <Link className="r-link" to="/properties">Find a home</Link></p>}
        </Panel>
        <Panel title="Quick actions">
          <div className="db-actions">
            <Link to="/properties" className="db-action"><LuSearch size={18} /><span>Browse properties</span></Link>
            <button type="button" className="db-action" onClick={() => setTab('payments')}><LuCreditCard size={18} /><span>Submit a rent payment</span></button>
            <button type="button" className="db-action" onClick={() => setTab('maintenance')}><LuWrench size={18} /><span>Report a maintenance issue</span></button>
            <button type="button" className="db-action" onClick={() => setTab('profile')}><LuUser size={18} /><span>Update your profile</span></button>
          </div>
          {!user?.phone ? <p className="r-hint" style={{ marginTop: 14 }}>Tip: add your phone number in Profile so agents can reach you about visits.</p> : null}
        </Panel>
      </div>
    </>
  );
}

/* ---------------- Saved homes ---------------- */
function Saved() {
  const { items, loading } = useProperties();
  const { favorites } = useFavoriteIds();
  const dispatch = useDispatch();
  useEffect(() => { syncFavorites(dispatch).catch(() => {}); }, [dispatch]);
  const saved = items.filter((p) => favorites.includes(`property:${p.id}`));
  if (loading) return <div className="r-grid r-grid--3">{[0, 1, 2].map((i) => <PropertyCardSkeleton key={i} />)}</div>;
  if (!saved.length) {
    return <EmptyState icon={LuHeart} title="No saved homes yet" action={<Link to="/properties" className="r-btn r-btn--primary">Browse properties</Link>}>Tap the heart on any listing to keep it on your shortlist.</EmptyState>;
  }
  return <div className="r-grid r-grid--3">{saved.map((p) => <PropertyCard key={p.id} property={p} />)}</div>;
}

/* ---------------- Saved searches ---------------- */
const describeFilters = (f = {}) => {
  const parts = [];
  if (f.purpose) parts.push(f.purpose === 'Sale' ? 'For sale' : 'For rent');
  if (f.type) parts.push(f.type);
  if (f.area) parts.push(f.area);
  if (f.minPrice) parts.push(`from PKR ${formatNumber(f.minPrice)}`);
  if (f.maxPrice) parts.push(`up to PKR ${formatNumber(f.maxPrice)}`);
  if (f.beds) parts.push(`${f.beds}+ beds`);
  if (f.baths) parts.push(`${f.baths}+ baths`);
  if (f.q) parts.push(`“${f.q}”`);
  return parts.join(' · ') || 'All properties';
};
function Searches() {
  const list = useApiList('/saved-searches');
  const remove = async (id) => {
    const res = await savedSearchService.deleteSavedSearch(id);
    if (res?.success) { toast.success('Saved search removed'); list.reload(); } else toast.error('Could not remove this search.');
  };
  if (list.loading) return <RowsSkeleton />;
  if (list.error) return <ErrorRow message={list.error} onRetry={list.reload} />;
  if (!list.items.length) {
    return <EmptyState icon={LuBookmark} title="No saved searches" action={<Link to="/properties" className="r-btn r-btn--primary">Start a search</Link>}>Use “Save search” on the listings page to come back to your filters in one click.</EmptyState>;
  }
  return (
    <ul className="db-rows">
      {list.items.map((s) => {
        const qs = new URLSearchParams(Object.entries(s.filters || {}).filter(([, v]) => v)).toString();
        return (
          <li key={s._id} className="db-row">
            <span className="db-row__icon"><LuSearch size={18} /></span>
            <div className="db-row__main"><strong>{s.name}</strong><span>{describeFilters(s.filters)} · saved {formatDate(s.createdAt)}</span></div>
            <Link to={`/properties${qs ? `?${qs}` : ''}`} className="r-btn r-btn--sm">Run search</Link>
            <button type="button" className="r-btn r-btn--sm r-btn--icon r-btn--ghost" onClick={() => remove(s._id)} aria-label={`Delete ${s.name}`}><LuTrash2 size={16} /></button>
          </li>
        );
      })}
    </ul>
  );
}

/* ---------------- Applications ---------------- */
function Applications() {
  const apps = useApiList('/applications/me');
  const bookings = useApiList('/bookings/me');
  const inquiries = useApiList('/property-inquiries');
  const download = async (id) => {
    try { await downloadRentalAgreement(id); } catch { toast.error('The agreement is not available yet.'); }
  };
  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <Panel title="Rental applications">
        {apps.loading ? <RowsSkeleton n={2} /> : apps.error ? <ErrorRow message={apps.error} onRetry={apps.reload} /> : apps.items.length ? (
          <ul className="db-rows">
            {apps.items.map((a) => (
              <li key={a._id} className="db-row db-row--wrap">
                <div className="db-row__main">
                  <Link to={`/properties/${a.propertyId}`}><strong>{a.propertyTitle || 'Property'}</strong></Link>
                  <span>PKR {formatNumber(a.rent)}/month · move-in {formatDate(a.moveInDate)} · {a.rentalDuration || '—'} · submitted {formatDate(a.submittedAt)}</span>
                  {a.applicationStatus === 'rejected' && a.rejectionReason ? <span className="r-error">Reason: {a.rejectionReason}</span> : null}
                </div>
                <Status value={a.applicationStatus} />
                {a.agreementPath ? <button type="button" className="r-btn r-btn--sm" onClick={() => download(a._id)}><LuDownload size={14} /> Agreement</button> : null}
              </li>
            ))}
          </ul>
        ) : <EmptyState icon={LuFileText} title="No applications yet" action={<Link to="/properties?purpose=Rent" className="r-btn r-btn--primary">Find a rental</Link>}>Open any rental listing and choose “Apply to rent”.</EmptyState>}
      </Panel>
      {bookings.items.length ? (
        <Panel title="Bookings">
          <ul className="db-rows">
            {bookings.items.map((b) => (
              <li key={b._id} className="db-row">
                <div className="db-row__main"><strong>{b.propertyTitle || b.propertyName}</strong><span>PKR {formatNumber(b.amount || b.rent)} · {formatDate(b.createdAt)}</span></div>
                <Status value={b.bookingStatus || b.status} />
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
      <Panel title="Visit requests & enquiries">
        {inquiries.loading ? <RowsSkeleton n={2} /> : inquiries.items.length ? (
          <ul className="db-rows">
            {inquiries.items.map((q) => (
              <li key={q._id || q.id} className="db-row db-row--wrap">
                <div className="db-row__main">
                  <strong>{q.propertyTitle || q.propertyName || 'General enquiry'}</strong>
                  <span>{[q.inquiryType || q.type || 'Enquiry', formatDate(q.createdAt)].join(' · ')}</span>
                  <span className="db-quote">{q.message}</span>
                </div>
                <Status value={q.status || 'New'} />
              </li>
            ))}
          </ul>
        ) : <p className="r-muted">Visit requests and messages you send from a listing appear here.</p>}
      </Panel>
    </div>
  );
}

/* ---------------- Payments ---------------- */
const METHODS = ['Bank Transfer', 'JazzCash', 'Easypaisa', 'Cash', 'Cheque', 'Card'];
const checkReceipt = (file) => {
  if (!file) return '';
  if (!/^image\/(jpe?g|png|webp)$/.test(file.type)) return 'Upload a JPG, PNG or WebP photo of the receipt.';
  if (file.size > 5 * 1024 * 1024) return 'Receipt image must be smaller than 5 MB.';
  return '';
};
/** Uploads a receipt via POST /api/uploads (any signed-in user) and returns its URL. */
async function uploadReceipt(file) {
  const fd = new FormData();
  fd.append('image', file);
  const res = await api.request('/uploads', { method: 'POST', body: fd });
  return res?.data?.url || '';
}
function ReceiptInput({ file, onChange, error }) {
  const ref = useRef(null);
  return (
    <div className="r-field span-2">
      <span className="r-label">Payment receipt (photo or screenshot)</span>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" className="r-btn r-btn--sm" onClick={() => ref.current?.click()}><LuPaperclip size={15} /> {file ? 'Change file' : 'Attach receipt'}</button>
        {file ? (
          <span className="r-small" style={{ display: 'inline-flex', gap: 6, alignItems: 'center', minWidth: 0 }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>{file.name}</span>
            <button type="button" className="r-btn r-btn--ghost r-btn--icon r-btn--sm" onClick={() => onChange(null)} aria-label="Remove receipt"><LuX size={14} /></button>
          </span>
        ) : <span className="r-hint">JPG, PNG or WebP, up to 5 MB</span>}
      </div>
      <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { onChange(e.target.files?.[0] || null); e.target.value = ''; }} />
      {error ? <span className="r-error" role="alert">{error}</span> : null}
    </div>
  );
}
function PaymentForm({ onDone, user, applications }) {
  const accepted = applications.filter((a) => /accepted|approved/i.test(a.applicationStatus || ''));
  const [v, setV] = useState({ propertyId: accepted[0]?.propertyId || '', amount: accepted[0]?.rent ? String(accepted[0].rent) : '', paymentType: 'Rent', method: 'Bank Transfer', transactionId: '', paymentDate: todayISO(0), notes: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const on = (k) => (e) => { setV((s) => ({ ...s, [k]: e.target.value })); setErrors((x) => ({ ...x, [k]: '' })); };
  const submit = async (e) => {
    e.preventDefault();
    const errs = validate(v, {
      amount: [[(a) => Number(a) > 0, 'Enter the amount you paid.']],
      transactionId: [[(t, all) => all.method === 'Cash' || Boolean(receipt) || required(t), 'Enter the transaction / reference number or attach a receipt.']],
      paymentDate: [[required, 'Choose the payment date.'], [(d) => d <= todayISO(0), 'Payment date cannot be in the future.']],
    });
    const receiptErr = checkReceipt(receipt);
    if (receiptErr) errs.receipt = receiptErr;
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    const app = accepted.find((a) => a.propertyId === v.propertyId);
    try {
      const proofUrl = receipt ? await uploadReceipt(receipt) : '';
      const notes = [v.notes.trim(), proofUrl ? `Receipt: ${proofUrl}` : ''].filter(Boolean).join('\n');
      await api.request('/payments', { method: 'POST', body: { ...v, notes, proofImage: proofUrl, amount: Number(v.amount), propertyName: app?.propertyTitle || '', userName: user?.name, userPhone: user?.phone } });
      toast.success('Payment submitted for verification');
      onDone();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not submit the payment.');
    } finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} noValidate className="r-form-grid">
      <Field className="span-2" label="Property" as="select" name="propertyId" value={v.propertyId} onChange={(e) => { const app = accepted.find((a) => a.propertyId === e.target.value); setV((s) => ({ ...s, propertyId: e.target.value, amount: app?.rent ? String(app.rent) : s.amount })); }} hint={accepted.length ? '' : 'Payments are usually linked to an accepted application.'}>
        <option value="">{accepted.length ? 'Select property' : 'Not linked to a property'}</option>
        {accepted.map((a) => <option key={a._id} value={a.propertyId}>{a.propertyTitle}</option>)}
      </Field>
      <Field label="Amount (PKR)" name="amount" type="number" min={1} value={v.amount} onChange={on('amount')} error={errors.amount} />
      <Field label="Payment for" as="select" name="paymentType" value={v.paymentType} onChange={on('paymentType')}>
        {['Rent', 'Advance', 'Security Deposit', 'Utility', 'Other'].map((t) => <option key={t}>{t}</option>)}
      </Field>
      <Field label="Method" as="select" name="method" value={v.method} onChange={on('method')}>{METHODS.map((m) => <option key={m}>{m}</option>)}</Field>
      <Field label="Payment date" name="paymentDate" type="date" max={todayISO(0)} value={v.paymentDate} onChange={on('paymentDate')} error={errors.paymentDate} />
      <Field className="span-2" label="Transaction / reference no." name="transactionId" value={v.transactionId} onChange={on('transactionId')} error={errors.transactionId} placeholder="e.g. FT2311XXXX" />
      <ReceiptInput file={receipt} onChange={(fl) => { setReceipt(fl); setErrors((x) => ({ ...x, receipt: '', transactionId: '' })); }} error={errors.receipt} />
      <Field className="span-2" label="Notes (optional)" as="textarea" name="notes" rows={2} style={{ minHeight: 70 }} value={v.notes} onChange={on('notes')} />
      <div className="span-2" style={{ display: 'flex', justifyContent: 'flex-end' }}><button type="submit" className="r-btn r-btn--primary" disabled={busy}>{busy ? 'Submitting…' : 'Submit for verification'}</button></div>
    </form>
  );
}
/** Pay a specific rent record: POST /api/rents/:id/pay (multipart, field "proof"). */
function RentPayForm({ record, onDone }) {
  const due = Number(record.remaining || record.monthlyRent) || 0;
  const [v, setV] = useState({ amount: due ? String(due) : '', method: 'Bank Transfer', transactionId: '' });
  const [receipt, setReceipt] = useState(null);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const on = (k) => (e) => { setV((s) => ({ ...s, [k]: e.target.value })); setErrors((x) => ({ ...x, [k]: '' })); };
  const submit = async (e) => {
    e.preventDefault();
    const errs = validate(v, {
      amount: [[(a) => Number(a) > 0, 'Enter the amount you paid.']],
      transactionId: [[(t) => Boolean(receipt) || required(t), 'Attach a receipt or enter the transaction ID.']],
    });
    const receiptErr = checkReceipt(receipt);
    if (receiptErr) errs.receipt = receiptErr;
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    const fd = new FormData();
    fd.append('amount', String(Number(v.amount)));
    fd.append('method', v.method);
    fd.append('transactionId', v.transactionId.trim());
    if (receipt) fd.append('proof', receipt);
    try {
      await api.request(`/rents/${record._id}/pay`, { method: 'POST', body: fd });
      toast.success('Rent payment submitted for verification');
      onDone();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not submit the rent payment.');
    } finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} noValidate className="r-form-grid">
      <Field label="Amount (PKR)" name="amount" type="number" min={1} value={v.amount} onChange={on('amount')} error={errors.amount} />
      <Field label="Method" as="select" name="method" value={v.method} onChange={on('method')}>{METHODS.map((m) => <option key={m}>{m}</option>)}</Field>
      <Field className="span-2" label="Transaction / reference no." name="transactionId" value={v.transactionId} onChange={on('transactionId')} error={errors.transactionId} placeholder="e.g. FT2311XXXX" />
      <ReceiptInput file={receipt} onChange={(fl) => { setReceipt(fl); setErrors((x) => ({ ...x, receipt: '', transactionId: '' })); }} error={errors.receipt} />
      <div className="span-2" style={{ display: 'flex', justifyContent: 'flex-end' }}><button type="submit" className="r-btn r-btn--primary" disabled={busy}>{busy ? 'Submitting…' : 'Submit payment'}</button></div>
    </form>
  );
}

const rentStatus = (r) => {
  if (r.status !== 'Paid' && r.verification === 'submitted') return 'Under review';
  if (r.status !== 'Paid' && r.verification === 'rejected') return 'Rejected';
  return r.status;
};

function Payments({ user }) {
  const pays = useApiList('/payments/me');
  const apps = useApiList('/applications/me');
  const rents = useApiList('/rents');
  const [open, setOpen] = useState(false);
  const [payRecord, setPayRecord] = useState(null);
  const total = pays.items.filter((p) => /approved|paid|completed|verified/i.test(p.status || '')).reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const pending = pays.items.filter((p) => /pending/i.test(p.status || '')).length;
  return (
    <>
      <div className="db-stats db-stats--3">
        <div className="db-stat"><span className="db-stat__icon"><LuCheck size={18} /></span><strong>PKR {formatNumber(total)}</strong><span>Verified payments</span></div>
        <div className="db-stat"><span className="db-stat__icon"><LuRefreshCw size={18} /></span><strong>{pending}</strong><span>Awaiting verification</span></div>
        <button type="button" className="db-stat db-stat--cta" onClick={() => setOpen(true)}><span className="db-stat__icon"><LuPlus size={18} /></span><strong>Submit payment</strong><span>Upload a rent payment for review</span></button>
      </div>
      {rents.items.length ? (
        <div style={{ marginBottom: 20 }}>
          <Panel title="Monthly rent">
            <ul className="db-rows">
              {rents.items.map((r) => {
                const canPay = r.status !== 'Paid' && r.verification !== 'submitted';
                return (
                  <li key={r._id} className="db-row db-row--wrap">
                    <span className="db-row__icon"><LuCreditCard size={18} /></span>
                    <div className="db-row__main">
                      <strong>{r.month || formatDate(r.dueDate)} · PKR {formatNumber(r.monthlyRent)}</strong>
                      <span>{[r.propertyName, `due ${formatDate(r.dueDate)}`, r.remaining && r.status !== 'Paid' ? `PKR ${formatNumber(r.remaining)} remaining` : ''].filter(Boolean).join(' · ')}</span>
                      {r.adminNote ? <span className="db-note"><strong>Note from RMS:</strong> {r.adminNote}</span> : null}
                    </div>
                    <Status value={rentStatus(r)} />
                    {canPay ? <button type="button" className="r-btn r-btn--primary r-btn--sm" onClick={() => setPayRecord(r)}>Pay now</button> : null}
                  </li>
                );
              })}
            </ul>
          </Panel>
        </div>
      ) : null}
      <Panel title="Payment history">
        {pays.loading ? <RowsSkeleton /> : pays.error ? <ErrorRow message={pays.error} onRetry={pays.reload} /> : pays.items.length ? (
          <div className="db-table-wrap">
            <table className="db-table">
              <thead><tr><th>Date</th><th>Property</th><th>Type</th><th>Method</th><th>Reference</th><th style={{ textAlign: 'right' }}>Amount</th><th>Status</th></tr></thead>
              <tbody>
                {pays.items.map((p) => (
                  <tr key={p._id}>
                    <td>{formatDate(p.paymentDate || p.createdAt)}</td>
                    <td>{p.propertyName || '—'}</td>
                    <td>{p.paymentType || '—'}</td>
                    <td>{p.method || '—'}</td>
                    <td className="db-mono">{p.transactionId || p.reference || '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>PKR {formatNumber(p.amount)}</td>
                    <td><Status value={p.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState icon={LuCreditCard} title="No payments yet" action={<button type="button" className="r-btn r-btn--primary" onClick={() => setOpen(true)}>Submit a payment</button>}>Once you pay rent, submit the transaction reference here and our team will verify it.</EmptyState>}
      </Panel>
      <Modal open={open} onClose={() => setOpen(false)} title="Submit a payment" subtitle="Our accounts team verifies every payment, usually within one working day." width={600}>
        <PaymentForm user={user} applications={apps.items} onDone={() => { setOpen(false); pays.reload(); }} />
      </Modal>
      <Modal open={Boolean(payRecord)} onClose={() => setPayRecord(null)} title="Pay rent" subtitle={payRecord ? `${payRecord.month || formatDate(payRecord.dueDate)} · ${payRecord.propertyName || 'Your rental'}` : ''} width={560}>
        {payRecord ? <RentPayForm record={payRecord} onDone={() => { setPayRecord(null); rents.reload(); pays.reload(); }} /> : null}
      </Modal>
    </>
  );
}

/* ---------------- Maintenance ---------------- */
const CATEGORIES = ['Plumbing', 'Electrical', 'Air conditioning', 'Appliances', 'Carpentry', 'Painting', 'Pest control', 'Security', 'General'];
function MaintenanceForm({ onDone, applications }) {
  const props = applications.filter((a) => /accepted|approved/i.test(a.applicationStatus || ''));
  const [v, setV] = useState({ propertyId: props[0]?.propertyId || '', title: '', category: 'Plumbing', priority: 'Medium', description: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const on = (k) => (e) => { setV((s) => ({ ...s, [k]: e.target.value })); setErrors((x) => ({ ...x, [k]: '' })); };
  const submit = async (e) => {
    e.preventDefault();
    const errs = validate(v, {
      title: [[(t) => String(t).trim().length >= 5, 'Give the issue a short title (5+ characters).']],
      description: [[(d) => String(d).trim().length >= 15, 'Describe the problem in a bit more detail (15+ characters).']],
    });
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    const app = props.find((a) => a.propertyId === v.propertyId);
    try {
      await api.request('/maintenance', { method: 'POST', body: { ...v, title: v.title.trim(), description: v.description.trim(), propertyName: app?.propertyTitle || '' } });
      toast.success('Maintenance request submitted');
      onDone();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not submit the request.');
    } finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} noValidate className="r-form-grid">
      {props.length ? (
        <Field className="span-2" label="Property" as="select" name="propertyId" value={v.propertyId} onChange={on('propertyId')}>
          {props.map((a) => <option key={a._id} value={a.propertyId}>{a.propertyTitle}</option>)}
        </Field>
      ) : null}
      <Field className="span-2" label="Issue" name="title" value={v.title} onChange={on('title')} error={errors.title} placeholder="e.g. Kitchen tap leaking" />
      <Field label="Category" as="select" name="category" value={v.category} onChange={on('category')}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Field>
      <Field label="Priority" as="select" name="priority" value={v.priority} onChange={on('priority')}>{['Low', 'Medium', 'High', 'Urgent'].map((c) => <option key={c}>{c}</option>)}</Field>
      <Field className="span-2" label="Details" as="textarea" name="description" rows={4} value={v.description} onChange={on('description')} error={errors.description} placeholder="Where is the problem, when did it start, and when can our technician visit?" />
      <div className="span-2" style={{ display: 'flex', justifyContent: 'flex-end' }}><button type="submit" className="r-btn r-btn--primary" disabled={busy}>{busy ? 'Submitting…' : 'Submit request'}</button></div>
    </form>
  );
}
function Maintenance() {
  const list = useApiList('/maintenance');
  const apps = useApiList('/applications/me');
  const [open, setOpen] = useState(false);
  const cancel = async (m) => {
    if (!window.confirm(`Cancel the request "${m.title}"?`)) return;
    try {
      await api.request(`/maintenance/${m._id}`, { method: 'DELETE' });
      toast.success('Request cancelled');
      list.reload();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not cancel this request.');
    }
  };
  return (
    <Panel title="Maintenance requests" action={<button type="button" className="r-btn r-btn--primary r-btn--sm" onClick={() => setOpen(true)}><LuPlus size={15} /> New request</button>}>
      {list.loading ? <RowsSkeleton /> : list.error ? <ErrorRow message={list.error} onRetry={list.reload} /> : list.items.length ? (
        <ul className="db-rows">
          {list.items.map((m) => (
            <li key={m._id} className="db-row db-row--wrap">
              <span className="db-row__icon"><LuWrench size={18} /></span>
              <div className="db-row__main">
                <strong>{m.title}</strong>
                <span>{[m.category, `${m.priority} priority`, m.propertyName, formatDate(m.createdAt)].filter(Boolean).join(' · ')}</span>
                {m.description ? <span className="db-quote">{m.description}</span> : null}
                {m.adminNotes ? <span className="db-note"><strong>Update from RMS:</strong> {m.adminNotes}</span> : null}
              </div>
              <Status value={m.status} />
              {String(m.status || '').toLowerCase() === 'open' ? <button type="button" className="r-btn r-btn--sm r-btn--ghost" onClick={() => cancel(m)}>Cancel</button> : null}
            </li>
          ))}
        </ul>
      ) : <EmptyState icon={LuWrench} title="No maintenance requests" action={<button type="button" className="r-btn r-btn--primary" onClick={() => setOpen(true)}>Report an issue</button>}>Something not working at home? Report it here and track it until it&apos;s fixed.</EmptyState>}
      <Modal open={open} onClose={() => setOpen(false)} title="Report a maintenance issue" subtitle="Urgent issues (water, electricity, security) are attended the same day." width={600}>
        <MaintenanceForm applications={apps.items} onDone={() => { setOpen(false); list.reload(); }} />
      </Modal>
    </Panel>
  );
}

/* ---------------- Notifications ---------------- */
function Notifications() {
  const [state, setState] = useState({ items: [], loading: true, error: false });
  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    const res = await fetchNotificationsFromServer();
    setState({ items: res?.success ? res.data : [], loading: false, error: !res?.success });
  }, []);
  useEffect(() => { load(); }, [load]);
  const markRead = async (id) => {
    const res = await markNotificationAsReadOnServer(id);
    if (res?.success) setState((s) => ({ ...s, items: s.items.map((n) => (n.id === id ? { ...n, unread: false } : n)) }));
  };
  const markAll = async () => {
    const res = await markAllNotificationsOnServer();
    if (res?.success !== false) setState((s) => ({ ...s, items: s.items.map((n) => ({ ...n, unread: false })) }));
  };
  const remove = async (id) => {
    const res = await deleteNotificationOnServer(id);
    if (res?.success !== false) setState((s) => ({ ...s, items: s.items.filter((n) => n.id !== id) }));
  };
  const unread = state.items.filter((n) => n.unread).length;
  return (
    <Panel title={`Notifications${unread ? ` (${unread} unread)` : ''}`} action={unread ? <button type="button" className="r-btn r-btn--sm" onClick={markAll}><LuCheck size={14} /> Mark all read</button> : null}>
      {state.loading ? <RowsSkeleton /> : state.error ? <ErrorRow message="Could not load notifications." onRetry={load} /> : state.items.length ? (
        <ul className="db-rows">
          <AnimatePresence initial={false}>
            {state.items.map((n) => (
              <motion.li key={n.id} className={`db-row db-row--wrap db-notif ${n.unread ? 'is-unread' : ''}`} layout exit={{ opacity: 0, height: 0 }}>
                <span className="db-row__icon"><LuBell size={18} /></span>
                <div className="db-row__main">
                  <strong>{n.title}</strong>
                  <span className="db-quote" style={{ fontStyle: 'normal' }}>{n.message}</span>
                  <span>{timeAgo(n.createdAt)}</span>
                </div>
                {n.agreementApplicationId ? <button type="button" className="r-btn r-btn--sm" onClick={() => downloadRentalAgreement(n.agreementApplicationId).catch(() => toast.error('Agreement not available.'))}><LuDownload size={14} /> Agreement</button> : null}
                {n.unread ? <button type="button" className="r-btn r-btn--sm r-btn--ghost" onClick={() => markRead(n.id)}>Mark read</button> : null}
                <button type="button" className="r-btn r-btn--sm r-btn--icon r-btn--ghost" onClick={() => remove(n.id)} aria-label="Delete notification"><LuTrash2 size={15} /></button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      ) : <EmptyState icon={LuBell} title="You're all caught up">Updates about your applications, payments and requests will appear here.</EmptyState>}
    </Panel>
  );
}

/* ---------------- Profile ---------------- */
function Profile() {
  const { user, setUser } = useAuth();
  const [v, setV] = useState({ name: user?.name || '', phone: user?.phone || '', address: '', city: 'Lahore', occupation: '' });
  const [image, setImage] = useState(user?.profileImage || '');
  const [email, setEmail] = useState(user?.email || '');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    let active = true;
    api.request('/users/profile').then((res) => {
      if (!active) return;
      const d = res?.data || {};
      const pr = d.profile || {};
      setV({ name: d.name || pr.name || '', phone: d.phone || pr.phone || '', address: pr.address || '', city: pr.city || 'Lahore', occupation: pr.occupation || '' });
      setEmail(d.email || '');
      setImage(d.profileImage || pr.profileImage || '');
    }).catch(() => {}).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const on = (k) => (e) => { setV((s) => ({ ...s, [k]: e.target.value })); setErrors((x) => ({ ...x, [k]: '' })); };
  const persistUser = (patch) => {
    const next = { ...user, ...patch };
    setUser(next);
    try { window.localStorage.setItem('rms_auth_session', JSON.stringify(next)); } catch { /* ignore */ }
  };

  const save = async (e) => {
    e.preventDefault();
    const errs = validate(v, {
      name: [[(n) => /^[a-zA-Z\s.'-]{3,60}$/.test(String(n).trim()), 'Use letters only (3–60 characters).']],
      phone: [[(p) => !p || isPhone(p), 'Enter a valid Pakistani number, e.g. 0300 1234567.']],
    });
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const res = await api.request('/users/profile', { method: 'PUT', body: { name: v.name.trim(), fullName: v.name.trim(), phone: v.phone.trim(), address: v.address.trim(), city: v.city.trim(), occupation: v.occupation.trim() } });
      persistUser({ name: res?.data?.name || v.name.trim(), phone: res?.data?.phone || v.phone.trim() });
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not update your profile.');
    } finally { setBusy(false); }
  };

  const upload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!/^image\/(jpe?g|png|webp)$/.test(file.type)) { toast.error('Please choose a JPG, PNG or WebP image.'); return; }
    if (file.size > 3 * 1024 * 1024) { toast.error('Image must be smaller than 3 MB.'); return; }
    const fd = new FormData();
    fd.append('profileImage', file);
    try {
      const res = await api.request('/users/profile-image', { method: 'POST', body: fd });
      const url = res?.data?.profileImage || res?.data?.profile?.profileImage || '';
      if (url) { setImage(url); persistUser({ profileImage: url }); }
      toast.success('Photo updated');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not upload the photo.');
    }
  };

  if (loading) return <RowsSkeleton n={4} />;
  const initials = (v.name || 'U').split(/\s+/).map((s) => s[0]).slice(0, 2).join('').toUpperCase();
  return (
    <Panel title="Your profile">
      <div className="db-profile">
        <div className="db-profile__avatar">
          <div className="db-avatar">{image ? <Img src={resolveImageUrl(image)} alt="Profile" /> : <span>{initials}</span>}</div>
          <button type="button" className="r-btn r-btn--sm" onClick={() => fileRef.current?.click()}><LuCamera size={14} /> Change photo</button>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={upload} />
        </div>
        <form onSubmit={save} noValidate className="r-form-grid" style={{ flex: 1 }}>
          <Field label="Full name" name="name" value={v.name} onChange={on('name')} error={errors.name} autoComplete="name" />
          <Field label="Email" name="email" value={email} disabled hint="Contact support to change your sign-in email." />
          <Field label="Mobile number" name="phone" type="tel" value={v.phone} onChange={on('phone')} error={errors.phone} placeholder="0300 1234567" />
          <Field label="Occupation (optional)" name="occupation" value={v.occupation} onChange={on('occupation')} />
          <Field className="span-2" label="Current address (optional)" name="address" value={v.address} onChange={on('address')} />
          <Field label="City" name="city" value={v.city} onChange={on('city')} />
          <div />
          <div className="span-2" style={{ display: 'flex', justifyContent: 'flex-end' }}><button type="submit" className="r-btn r-btn--primary" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button></div>
        </form>
      </div>
    </Panel>
  );
}

export default function DashboardPage() {
  const [params, setParams] = useSearchParams();
  const { user } = useAuth();
  const { count } = useFavoriteIds();
  const tab = TABS.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'overview';
  const setTab = (id) => setParams(id === 'overview' ? {} : { tab: id });
  const current = useMemo(() => TABS.find((t) => t.id === tab), [tab]);
  const first = (user?.name || '').split(' ')[0];

  return (
    <div className="db">
      <div className="db-hero">
        <div className="r-container">
          <span className="r-eyebrow">My account</span>
          <h1>{tab === 'overview' ? `Welcome${first ? `, ${first}` : ''}` : current.label}</h1>
          <p className="r-muted">{user?.email}</p>
        </div>
      </div>
      <div className="r-container db-layout">
        <nav className="db-nav" aria-label="Dashboard sections">
          {TABS.map((t) => (
            <button key={t.id} type="button" className={`db-nav__item ${tab === t.id ? 'is-active' : ''}`} onClick={() => setTab(t.id)} aria-current={tab === t.id ? 'page' : undefined}>              <t.icon size={17} /><span>{t.label}</span>
              {t.id === 'saved' && count ? <em>{count}</em> : null}
            </button>
          ))}
        </nav>
        <div className="db-content">
          <AnimatePresence mode="wait">
            <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.22 }}>
              {tab === 'overview' && <Overview user={user} setTab={setTab} favCount={count} />}
              {tab === 'saved' && <Saved />}
              {tab === 'searches' && <Searches />}
              {tab === 'applications' && <Applications />}
              {tab === 'payments' && <Payments user={user} />}
              {tab === 'maintenance' && <Maintenance />}
              {tab === 'notifications' && <Notifications />}
              {tab === 'profile' && <Profile />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

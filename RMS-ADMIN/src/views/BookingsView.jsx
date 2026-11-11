import { useMemo, useState } from 'react';
import { CalendarCheck, Check, Eye, Trash2, X } from 'lucide-react';
import { api, assetUrl } from '../lib/api';
import { date, dateTime, matches, money } from '../lib/format';
import {
  Badge, Button, DataTable, DetailList, EmptyState, ErrorState, IconButton, LoadingBlock, Modal, PageHeader, SearchInput, Tabs, useAsync, useConfirm, useToast,
} from '../components/ui';

const STATUSES = ['Pending', 'Approved', 'Rejected', 'Cancelled'];
const bump = () => window.dispatchEvent(new Event('rms-admin:counts-changed'));

function BookingDetail({ booking, onClose, onApprove, onReject }) {
  if (!booking) return null;
  const rows = [
    ['Property', booking.propertyTitle || booking.propertyName], ['Type', booking.propertyType], ['Rent', money(booking.rent || booking.amount)],
    ['Move-in date', date(booking.moveInDate || booking.preferredMoveInDate)], ['Duration', booking.rentalDuration], ['Occupants', booking.occupants],
    ['Message', booking.message || booking.notes], ['Submitted', dateTime(booking.createdAt)], ['Payment status', booking.paymentStatus],
    ['Rejection reason', booking.rejectionReason],
  ];
  const applicant = [
    ['Name', booking.userName || booking.customerName], ['Email', booking.userEmail], ['Phone', booking.userPhone || booking.customerPhone],
    ['CNIC', booking.cnic], ['Employment', [booking.jobTitle, booking.companyName].filter(Boolean).join(' at ')],
    ['Monthly income', booking.monthlyIncome ? money(booking.monthlyIncome) : ''], ['Current city', booking.city],
    ['Previous landlord', [booking.previousLandlordName, booking.previousLandlordPhone].filter(Boolean).join(' · ')],
  ];
  const pending = /^pending/i.test(booking.status);
  return (
    <Modal
      open
      size="lg"
      title={`Booking ${booking.bookingId || ''}`}
      onClose={onClose}
      footer={pending ? (
        <>
          <Button variant="danger" icon={X} onClick={() => onReject(booking)}>Reject</Button>
          <Button variant="success" icon={Check} onClick={() => onApprove(booking)}>Approve</Button>
        </>
      ) : <Button onClick={onClose}>Close</Button>}
    >
      <div className="row spread" style={{ marginBottom: 12 }}><Badge>{booking.status}</Badge></div>
      <div className="section-title">Booking</div>
      <DetailList items={rows} />
      <div className="section-title">Applicant</div>
      <DetailList items={applicant} />
      {(booking.profileImage || booking.cnicImage) && (
        <>
          <div className="section-title">Documents</div>
          <div className="row row-wrap">
            {booking.profileImage && <a href={assetUrl(booking.profileImage)} target="_blank" rel="noreferrer"><img src={assetUrl(booking.profileImage)} alt="Profile" style={{ width: 120, height: 90, objectFit: 'cover', borderRadius: 8 }} /></a>}
            {booking.cnicImage && <a href={assetUrl(booking.cnicImage)} target="_blank" rel="noreferrer"><img src={assetUrl(booking.cnicImage)} alt="CNIC" style={{ width: 160, height: 90, objectFit: 'cover', borderRadius: 8 }} /></a>}
          </div>
        </>
      )}
    </Modal>
  );
}

export default function BookingsView() {
  const toast = useToast();
  const confirm = useConfirm();
  const [tab, setTab] = useState('Pending');
  const [search, setSearch] = useState('');
  const [viewing, setViewing] = useState(null);
  const { data, loading, error, reload, setData } = useAsync(() => api.get('/bookings').then((r) => r.data), []);

  const all = useMemo(() => data || [], [data]);
  const statusOf = (b) => (STATUSES.find((s) => s.toLowerCase() === String(b.status).toLowerCase()) || b.status);
  const rows = useMemo(() => all.filter((b) => (tab === 'all' || statusOf(b) === tab)
    && matches(b, search, ['userName', 'userEmail', 'userPhone', 'propertyTitle', 'bookingId'])), [all, tab, search]);

  const replace = (updated) => {
    setData((prev) => prev.map((b) => (b._id === updated._id ? updated : b)));
    setViewing((current) => (current?._id === updated._id ? null : current));
  };

  const approve = async (booking) => {
    const ok = await confirm({ title: 'Approve booking?', message: `${booking.userName} will be notified, the property is marked Booked, a rent invoice and tenant record are created.`, confirmLabel: 'Approve', tone: 'success' });
    if (!ok) return;
    try {
      const response = await api.post(`/bookings/${booking._id}/approve`);
      replace(response.data);
      toast.success('Booking approved and tenant notified.');
      bump();
    } catch (err) { toast.error(err.message); }
  };

  const reject = async (booking) => {
    const reason = await confirm({ title: 'Reject booking', message: `Tell ${booking.userName || 'the applicant'} why the booking was rejected. The property becomes available again.`, confirmLabel: 'Reject booking', input: { label: 'Reason', placeholder: 'e.g. Property already rented', required: true } });
    if (!reason) return;
    try {
      const response = await api.post(`/bookings/${booking._id}/reject`, { reason });
      replace(response.data);
      toast.success('Booking rejected.');
      bump();
    } catch (err) { toast.error(err.message); }
  };

  const remove = async (booking) => {
    const ok = await confirm({ title: 'Delete booking?', message: 'The booking record is removed permanently. If it was holding the property, the property becomes available again.', confirmLabel: 'Delete' });
    if (!ok) return;
    try {
      await api.del(`/bookings/${booking._id}`);
      setData((prev) => prev.filter((b) => b._id !== booking._id));
      toast.success('Booking deleted.');
      bump();
    } catch (err) { toast.error(err.message); }
  };

  const countOf = (status) => all.filter((b) => statusOf(b) === status).length;
  const columns = [
    { key: 'user', header: 'Tenant', primary: true, render: (b) => <div><div className="cell-main">{b.userName || '—'}</div><div className="cell-sub">{b.userEmail} {b.userPhone && `· ${b.userPhone}`}</div></div> },
    { key: 'property', header: 'Property', render: (b) => <div className="truncate" style={{ maxWidth: 260 }}>{b.propertyTitle || b.propertyName}</div> },
    { key: 'moveIn', header: 'Move-in', render: (b) => <span className="nowrap">{date(b.moveInDate)}</span> },
    { key: 'rent', header: 'Rent', className: 'num', render: (b) => money(b.rent || b.amount) },
    { key: 'status', header: 'Status', render: (b) => <Badge>{statusOf(b)}</Badge> },
    { key: 'created', header: 'Submitted', render: (b) => <span className="nowrap">{date(b.createdAt)}</span> },
    { key: 'actions', header: '', className: 'num', render: (b) => (
      <div className="actions">
        <IconButton icon={Eye} label="View details" onClick={() => setViewing(b)} />
        {/^pending/i.test(b.status) && <IconButton icon={Check} label="Approve" onClick={() => approve(b)} style={{ color: 'var(--success)' }} />}
        {/^pending/i.test(b.status) && <IconButton icon={X} label="Reject" danger onClick={() => reject(b)} />}
        <IconButton icon={Trash2} label="Delete" danger onClick={() => remove(b)} />
      </div>
    ) },
  ];

  return (
    <>
      <PageHeader title="Bookings" description="Rental bookings submitted from the website. Approving creates the tenant record and first rent invoice." />
      <Tabs value={tab} onChange={setTab} tabs={[...STATUSES.map((s) => ({ value: s, label: s, count: countOf(s) })), { value: 'all', label: 'All', count: all.length }]} />
      <div className="card">
        <div className="toolbar"><SearchInput value={search} onChange={setSearch} placeholder="Search tenant, email, property…" /></div>
        {loading && !data ? <LoadingBlock /> : error ? <ErrorState message={error} onRetry={reload} /> : (
          <DataTable columns={columns} rows={rows} resetKey={`${tab}|${search}`} empty={<EmptyState icon={CalendarCheck} title={`No ${tab === 'all' ? '' : tab.toLowerCase()} bookings`} message="Bookings made on the website appear here." />} />
        )}
      </div>
      <BookingDetail booking={viewing} onClose={() => setViewing(null)} onApprove={approve} onReject={reject} />
    </>
  );
}

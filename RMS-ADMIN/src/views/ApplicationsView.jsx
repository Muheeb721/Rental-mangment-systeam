import { useMemo, useState } from 'react';
import { Check, ClipboardList, Download, Eye, Trash2, X } from 'lucide-react';
import { api, downloadFile } from '../lib/api';
import { date, dateTime, matches, money, titleCase } from '../lib/format';
import {
  Badge, Button, DataTable, DetailList, EmptyState, ErrorState, IconButton, LoadingBlock, Modal, PageHeader, SearchInput, Tabs, useAsync, useConfirm, useToast,
} from '../components/ui';

const STATUSES = ['pending', 'accepted', 'rejected'];
const bump = () => window.dispatchEvent(new Event('rms-admin:counts-changed'));

export default function ApplicationsView() {
  const toast = useToast();
  const confirm = useConfirm();
  const [tab, setTab] = useState('pending');
  const [search, setSearch] = useState('');
  const [viewing, setViewing] = useState(null);
  const { data, loading, error, reload, setData } = useAsync(() => api.get('/applications').then((r) => r.data), []);
  const all = useMemo(() => data || [], [data]);
  const rows = useMemo(() => all.filter((a) => (tab === 'all' || a.applicationStatus === tab)
    && matches(a, search, ['userName', 'userEmail', 'userPhone', 'propertyTitle', 'cnic'])), [all, tab, search]);

  const replace = (updated) => { setData((prev) => prev.map((a) => (a._id === updated._id ? updated : a))); setViewing(null); };

  const accept = async (app) => {
    const ok = await confirm({ title: 'Accept application?', message: `${app.userName} will be notified and "${app.propertyTitle}" will be marked as Booked.`, confirmLabel: 'Accept', tone: 'success' });
    if (!ok) return;
    try {
      const response = await api.put(`/applications/${app._id}/accept`);
      replace(response.data);
      toast.success('Application accepted.');
      bump();
    } catch (err) { toast.error(err.message); }
  };

  const reject = async (app) => {
    const reason = await confirm({ title: 'Reject application', message: 'The applicant will see this reason.', confirmLabel: 'Reject', input: { label: 'Reason', required: true, placeholder: 'e.g. Income does not meet requirements' } });
    if (!reason) return;
    try {
      const response = await api.put(`/applications/${app._id}/reject`, { reason });
      replace(response.data);
      toast.success('Application rejected.');
      bump();
    } catch (err) { toast.error(err.message); }
  };

  const remove = async (app) => {
    const ok = await confirm({ title: 'Delete application?', message: 'This permanently removes the application record.', confirmLabel: 'Delete' });
    if (!ok) return;
    try {
      await api.del(`/applications/${app._id}`);
      setData((prev) => prev.filter((a) => a._id !== app._id));
      toast.success('Application deleted.');
      bump();
    } catch (err) { toast.error(err.message); }
  };

  const download = async (app) => {
    try { await downloadFile(`/applications/${app._id}/agreement`, `rental-agreement-${app._id}.pdf`); } catch (err) { toast.error(err.message); }
  };

  const columns = [
    { key: 'user', header: 'Applicant', primary: true, render: (a) => <div><div className="cell-main">{a.userName || '—'}</div><div className="cell-sub">{a.userEmail}</div></div> },
    { key: 'property', header: 'Property', render: (a) => <div className="truncate" style={{ maxWidth: 260 }}>{a.propertyTitle}</div> },
    { key: 'period', header: 'Period', render: (a) => <span className="nowrap">{date(a.moveInDate)}{a.rentalDuration ? ` · ${a.rentalDuration}` : ''}</span> },
    { key: 'rent', header: 'Rent', className: 'num', render: (a) => money(a.rent) },
    { key: 'status', header: 'Status', render: (a) => <Badge>{titleCase(a.applicationStatus)}</Badge> },
    { key: 'submitted', header: 'Submitted', render: (a) => <span className="nowrap">{date(a.submittedAt)}</span> },
    { key: 'actions', header: '', className: 'num', render: (a) => (
      <div className="actions">
        <IconButton icon={Eye} label="View" onClick={() => setViewing(a)} />
        {a.agreementPath && <IconButton icon={Download} label="Download agreement PDF" onClick={() => download(a)} />}
        {a.applicationStatus === 'pending' && <IconButton icon={Check} label="Accept" onClick={() => accept(a)} style={{ color: 'var(--success)' }} />}
        {a.applicationStatus === 'pending' && <IconButton icon={X} label="Reject" danger onClick={() => reject(a)} />}
        <IconButton icon={Trash2} label="Delete" danger onClick={() => remove(a)} />
      </div>
    ) },
  ];

  return (
    <>
      <PageHeader title="Rent applications" description="Formal rental applications with auto-generated agreements." />
      <Tabs value={tab} onChange={setTab} tabs={[...STATUSES.map((s) => ({ value: s, label: titleCase(s), count: all.filter((a) => a.applicationStatus === s).length })), { value: 'all', label: 'All', count: all.length }]} />
      <div className="card">
        <div className="toolbar"><SearchInput value={search} onChange={setSearch} placeholder="Search applicant, CNIC, property…" /></div>
        {loading && !data ? <LoadingBlock /> : error ? <ErrorState message={error} onRetry={reload} /> : (
          <DataTable columns={columns} rows={rows} resetKey={`${tab}|${search}`} empty={<EmptyState icon={ClipboardList} title="No applications" message="Rent applications submitted on the website appear here." />} />
        )}
      </div>
      {viewing && (
        <Modal
          open
          size="lg"
          title="Rent application"
          onClose={() => setViewing(null)}
          footer={viewing.applicationStatus === 'pending' ? (
            <><Button variant="danger" icon={X} onClick={() => reject(viewing)}>Reject</Button><Button variant="success" icon={Check} onClick={() => accept(viewing)}>Accept</Button></>
          ) : <Button onClick={() => setViewing(null)}>Close</Button>}
        >
          <Badge>{titleCase(viewing.applicationStatus)}</Badge>
          <div className="section-title mt-16">Applicant</div>
          <DetailList items={[['Name', viewing.userName], ['Email', viewing.userEmail], ['Phone', viewing.userPhone], ['CNIC', viewing.cnic], ['Occupants', viewing.occupants]]} />
          <div className="section-title">Rental</div>
          <DetailList items={[['Property', viewing.propertyTitle], ['Type', viewing.propertyType], ['Rent', money(viewing.rent)], ['Move-in', date(viewing.moveInDate)], ['Ends', date(viewing.rentalEndDate)], ['Duration', viewing.rentalDuration], ['Notes', viewing.notes], ['Submitted', dateTime(viewing.submittedAt)], ['Rejection reason', viewing.rejectionReason]]} />
          {viewing.agreementPath && <Button className="mt-16" icon={Download} onClick={() => download(viewing)}>Download agreement (PDF)</Button>}
        </Modal>
      )}
    </>
  );
}

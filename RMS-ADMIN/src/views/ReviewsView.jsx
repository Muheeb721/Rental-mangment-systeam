import { useMemo, useState } from 'react';
import { Eye, EyeOff, Star, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { date, matches } from '../lib/format';
import {
  Badge, DataTable, EmptyState, ErrorState, IconButton, LoadingBlock, PageHeader, SearchInput, Select, StatCard, Stars, useAsync, useConfirm, useToast,
} from '../components/ui';

export default function ReviewsView() {
  const toast = useToast();
  const confirm = useConfirm();
  const [status, setStatus] = useState('all');
  const [rating, setRating] = useState('all');
  const [search, setSearch] = useState('');
  const { data, loading, error, reload, setData } = useAsync(() => api.get('/reviews/admin/all').then((r) => r.data), []);
  const all = useMemo(() => data || [], [data]);
  const rows = useMemo(() => all.filter((r) => (status === 'all' || (r.status || 'Approved') === status)
    && (rating === 'all' || Number(r.rating) === Number(rating))
    && matches(r, search, ['userName', 'propertyName', 'comment'])), [all, status, rating, search]);
  const average = all.length ? (all.reduce((sum, r) => sum + Number(r.rating || 0), 0) / all.length).toFixed(1) : '—';

  const toggle = async (review) => {
    const next = review.status === 'Hidden' ? 'Approved' : 'Hidden';
    try {
      const response = await api.patch(`/reviews/${review._id}`, { status: next });
      setData((prev) => prev.map((r) => (r._id === review._id ? response.data : r)));
      toast.success(next === 'Hidden' ? 'Review hidden from the website.' : 'Review published.');
    } catch (err) { toast.error(err.message); }
  };
  const remove = async (review) => {
    const ok = await confirm({ title: 'Delete review?', message: `The review by ${review.userName} will be removed permanently.`, confirmLabel: 'Delete' });
    if (!ok) return;
    try {
      await api.del(`/reviews/${review._id}`);
      setData((prev) => prev.filter((r) => r._id !== review._id));
      toast.success('Review deleted.');
    } catch (err) { toast.error(err.message); }
  };

  const columns = [
    { key: 'user', header: 'Reviewer', primary: true, render: (r) => <div><div className="cell-main">{r.userName || 'Anonymous'}</div><div className="cell-sub">{date(r.createdAt)}</div></div> },
    { key: 'property', header: 'Property', render: (r) => <div className="truncate" style={{ maxWidth: 240 }}>{r.propertyName || 'General'}</div> },
    { key: 'rating', header: 'Rating', render: (r) => <Stars value={r.rating} /> },
    { key: 'comment', header: 'Comment', render: (r) => <div style={{ maxWidth: 380 }} className="small">{r.comment}</div> },
    { key: 'status', header: 'Visibility', render: (r) => <Badge tone={r.status === 'Hidden' ? 'red' : 'green'}>{r.status === 'Hidden' ? 'Hidden' : 'Published'}</Badge> },
    { key: 'actions', header: '', className: 'num', render: (r) => (
      <div className="actions">
        <IconButton icon={r.status === 'Hidden' ? Eye : EyeOff} label={r.status === 'Hidden' ? 'Publish' : 'Hide from website'} onClick={() => toggle(r)} />
        <IconButton icon={Trash2} label="Delete" danger onClick={() => remove(r)} />
      </div>
    ) },
  ];

  return (
    <>
      <PageHeader title="Reviews" description="Moderate reviews that residents post on property pages." />
      <div className="grid grid-3" style={{ marginBottom: 16 }}>
        <StatCard icon={Star} tone="amber" label="Average rating" value={average} hint={`${all.length} reviews`} />
        <StatCard icon={Eye} tone="green" label="Published" value={all.filter((r) => r.status !== 'Hidden').length} />
        <StatCard icon={EyeOff} tone="red" label="Hidden" value={all.filter((r) => r.status === 'Hidden').length} />
      </div>
      <div className="card">
        <div className="toolbar">
          <SearchInput value={search} onChange={setSearch} placeholder="Search reviewer, property, comment…" />
          <Select value={status} onChange={setStatus} options={[{ value: 'all', label: 'All reviews' }, { value: 'Approved', label: 'Published' }, 'Hidden']} aria-label="Visibility" />
          <Select value={rating} onChange={setRating} options={[{ value: 'all', label: 'Any rating' }, ...[5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: `${n} star${n > 1 ? 's' : ''}` }))]} aria-label="Rating" />
        </div>
        {loading && !data ? <LoadingBlock /> : error ? <ErrorState message={error} onRetry={reload} /> : (
          <DataTable columns={columns} rows={rows} resetKey={`${status}|${rating}|${search}`} empty={<EmptyState icon={Star} title="No reviews" message="Reviews posted on the website appear here." />} />
        )}
      </div>
    </>
  );
}

import { useMemo, useState } from 'react';
import { ExternalLink, MapPinned } from 'lucide-react';
import { api, USER_SITE_URL } from '../lib/api';
import { DataTable, EmptyState, ErrorState, LoadingBlock, PageHeader, SearchInput, Select, useAsync } from '../components/ui';

const pkr = (n) => {
  const v = Number(n) || 0;
  if (!v) return '—';
  if (v >= 10000000) return `${(v / 10000000).toFixed(2).replace(/\.?0+$/, '')} Cr`;
  if (v >= 100000) return `${(v / 100000).toFixed(1).replace(/\.0$/, '')} Lakh`;
  return v.toLocaleString('en-PK');
};
const tierLabel = (t) => ({ premium: 'Premium', 'upper-mid': 'Upper-mid', mid: 'Mid-range', budget: 'Budget' }[t] || t || '—');

export default function AreasView() {
  const { data, loading, error, reload } = useAsync(() => api.get('/areas'), []);
  const [search, setSearch] = useState('');
  const [tier, setTier] = useState('all');
  const [sort, setSort] = useState('listings');

  const areas = useMemo(() => (Array.isArray(data?.data) ? data.data : []), [data]);
  const byParent = useMemo(() => Object.fromEntries(areas.map((a) => [a.slug, a.name])), [areas]);
  const tiers = useMemo(() => [...new Set(areas.map((a) => a.tier).filter(Boolean))], [areas]);
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = areas.filter((a) => (tier === 'all' || a.tier === tier)
      && (!q || `${a.name} ${(a.aliases || []).join(' ')} ${byParent[a.parent] || ''}`.toLowerCase().includes(q)));
    const count = (a) => Number(a.stats?.listingCount) || 0;
    return [...list].sort((a, b) => (sort === 'name' ? a.name.localeCompare(b.name, undefined, { numeric: true })
      : sort === 'rent' ? (Number(b.stats?.rent?.avg) || 0) - (Number(a.stats?.rent?.avg) || 0)
        : count(b) - count(a) || a.name.localeCompare(b.name)));
  }, [areas, search, tier, sort, byParent]);
  const total = areas.filter((a) => !a.parent).reduce((s, a) => s + (Number(a.stats?.listingCount) || 0), 0);

  const columns = [
    { key: 'name', header: 'Area', primary: true, render: (a) => <div><strong>{a.name}</strong><div className="muted small">{byParent[a.parent] || 'Lahore'}</div></div> },
    { key: 'tier', header: 'Tier', render: (a) => <span className={`tier-badge tier-${a.tier || 'none'}`}>{tierLabel(a.tier)}</span> },
    { key: 'listings', header: 'Listings', render: (a) => Number(a.stats?.listingCount) || 0 },
    { key: 'split', header: 'Rent / Sale', render: (a) => `${a.stats?.rentCount || 0} / ${a.stats?.saleCount || 0}` },
    { key: 'rent', header: 'Avg rent (PKR)', render: (a) => (a.stats?.rent?.avg ? `${pkr(a.stats.rent.avg)}` : '—') },
    { key: 'rentRange', header: 'Rent range', render: (a) => (a.stats?.rent?.min ? `${pkr(a.stats.rent.min)} – ${pkr(a.stats.rent.max)}` : '—') },
    { key: 'sale', header: 'Avg sale (PKR)', render: (a) => (a.stats?.sale?.avg ? pkr(a.stats.sale.avg) : '—') },
    { key: 'view', header: '', render: (a) => <a className="btn btn-secondary btn-sm" href={`${USER_SITE_URL}/areas/${a.slug}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}><ExternalLink size={14} /> Guide</a> },
  ];

  return (
    <>
      <PageHeader title="Areas" description={`${areas.length} Lahore areas · ${total} listings across top-level areas. Stats update live from listings.`} />
      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 260px' }}><SearchInput value={search} onChange={setSearch} placeholder="Search areas…" /></div>
          <Select value={tier} onChange={setTier} options={[{ value: 'all', label: 'All tiers' }, ...tiers.map((t) => ({ value: t, label: tierLabel(t) }))]} />
          <Select value={sort} onChange={setSort} options={[{ value: 'listings', label: 'Most listings' }, { value: 'rent', label: 'Highest avg rent' }, { value: 'name', label: 'Name' }]} />
        </div>
      </div>
      {loading ? <LoadingBlock label="Loading areas…" /> : error ? <ErrorState message={error} onRetry={reload} /> : (
        <div className="card">
          <DataTable columns={columns} rows={rows} rowKey={(a) => a.slug || a._id} pageSize={20} resetKey={`${search}|${tier}|${sort}`}
            empty={<EmptyState icon={MapPinned} title="No areas found" message="Try another search." />} />
        </div>
      )}
    </>
  );
}

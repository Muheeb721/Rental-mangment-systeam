import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Building2, ExternalLink, ImageOff, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { api, assetUrl, USER_SITE_URL } from '../lib/api';
import { areaLabel, date, priceLabel } from '../lib/format';
import { PROPERTY_STATUSES, PROPERTY_TYPES } from '../lib/constants';
import {
  Badge, EmptyState, ErrorState, IconButton, LoadingBlock, PageHeader, Pagination, SearchInput, Select, useAsync, useConfirm, useToast,
} from '../components/ui';



const PAGE_SIZE = 12;

function Thumb({ src }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <div className="thumb-empty"><ImageOff size={16} /></div>;
  return <img className="thumb" src={assetUrl(src)} alt="" loading="lazy" onError={() => setFailed(true)} />;
}

export default function PropertiesView() {
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [type, setType] = useState('all');
  const [purpose, setPurpose] = useState('all');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState('');

  // debounce the search box
  useEffect(() => {
    const timer = window.setTimeout(() => { setQuery(search); setPage(1); }, 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  const { data, loading, error, reload, setData } = useAsync(
    () => api.get('/admin/properties', { q: query, type, purpose, status, sort, page, limit: PAGE_SIZE }),
    [query, type, purpose, status, sort, page],
  );
  const items = data?.data || [];
  const meta = data?.meta || { total: 0, pages: 1 };

  const setFilter = (setter) => (value) => { setter(value); setPage(1); };
  const replaceItem = (updated) => setData((prev) => ({ ...prev, data: prev.data.map((item) => (item._id === updated._id ? updated : item)) }));

  const changeStatus = async (property, nextStatus) => {
    setBusyId(property._id);
    try {
      const response = await api.patch(`/properties/${property._id}/status`, { status: nextStatus });
      replaceItem(response.data);
      toast.success(`"${property.title}" is now ${nextStatus}.`);
      window.dispatchEvent(new Event('rms-admin:counts-changed'));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyId('');
    }
  };

  const toggleFeatured = async (property) => {
    setBusyId(property._id);
    try {
      const response = await api.put(`/properties/${property._id}`, { isFeatured: !property.isFeatured });
      replaceItem(response.data);
      toast.success(response.data.isFeatured ? 'Marked as featured.' : 'Removed from featured.');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyId('');
    }
  };

  const remove = async (property) => {
    const ok = await confirm({
      title: 'Delete property?',
      message: `"${property.title}" and its ${property.images?.length || 0} photo(s) will be permanently deleted. This cannot be undone.`,
      confirmLabel: 'Delete property',
    });
    if (!ok) return;
    setBusyId(property._id);
    try {
      await api.del(`/properties/${property._id}`);
      toast.success('Property deleted.');
      if (items.length === 1 && page > 1) setPage(page - 1); else reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyId('');
    }
  };

  return (
    <>
      <PageHeader
        title="Properties"
        description="Every listing shown on the public website. Inactive listings are hidden from visitors."
        actions={<Link to="/properties/new" className="btn btn-primary"><Plus size={15} /> Add property</Link>}
      />
      <div className="card">
        <div className="toolbar">
          <SearchInput value={search} onChange={setSearch} placeholder="Search title, society, phase, block…" />
          <Select value={type} onChange={setFilter(setType)} options={[{ value: 'all', label: 'All types' }, ...PROPERTY_TYPES]} aria-label="Type" />
          <Select value={purpose} onChange={setFilter(setPurpose)} options={[{ value: 'all', label: 'Rent & sale' }, { value: 'Rent', label: 'For rent' }, { value: 'Sale', label: 'For sale' }]} aria-label="Purpose" />
          <Select value={status} onChange={setFilter(setStatus)} options={[{ value: 'all', label: 'All statuses' }, ...PROPERTY_STATUSES]} aria-label="Status" />
          <Select value={sort} onChange={setFilter(setSort)} options={[{ value: 'newest', label: 'Newest first' }, { value: 'oldest', label: 'Oldest first' }, { value: 'price_desc', label: 'Price: high to low' }, { value: 'price_asc', label: 'Price: low to high' }, { value: 'title', label: 'Title A–Z' }]} aria-label="Sort" />
        </div>

        {loading && !data ? <LoadingBlock label="Loading properties…" /> : error ? <ErrorState message={error} onRetry={reload} /> : items.length === 0 ? (
          <EmptyState
            icon={Building2}
            title={query || type !== 'all' || purpose !== 'all' || status !== 'all' ? 'No properties match your filters' : 'No properties yet'}
            message="Add your first listing with photos and it will appear on the website immediately."
            action={<Link to="/properties/new" className="btn btn-primary"><Plus size={15} /> Add property</Link>}
          />
        ) : (
          <>
            <div className="table-wrap" style={{ opacity: loading ? 0.6 : 1 }}>
              <table className="table table-responsive">
                <thead>
                  <tr><th>Property</th><th>Type</th><th>Price</th><th>Size</th><th>Status</th><th>Added</th><th className="num">Actions</th></tr>
                </thead>
                <tbody>
                  {items.map((property) => (
                    <tr key={property._id}>
                      <td className="cell-primary">
                        <div className="property-cell">
                          <Thumb src={property.images?.[0]?.url || property.image} />
                          <div style={{ minWidth: 0 }}>
                            <Link to={`/properties/${property._id}/edit`} className="cell-main" style={{ color: 'var(--text)' }}>{property.title}</Link>
                            <div className="cell-sub truncate" style={{ maxWidth: 320 }}>
                              {[property.block, property.phase, property.city].filter(Boolean).join(', ')} · {property.images?.length || 0} photo{property.images?.length === 1 ? '' : 's'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td data-label="Type">
                        <div className="row row-wrap" style={{ gap: 4 }}>
                          <Badge dot={false} tone="gray">{property.propertyType}</Badge>
                          <Badge dot={false} tone={property.purpose === 'Sale' ? 'violet' : 'blue'}>{property.purpose === 'Sale' ? 'Sale' : 'Rent'}</Badge>
                        </div>
                      </td>
                      <td data-label="Price" className="price">{priceLabel(property)}</td>
                      <td data-label="Size" className="nowrap">{areaLabel(property)}{property.bedrooms ? <div className="cell-sub">{property.bedrooms} bed · {property.bathrooms} bath</div> : null}</td>
                      <td data-label="Status">
                        <select className="select" style={{ height: 30, width: 120, fontSize: 13 }} value={property.status} disabled={busyId === property._id} onChange={(event) => changeStatus(property, event.target.value)} aria-label="Change status">
                          {[...new Set([...PROPERTY_STATUSES, property.status])].map((option) => <option key={option} value={option}>{option}</option>)}
                        </select>
                      </td>
                      <td data-label="Added" className="nowrap">{date(property.createdAt)}</td>
                      <td data-label="Actions">
                        <div className="actions">
                          <IconButton icon={Star} label={property.isFeatured ? 'Unfeature' : 'Feature on homepage'} onClick={() => toggleFeatured(property)} disabled={busyId === property._id} style={property.isFeatured ? { color: '#f59e0b' } : undefined} />
                          <a className="icon-btn" href={`${USER_SITE_URL}/properties/${property._id}`} target="_blank" rel="noreferrer" title="View on website" aria-label="View on website"><ExternalLink size={16} /></a>
                          <IconButton icon={Pencil} label="Edit" onClick={() => navigate(`/properties/${property._id}/edit`)} />
                          <IconButton icon={Trash2} label="Delete" danger onClick={() => remove(property)} disabled={busyId === property._id} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pages={meta.pages} total={meta.total} pageSize={PAGE_SIZE} onChange={setPage} />
          </>
        )}
      </div>
    </>
  );
}

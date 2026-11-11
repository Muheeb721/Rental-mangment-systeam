import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  LuBookmark, LuCar, LuChevronLeft, LuChevronRight, LuLayoutGrid, LuList, LuMap, LuNavigation, LuSearch, LuSlidersHorizontal, LuX,
} from 'react-icons/lu';
import { toast } from 'react-toastify';
import PropertyCard, { PropertyCardSkeleton } from '../components/site/PropertyCard';
import EmptyState from '../components/site/EmptyState';
import Modal from '../components/site/Modal';
import { ListingsMap } from '../components/site/PropertyMap';
import { useProperties } from '../hooks/useProperties';
import { useAuth } from '../contexts/AuthContext';
import savedSearchService from '../services/savedSearchService';
import { formatNumber } from '../utils/property';
import LocationSearch from '../components/site/LocationSearch';
import { usePlaces } from '../hooks/usePlaces';
import { estimateMinutes, findPlace, propertyInArea, roadKm } from '../services/locationService';
import './listings/Listings.css';

const PAGE_SIZE = 12;
const PRICE_STEPS = [20000, 30000, 40000, 50000, 75000, 100000, 150000, 200000, 300000, 500000];
const priceLabel = (v) => (v >= 100000 ? `${v / 100000} Lakh` : `${formatNumber(v)}`);
const FILTER_KEYS = ['q', 'purpose', 'type', 'area', 'near', 'radiusKm', 'maxMinutes', 'minPrice', 'maxPrice', 'beds', 'baths', 'furnished', 'status'];
const RADIUS_CHIPS = [
  { radiusKm: '2', label: '2 km' },
  { radiusKm: '5', label: '5 km' },
  { radiusKm: '10', label: '10 km' },
  { maxMinutes: '15', label: '15 min by car' },
  { maxMinutes: '30', label: '30 min by car' },
];

/** Resolve the `near` param: a place slug or "lat,lng". */
function resolveNear(places, near) {
  if (!near) return null;
  const m = String(near).match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (m) return { name: 'the selected point', slug: near, lat: Number(m[1]), lng: Number(m[2]), type: 'point', aliases: [] };
  return findPlace(places, near);
}

/** Areas grouped by society (parent), for the area <select>. */
function groupAreas(places) {
  const areas = places.filter((p) => p.type === 'area');
  const parents = new Set(areas.map((a) => a.parent).filter(Boolean));
  const groups = [];
  parents.forEach((slug) => {
    const parent = areas.find((a) => a.slug === slug);
    const kids = areas.filter((a) => a.parent === slug).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    groups.push({ label: parent?.name || slug, items: [...(parent ? [{ ...parent, name: `All of ${parent.name}` }] : []), ...kids] });
  });
  const rest = areas.filter((a) => !a.parent && !parents.has(a.slug)).sort((a, b) => a.name.localeCompare(b.name));
  groups.sort((a, b) => a.label.localeCompare(b.label));
  if (rest.length) groups.push({ label: 'Other Lahore areas', items: rest });
  return groups;
}

function AreaSelect({ value, onChange, groups, className = 'r-select', ...rest }) {
  return (
    <select className={className} value={value || ''} onChange={(e) => onChange(e.target.value)} {...rest}>
      <option value="">All of Lahore</option>
      {groups.map((g) => (
        <optgroup key={g.label} label={g.label}>
          {g.items.map((a) => <option key={a.slug} value={a.slug}>{a.name}</option>)}
        </optgroup>
      ))}
    </select>
  );
}
const STATUS_OPTIONS = [
  { value: '', label: 'Available & reserved' },
  { value: 'available', label: 'Available only' },
  { value: 'reserved', label: 'Reserved' },
  { value: 'rented', label: 'Rented / booked' },
  { value: 'sold', label: 'Sold' },
  { value: 'any', label: 'Any status' },
];

const SORTS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'area-desc', label: 'Largest first' },
  { value: 'beds-desc', label: 'Most bedrooms' },
  { value: 'distance', label: 'Nearest first' },
];

function applyFilters(allItems, f, ctx = {}) {
  const { places = [], areaPlace, nearPlace } = ctx;
  let items = allItems;
  if (nearPlace) {
    const mode = f.mode || 'car';
    const radius = Number(f.radiusKm) || 0;
    const maxMin = Number(f.maxMinutes) || 0;
    items = allItems
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
      .map((p) => {
        const km = roadKm(p, nearPlace);
        const minutes = estimateMinutes(km, mode);
        return { ...p, nearInfo: { km: Math.round(km * 10) / 10, minutes, to: nearPlace.name, mode } };
      })
      .filter((p) => (maxMin ? p.nearInfo.minutes <= maxMin : p.nearInfo.km <= (radius || 5)));
  }
  const q = (f.q || '').trim().toLowerCase();
  const min = Number(f.minPrice) || 0;
  const max = Number(f.maxPrice) || 0;
  const beds = Number(f.beds) || 0;
  const baths = Number(f.baths) || 0;
  let out = items.filter((p) => {
    if (!f.status && !p.listed) return false;
    if (f.status === 'available' && p.statusKey !== 'available') return false;
    if (f.status === 'reserved' && p.statusKey !== 'reserved') return false;
    if (f.status === 'rented' && !['rented', 'booked'].includes(p.statusKey)) return false;
    if (f.status === 'sold' && p.statusKey !== 'sold') return false;
    if (f.purpose && p.purpose.toLowerCase() !== f.purpose.toLowerCase()) return false;
    if (f.type && p.type.toLowerCase() !== f.type.toLowerCase()) return false;
    if (f.area && (areaPlace ? !propertyInArea(p, areaPlace, places) : (p.phase !== f.area && !p.locationLabel.toLowerCase().includes(f.area.toLowerCase())))) return false;
    if (min && p.price < min) return false;
    if (max && (!p.price || p.price > max)) return false;
    if (beds && p.bedrooms < beds) return false;
    if (baths && p.bathrooms < baths) return false;
    if (f.furnished && !String(p.furnished).toLowerCase().includes(f.furnished.toLowerCase())) return false;
    if (q) {
      const hay = `${p.title} ${p.address} ${p.locationLabel} ${p.type} ${p.description} ${p.society}`.toLowerCase();
      if (!q.split(/\s+/).every((w) => hay.includes(w))) return false;
    }
    return true;
  });
  const sort = f.sort || (nearPlace ? 'distance' : 'newest');
  out = [...out].sort((a, b) => {
    switch (sort) {
      case 'price-asc': return (a.price || Infinity) - (b.price || Infinity);
      case 'price-desc': return b.price - a.price;
      case 'area-desc': return b.area - a.area;
      case 'beds-desc': return b.bedrooms - a.bedrooms;
      case 'distance': return (a.nearInfo?.km ?? Infinity) - (b.nearInfo?.km ?? Infinity);
      default: return String(b.createdAt).localeCompare(String(a.createdAt));
    }
  });
  // Available listings first, keeping the chosen order within each group.
  return [...out.filter((p) => p.available), ...out.filter((p) => !p.available)];
}

function FilterFields({ f, set, areaGroups, places, nearPlace, types, compact = false }) {
  return (
    <>
      <label className="r-field">
        <span className="r-label">Purpose</span>
        <select className="r-select" value={f.purpose || ''} onChange={(e) => set({ purpose: e.target.value })}>
          <option value="">Rent or buy</option>
          <option value="Rent">For rent</option>
          <option value="Sale">For sale</option>
        </select>
      </label>
      <label className="r-field">
        <span className="r-label">Property type</span>
        <select className="r-select" value={f.type || ''} onChange={(e) => set({ type: e.target.value })}>
          <option value="">Any type</option>
          {types.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </label>
      <label className="r-field">
        <span className="r-label">Area</span>
        <AreaSelect value={f.area} groups={areaGroups} onChange={(v) => set({ area: v, near: '', radiusKm: '', maxMinutes: '' })} />
      </label>
      <div className="r-field">
        <span className="r-label">Near a place</span>
        <LocationSearch places={places} value={nearPlace?.type === 'landmark' ? nearPlace : null} types={['landmark']} placeholder="University, hospital, mall…" ariaLabel="Near a landmark"
          onSelect={(pl) => set(pl ? { near: pl.slug, area: '', radiusKm: f.radiusKm || (f.maxMinutes ? '' : '5'), sort: 'distance' } : { near: '', radiusKm: '', maxMinutes: '', sort: f.sort === 'distance' ? '' : f.sort })} />
        {nearPlace ? (
          <div className="l-pills" role="group" aria-label="Distance" style={{ marginTop: 8 }}>
            {RADIUS_CHIPS.map((c) => {
              const on = c.radiusKm ? !f.maxMinutes && (f.radiusKm || '5') === c.radiusKm : f.maxMinutes === c.maxMinutes;
              return <button key={c.label} type="button" className={`r-chip ${on ? 'is-active' : ''}`} onClick={() => set({ radiusKm: c.radiusKm || '', maxMinutes: c.maxMinutes || '' })}>{c.label}</button>;
            })}
          </div>
        ) : null}
      </div>
      <div className="r-field">
        <span className="r-label">Price (PKR)</span>
        <div className="l-pair">
          <select className="r-select" aria-label="Minimum price" value={f.minPrice || ''} onChange={(e) => set({ minPrice: e.target.value })}>
            <option value="">No min</option>
            {PRICE_STEPS.map((v) => <option key={v} value={v}>{priceLabel(v)}</option>)}
          </select>
          <select className="r-select" aria-label="Maximum price" value={f.maxPrice || ''} onChange={(e) => set({ maxPrice: e.target.value })}>
            <option value="">No max</option>
            {PRICE_STEPS.map((v) => <option key={v} value={v}>{priceLabel(v)}</option>)}
          </select>
        </div>
      </div>
      <div className="r-field">
        <span className="r-label">Bedrooms</span>
        <div className="l-pills" role="group" aria-label="Minimum bedrooms">
          {['', '1', '2', '3', '4', '5'].map((v) => (
            <button key={v || 'any'} type="button" className={`r-chip ${String(f.beds || '') === v ? 'is-active' : ''}`} onClick={() => set({ beds: v })}>{v ? `${v}+` : 'Any'}</button>
          ))}
        </div>
      </div>
      <label className="r-field">
        <span className="r-label">Availability</span>
        <select className="r-select" value={f.status || ''} onChange={(e) => set({ status: e.target.value })}>
          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </label>
      {!compact ? (
        <div className="r-field">
          <span className="r-label">Bathrooms</span>
          <div className="l-pills" role="group" aria-label="Minimum bathrooms">
            {['', '1', '2', '3', '4'].map((v) => (
              <button key={v || 'any'} type="button" className={`r-chip ${String(f.baths || '') === v ? 'is-active' : ''}`} onClick={() => set({ baths: v })}>{v ? `${v}+` : 'Any'}</button>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}

export default function PropertyListingsPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { items, loading, error, reload } = useProperties();
  const [drawer, setDrawer] = useState(false);
  const [hovered, setHovered] = useState(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saving, setSaving] = useState(false);
  const [qDraft, setQDraft] = useState(params.get('q') || '');

  const f = useMemo(() => Object.fromEntries([...FILTER_KEYS, 'sort', 'view', 'page'].map((k) => [k, params.get(k) || ''])), [params]);
  const view = f.view || 'grid';
  const page = Math.max(1, Number(f.page) || 1);

  useEffect(() => { setQDraft(params.get('q') || ''); }, [params]);

  const set = (patch, { keepPage = false } = {}) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => { if (v === '' || v == null) next.delete(k); else next.set(k, v); });
    if (!keepPage) next.delete('page');
    setParams(next, { replace: false });
  };

  const places = usePlaces();
  const areaGroups = useMemo(() => groupAreas(places), [places]);
  const areaPlace = useMemo(() => findPlace(places.filter((p) => p.type === 'area'), f.area), [places, f.area]);
  const nearPlace = useMemo(() => resolveNear(places, f.near), [places, f.near]);
  const types = useMemo(() => [...new Set(items.map((p) => p.type).filter(Boolean))].sort(), [items]);
  const results = useMemo(() => applyFilters(items, f, { places, areaPlace, nearPlace }), [items, f, places, areaPlace, nearPlace]);
  const radiusKm = nearPlace && !f.maxMinutes ? Number(f.radiusKm) || 5 : 0;
  const pages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const pageItems = view === 'map' ? results : results.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const active = FILTER_KEYS.filter((k) => f[k] && !(k === 'radiusKm' || k === 'maxMinutes'));
  const clearNear = { near: '', radiusKm: '', maxMinutes: '', sort: f.sort === 'distance' ? '' : f.sort };
  const pickLocation = (pl) => {
    if (!pl) { set({ area: '', ...clearNear }); return; }
    if (pl.type === 'area') set({ area: pl.slug, ...clearNear });
    else set({ near: pl.slug, area: '', radiusKm: f.radiusKm || (f.maxMinutes ? '' : '5'), sort: 'distance' });
  };

  const chipLabel = (k) => {
    const v = f[k];
    switch (k) {
      case 'minPrice': return `From PKR ${priceLabel(Number(v))}`;
      case 'maxPrice': return `Up to PKR ${priceLabel(Number(v))}`;
      case 'beds': return `${v}+ beds`;
      case 'baths': return `${v}+ baths`;
      case 'purpose': return v === 'Sale' ? 'For sale' : 'For rent';
      case 'q': return `“${v}”`;
      case 'status': return STATUS_OPTIONS.find((o) => o.value === v)?.label || v;
      case 'area': return areaPlace?.name || v;
      case 'near': return `Near ${nearPlace?.name || v} · ${f.maxMinutes ? `≤ ${f.maxMinutes} min by car` : `${radiusKm} km`}`;
      default: return v;
    }
  };

  const heading = (() => {
    const plural = { House: 'Houses', Commercial: 'Commercial properties', Plot: 'Plots' };
    const type = f.type ? (plural[f.type] || `${f.type}s`) : (f.purpose ? 'Properties' : 'Properties for rent & sale');
    const purpose = f.purpose === 'Sale' ? ' for sale' : f.purpose === 'Rent' ? ' for rent' : '';
    if (nearPlace) return `${type}${purpose} near ${nearPlace.name}`;
    return `${type}${purpose} in ${areaPlace?.name || f.area || 'Lahore'}`;
  })();

  const goPage = (n) => {
    set({ page: n > 1 ? String(n) : '' }, { keepPage: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openSave = () => {
    if (!isAuthenticated) {
      toast.info('Sign in to save searches and get alerts.');
      navigate(`/login?redirect=${encodeURIComponent(`/properties?${params}`)}`);
      return;
    }
    setSaveName(heading);
    setSaveOpen(true);
  };

  const doSave = async (e) => {
    e.preventDefault();
    if (!saveName.trim()) return;
    setSaving(true);
    const filters = Object.fromEntries(FILTER_KEYS.filter((k) => f[k]).map((k) => [k, f[k]]));
    const res = await savedSearchService.saveSearch({ name: saveName.trim(), filters });
    setSaving(false);
    if (res?.success) { toast.success('Search saved to your dashboard'); setSaveOpen(false); } else toast.error(res?.message || 'Could not save this search.');
  };

  return (
    <div className="l-page">
      <section className="l-head">
        <div className="r-container">
          <nav className="r-crumbs" aria-label="Breadcrumb"><Link to="/">Home</Link><span>/</span><span>Properties</span></nav>
          <div className="l-head__row">
            <div>
              <h1>{heading}</h1>
              <p className="r-muted">{loading ? 'Loading listings…' : `${results.length} ${results.length === 1 ? 'property' : 'properties'} found`}</p>
            </div>
            <button type="button" className="r-btn" onClick={openSave}><LuBookmark size={16} /> Save search</button>
          </div>
        </div>
      </section>

      <div className="l-bar">
        <div className="r-container l-bar__inner">
          <form className="r-input-wrap l-bar__search" onSubmit={(e) => { e.preventDefault(); set({ q: qDraft.trim() }); }} role="search">
            <LuSearch size={17} />
            <input className="r-input" value={qDraft} onChange={(e) => setQDraft(e.target.value)} placeholder="Keyword, e.g. corner, furnished" aria-label="Keyword" />
          </form>
          <div className="l-bar__loc">
            <LuNavigation size={16} aria-hidden="true" />
            <LocationSearch places={places} value={nearPlace?.type === 'landmark' ? nearPlace : areaPlace} onSelect={pickLocation} placeholder="Area or landmark in Lahore" ariaLabel="Area or landmark" />
          </div>
          <div className="l-bar__filters">
            <select className="r-select" aria-label="Property type" value={f.type} onChange={(e) => set({ type: e.target.value })}>
              <option value="">Any type</option>
              {types.map((t) => <option key={t}>{t}</option>)}
            </select>
            <select className="r-select" aria-label="Maximum price" value={f.maxPrice} onChange={(e) => set({ maxPrice: e.target.value })}>
              <option value="">Any price</option>
              {PRICE_STEPS.map((v) => <option key={v} value={v}>Up to {priceLabel(v)}</option>)}
            </select>
            <select className="r-select" aria-label="Bedrooms" value={f.beds} onChange={(e) => set({ beds: e.target.value })}>
              <option value="">Any beds</option>
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}+ beds</option>)}
            </select>
          </div>
          <button type="button" className="r-btn l-bar__more" onClick={() => setDrawer(true)}>
            <LuSlidersHorizontal size={16} /> Filters{active.length ? <span className="l-count">{active.length}</span> : null}
          </button>
        </div>
      </div>

      <div className="r-container l-body">
        {nearPlace ? (
          <div className="l-near" role="group" aria-label={`Distance from ${nearPlace.name}`}>
            <span className="l-near__title"><LuCar size={16} /> Homes near <strong>{nearPlace.name}</strong></span>
            <div className="l-near__chips">
              {RADIUS_CHIPS.map((c) => {
                const on = c.radiusKm ? !f.maxMinutes && String(radiusKm) === c.radiusKm : f.maxMinutes === c.maxMinutes;
                return <button key={c.label} type="button" aria-pressed={on} className={`r-chip ${on ? 'is-active' : ''}`} onClick={() => set({ radiusKm: c.radiusKm || '', maxMinutes: c.maxMinutes || '' })}>{c.radiusKm ? `Within ${c.label}` : c.label}</button>;
              })}
            </div>
            <span className="l-near__note">Distances and drive times are estimates (normal traffic).</span>
          </div>
        ) : null}
        <div className="l-toolbar">
          <div className="l-chips">
            <AnimatePresence initial={false}>
              {active.map((k) => (
                <motion.button key={k} type="button" className="l-chip" onClick={() => set(k === 'near' ? clearNear : { [k]: '' })} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
                  {chipLabel(k)} <LuX size={13} />
                </motion.button>
              ))}
            </AnimatePresence>
            {active.length ? <button type="button" className="r-link l-clear" onClick={() => setParams(new URLSearchParams())}>Clear all</button> : null}
          </div>
          <div className="l-toolbar__right">
            <select className="r-select l-sort" aria-label="Sort" value={f.sort || (nearPlace ? 'distance' : 'newest')} onChange={(e) => set({ sort: e.target.value === 'newest' ? '' : e.target.value })}>
              {SORTS.filter((s) => s.value !== 'distance' || nearPlace).map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <div className="r-seg" role="tablist" aria-label="View">
              {[{ v: 'grid', icon: LuLayoutGrid, l: 'Grid' }, { v: 'list', icon: LuList, l: 'List' }, { v: 'map', icon: LuMap, l: 'Map' }].map(({ v, icon: Icon, l }) => (
                <button key={v} type="button" role="tab" aria-selected={view === v} className={view === v ? 'is-active' : ''} onClick={() => set({ view: v === 'grid' ? '' : v }, { keepPage: true })}>                  <Icon size={15} /><span className="l-seg-label">{l}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className={view === 'list' ? 'l-list' : 'r-grid r-grid--3'}>
            {Array.from({ length: 6 }).map((_, i) => <PropertyCardSkeleton key={i} layout={view === 'list' ? 'list' : 'grid'} />)}
          </div>
        ) : error ? (
          <EmptyState title="Listings are temporarily unavailable" action={<button type="button" className="r-btn r-btn--primary" onClick={reload}>Try again</button>}>
            We couldn&apos;t reach the listings service. Please check your connection and try again.
          </EmptyState>
        ) : !results.length ? (
          <EmptyState title="No properties match these filters" action={<button type="button" className="r-btn r-btn--primary" onClick={() => setParams(new URLSearchParams())}>Clear all filters</button>}>
            Try widening your budget, choosing a different area, or removing a filter or two.
          </EmptyState>
        ) : view === 'map' ? (
          <div className="l-mapview">
            <div className="l-mapview__list" data-lenis-prevent>
              {pageItems.map((p) => <PropertyCard key={p.id} property={p} layout="list" onHover={setHovered} />)}
            </div>
            <div className="l-mapview__map"><ListingsMap items={results} activeId={hovered} focus={nearPlace} radiusKm={radiusKm} /></div>
          </div>
        ) : (
          <>
            <motion.div key={`${view}-${current}`} className={view === 'list' ? 'l-list' : 'r-grid r-grid--3'} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
              {pageItems.map((p, i) => (
                <motion.div key={p.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: Math.min(i, 8) * 0.04, ease: [0.22, 1, 0.36, 1] }}>
                  <PropertyCard property={p} layout={view} />
                </motion.div>
              ))}
            </motion.div>
            {pages > 1 ? (
              <nav className="l-pager" aria-label="Pagination">
                <button type="button" className="r-btn r-btn--icon" disabled={current <= 1} onClick={() => goPage(current - 1)} aria-label="Previous page"><LuChevronLeft size={18} /></button>
                {Array.from({ length: pages }).map((_, i) => (
                  <button key={i} type="button" className={`r-btn r-btn--icon ${current === i + 1 ? 'r-btn--dark' : ''}`} aria-current={current === i + 1 ? 'page' : undefined} onClick={() => goPage(i + 1)}>{i + 1}</button>
                ))}
                <button type="button" className="r-btn r-btn--icon" disabled={current >= pages} onClick={() => goPage(current + 1)} aria-label="Next page"><LuChevronRight size={18} /></button>
                <span className="r-muted r-small" style={{ marginLeft: 8 }}>Showing {(current - 1) * PAGE_SIZE + 1}–{Math.min(current * PAGE_SIZE, results.length)} of {results.length}</span>
              </nav>
            ) : null}
          </>
        )}
      </div>

      <AnimatePresence>
        {drawer && (
          <>
            <motion.div className="r-drawer-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDrawer(false)} />
            <motion.aside className="r-drawer l-drawer" data-lenis-prevent initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'tween', duration: 0.32, ease: [0.22, 1, 0.36, 1] }} aria-label="Filters">
              <div className="r-drawer__head">
                <h3 style={{ fontSize: 20 }}>Filters</h3>
                <button type="button" className="r-btn r-btn--ghost r-btn--icon" onClick={() => setDrawer(false)} aria-label="Close filters"><LuX size={20} /></button>
              </div>
              <div className="l-drawer__body">
                <FilterFields f={f} set={set} areaGroups={areaGroups} places={places} nearPlace={nearPlace} types={types} />
              </div>
              <div className="l-drawer__foot">
                <button type="button" className="r-btn" onClick={() => setParams(new URLSearchParams())}>Reset</button>
                <button type="button" className="r-btn r-btn--primary" onClick={() => setDrawer(false)}>Show {results.length} results</button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <Modal open={saveOpen} onClose={() => setSaveOpen(false)} title="Save this search" subtitle="Find it again any time from your dashboard.">
        <form onSubmit={doSave} style={{ display: 'grid', gap: 16 }}>
          <label className="r-field">
            <span className="r-label">Search name</span>
            <input className={`r-input ${!saveName.trim() ? 'has-error' : ''}`} value={saveName} maxLength={80} onChange={(e) => setSaveName(e.target.value)} autoFocus />
            {!saveName.trim() ? <span className="r-error">Please give your search a name.</span> : null}
          </label>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" className="r-btn" onClick={() => setSaveOpen(false)}>Cancel</button>
            <button type="submit" className="r-btn r-btn--primary" disabled={saving || !saveName.trim()}>{saving ? 'Saving…' : 'Save search'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

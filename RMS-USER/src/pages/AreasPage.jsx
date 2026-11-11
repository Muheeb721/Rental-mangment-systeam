import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { LuArrowRight, LuMapPin, LuSearch } from 'react-icons/lu';
import PageHeader from '../components/site/PageHeader';
import EmptyState from '../components/site/EmptyState';
import Img from '../components/site/Img';
import Reveal from '../components/site/Reveal';
import { useAreas } from '../hooks/useAreas';
import { TIER_LABELS, searchPlaces } from '../services/locationService';
import { formatNumber, formatPKR } from '../utils/property';
import './areas/Areas.css';

const SORTS = [
  { value: 'listings', label: 'Most listings' },
  { value: 'name', label: 'Name (A–Z)' },
  { value: 'rent-asc', label: 'Avg rent: low to high' },
  { value: 'rent-desc', label: 'Avg rent: high to low' },
];

export function TierBadge({ tier }) {
  if (!tier) return null;
  return <span className={`ar-tier ar-tier--${tier}`}>{TIER_LABELS[tier] || tier}</span>;
}

export default function AreasPage() {
  const { areas, loading, places } = useAreas();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') || '');
  const tier = params.get('tier') || '';
  const sort = params.get('sort') || 'listings';

  useEffect(() => { document.title = 'Lahore area guides | RMS'; }, []);

  const setParam = (k, v) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v); else next.delete(k);
    setParams(next, { replace: true });
  };

  const shown = useMemo(() => {
    let list = areas;
    if (q.trim()) {
      const hits = searchPlaces(list, q, { limit: 200 });
      const order = new Map(hits.map((h, i) => [h.slug, i]));
      list = list.filter((a) => order.has(a.slug));
      if (sort === 'listings') return list.filter((a) => !tier || a.tier === tier).sort((a, b) => order.get(a.slug) - order.get(b.slug));
    }
    if (tier) list = list.filter((a) => a.tier === tier);
    const s = [...list];
    s.sort((a, b) => {
      switch (sort) {
        case 'name': return a.name.localeCompare(b.name, undefined, { numeric: true });
        case 'rent-asc': return (a.stats.rent.avg || Infinity) - (b.stats.rent.avg || Infinity);
        case 'rent-desc': return b.stats.rent.avg - a.stats.rent.avg;
        default: return b.stats.count - a.stats.count || a.name.localeCompare(b.name, undefined, { numeric: true });
      }
    });
    return s;
  }, [areas, q, tier, sort]);

  const parentName = (a) => (a.parent ? places.find((p) => p.slug === a.parent)?.name || '' : '');
  const totalListings = useMemo(() => areas.filter((a) => !a.parent).reduce((s, a) => s + a.stats.count, 0), [areas]);

  return (
    <div className="ar-page">
      <PageHeader eyebrow="Area guides" title="Explore Lahore, area by area" crumbs={['Areas']}>
        Live prices, listing counts and nearby universities, hospitals and malls for {areas.length || 'every'} Lahore neighbourhoods{totalListings ? ` — ${formatNumber(totalListings)} homes listed` : ''}.
      </PageHeader>

      <div className="r-container ar-body">
        <div className="ar-tools">
          <label className="r-input-wrap ar-search">
            <LuSearch size={17} />
            <input className="r-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search areas, e.g. Johar Town, DHA 6" aria-label="Search areas" />
          </label>
          <div className="ar-tiers" role="group" aria-label="Filter by tier">
            {['', 'premium', 'upscale', 'mid', 'affordable'].map((t) => (
              <button key={t || 'all'} type="button" aria-pressed={tier === t} className={`r-chip ${tier === t ? 'is-active' : ''}`} onClick={() => setParam('tier', t)}>{t ? TIER_LABELS[t] : 'All tiers'}</button>
            ))}
          </div>
          <select className="r-select ar-sort" aria-label="Sort areas" value={sort} onChange={(e) => setParam('sort', e.target.value === 'listings' ? '' : e.target.value)}>
            {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>

        {loading && !areas.length ? (
          <div className="ar-grid">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="r-skel" style={{ height: 290, borderRadius: 18 }} />)}</div>
        ) : !shown.length ? (
          <EmptyState icon={LuMapPin} title="No areas match" action={<button type="button" className="r-btn r-btn--primary" onClick={() => { setQ(''); setParams(new URLSearchParams()); }}>Show all areas</button>}>
            Try a different spelling or clear the tier filter.
          </EmptyState>
        ) : (
          <div className="ar-grid">
            {shown.map((a, i) => (
              <Reveal key={a.slug} delay={Math.min(i, 8) * 0.04}>
                <Link to={`/areas/${a.slug}`} className="ar-card">
                  <div className="ar-card__media">
                    <Img src={a.cover} alt="" />
                    <TierBadge tier={a.tier} />
                  </div>
                  <div className="ar-card__body">
                    <div className="ar-card__title">
                      <strong>{a.name}</strong>
                      <span>{parentName(a) || 'Lahore'}</span>
                    </div>
                    <div className="ar-card__stats">
                      <div><span>Listings</span><strong>{a.stats.count}</strong></div>
                      <div><span>Avg rent</span><strong>{a.stats.rent.avg ? `PKR ${formatNumber(a.stats.rent.avg)}` : '—'}</strong></div>
                      <div><span>Avg sale</span><strong>{a.stats.sale.avg ? formatPKR(a.stats.sale.avg).replace('PKR ', '') : '—'}</strong></div>
                    </div>
                    <span className="ar-card__cta">Area guide <LuArrowRight size={15} /></span>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

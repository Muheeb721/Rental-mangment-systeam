import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LuArrowRight, LuCar, LuCarTaxiFront, LuInfo, LuMapPin } from 'react-icons/lu';
import { TbMotorbike } from 'react-icons/tb';
import PropertyCard, { PropertyCardSkeleton } from '../components/site/PropertyCard';
import EmptyState from '../components/site/EmptyState';
import Reveal from '../components/site/Reveal';
import { ListingsMap } from '../components/site/PropertyMap';
import { iconFor } from '../components/site/LocationSearch';
import { TierBadge } from './AreasPage';
import { fallbackPhoto, useAreas } from '../hooks/useAreas';
import {
  computeAreaStats, findPlace, fmtKm, getAreaGuide, nearbyLocal, propertyInArea,
} from '../services/locationService';
import { formatNumber, formatPKR } from '../utils/property';
import './areas/Areas.css';
import './property/PropertyDetails.css';

const NEARBY_CATS = ['university', 'hospital', 'school', 'mall', 'transport', 'park'];

function TypeBars({ rows, field, fmt }) {
  const data = rows.filter((r) => r[field] > 0);
  if (!data.length) return <p className="r-muted r-small">Not enough listings yet.</p>;
  const max = Math.max(...data.map((r) => r[field]));
  return (
    <ul className="ag-bars" aria-label="Average price by property type">
      {data.map((r) => (
        <li key={r.type}>
          <span className="ag-bars__label">{r.type}<small> · {r.count}</small></span>
          <span className="ag-bars__track"><span className="ag-bars__fill" style={{ width: `${Math.max(6, (r[field] / max) * 100)}%` }} /></span>
          <strong className="ag-bars__val">{fmt(r[field])}</strong>
        </li>
      ))}
    </ul>
  );
}

export default function AreaGuidePage() {
  const { slug } = useParams();
  const { areas, items, places, loading } = useAreas();
  const [guide, setGuide] = useState(null);
  const [purpose, setPurpose] = useState('rent');

  useEffect(() => {
    let active = true;
    setGuide(null);
    getAreaGuide(slug).then((g) => { if (active) setGuide(g); });
    return () => { active = false; };
  }, [slug]);

  const base = useMemo(() => areas.find((a) => a.slug === slug) || findPlace(places.filter((p) => p.type === 'area'), slug), [areas, places, slug]);
  const area = useMemo(() => (base || guide ? { ...(guide || {}), ...(base || {}), description: base?.description || guide?.description || '' } : null), [base, guide]);
  const listings = useMemo(() => (area ? items.filter((p) => propertyInArea(p, area, places)) : []), [area, items, places]);
  const stats = useMemo(() => {
    const local = computeAreaStats(listings);
    const remote = guide?.stats || area?.stats;
    return remote && remote.count ? { ...local, ...remote, byType: remote.byType?.length ? remote.byType : local.byType } : local;
  }, [listings, guide, area]);
  const nearby = useMemo(() => {
    if (guide?.nearby?.length) return guide.nearby;
    if (!area || !Number.isFinite(area.lat)) return [];
    return NEARBY_CATS.flatMap((c) => nearbyLocal(area, places, { category: c, limit: 2 })).sort((a, b) => a.distanceKm - b.distanceKm);
  }, [guide, area, places]);
  const children = useMemo(() => (area ? areas.filter((a) => a.parent === area.slug) : []), [areas, area]);
  const parent = area?.parent ? places.find((p) => p.slug === area.parent) : null;

  useEffect(() => { if (area?.name) document.title = `${area.name} area guide | RMS`; }, [area?.name]);

  if (!area) {
    if (loading || !places.length) return <div className="r-container" style={{ padding: '120px 24px' }}><div className="r-skel" style={{ height: 320, borderRadius: 24 }} /></div>;
    return (
      <div className="r-container" style={{ padding: '80px 24px' }}>
        <EmptyState icon={LuMapPin} title="We don't have a guide for this area yet" action={<Link to="/areas" className="r-btn r-btn--primary">See all Lahore areas</Link>}>Try another neighbourhood.</EmptyState>
      </div>
    );
  }

  const description = area.description || `${area.name} is one of Lahore's residential areas. Browse live listings, typical prices and what's nearby below.`;
  const sample = [...listings].sort((a, b) => Number(b.available) - Number(a.available) || String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 6);
  const viewAll = `/properties?area=${encodeURIComponent(area.slug)}`;

  return (
    <div className="ag">
      <section className="ag-hero">
        <motion.div className="ag-hero__bg" style={{ backgroundImage: `url("${area.cover || fallbackPhoto(area.slug)}")` }} initial={{ scale: 1.06 }} animate={{ scale: 1 }} transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }} aria-hidden="true" />
        <div className="ag-hero__shade" aria-hidden="true" />
        <div className="r-container ag-hero__inner">
          <nav className="r-crumbs ag-crumbs" aria-label="Breadcrumb">
            <Link to="/">Home</Link><span>/</span><Link to="/areas">Areas</Link>
            {parent ? <><span>/</span><Link to={`/areas/${parent.slug}`}>{parent.name}</Link></> : null}
            <span>/</span><span>{area.name}</span>
          </nav>
          <TierBadge tier={area.tier} />
          <h1 className="r-h1">{area.name}</h1>
          <p className="ag-hero__sub"><LuMapPin size={16} /> {parent ? `${parent.name}, ` : ''}Lahore</p>
          <div className="ag-hero__actions">
            <Link to={viewAll} className="r-btn r-btn--primary r-btn--lg">View {stats.count || ''} listing{stats.count === 1 ? '' : 's'} <LuArrowRight size={17} /></Link>
            <Link to={`/properties?near=${encodeURIComponent(area.slug)}&radiusKm=5&sort=distance`} className="r-btn r-btn--lg r-btn--light">Homes within 5 km</Link>
          </div>
        </div>
      </section>

      <div className="r-container ag-body">
        <div className="ag-stats">
          <div><span>Listings</span><strong>{stats.count}</strong></div>
          <div><span>For rent</span><strong>{stats.rentCount}</strong></div>
          <div><span>For sale</span><strong>{stats.saleCount}</strong></div>
          <div><span>Avg rent / month</span><strong>{stats.rent.avg ? `PKR ${formatNumber(stats.rent.avg)}` : '—'}</strong>{stats.rent.min ? <small>{formatPKR(stats.rent.min)} – {formatPKR(stats.rent.max)}</small> : null}</div>
          <div><span>Avg sale price</span><strong>{stats.sale.avg ? formatPKR(stats.sale.avg) : '—'}</strong>{stats.sale.min ? <small>{formatPKR(stats.sale.min)} – {formatPKR(stats.sale.max)}</small> : null}</div>
        </div>

        <div className="ag-grid">
          <section className="ag-card">
            <h2>About {area.name}</h2>
            <p className="ag-desc">{description}</p>
            {children.length ? (
              <>
                <h3 className="ag-sub">Areas in {area.name}</h3>
                <div className="ag-chips">{children.map((c) => <Link key={c.slug} to={`/areas/${c.slug}`} className="r-chip">{c.name}{c.stats.count ? ` · ${c.stats.count}` : ''}</Link>)}</div>
              </>
            ) : null}
          </section>
          <section className="ag-card">
            <div className="ag-card__head">
              <h2>Average price by type</h2>
              <div className="r-seg" role="tablist" aria-label="Rent or sale">
                {[['rent', 'Rent'], ['sale', 'Sale']].map(([v, l]) => <button key={v} type="button" role="tab" aria-selected={purpose === v} className={purpose === v ? 'is-active' : ''} onClick={() => setPurpose(v)}>{l}</button>)}
              </div>
            </div>
            <TypeBars rows={stats.byType} field={purpose === 'rent' ? 'avgRent' : 'avgSale'} fmt={(v) => (purpose === 'rent' ? `PKR ${formatNumber(v)}` : formatPKR(v))} />
          </section>
        </div>

        <div className="ag-grid ag-grid--map">
          <section className="ag-card ag-card--flush">
            <ListingsMap items={listings} focus={area} height="100%" />
          </section>
          <section className="ag-card">
            <h2>What&apos;s nearby</h2>
            <div className="lc-list">
              {nearby.slice(0, 8).map((n) => {
                const Icon = iconFor(n.place);
                return (
                  <div key={n.place.slug} className="lc-item">
                    <span className={`lc-item__num ls__icon ls__icon--${n.place.category}`}><Icon size={15} /></span>
                    <div className="lc-item__main"><strong>{n.place.name}</strong><span>{({ university: 'University', hospital: 'Hospital', school: 'School', mall: 'Shopping', transport: 'Transport', park: 'Park', mosque: 'Mosque' })[n.place.category] || 'Landmark'} · {fmtKm(n.distanceKm)}</span></div>
                    <div className="lc-item__times">
                      <span title="By car"><LuCar size={14} /> {n.minutes.car}m</span>
                      <span title="By motorbike"><TbMotorbike size={14} /> {n.minutes.bike}m</span>
                      <span title="By rickshaw"><LuCarTaxiFront size={14} /> {n.minutes.rickshaw}m</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="lc-note"><LuInfo size={13} /> Estimated from the area centre in normal traffic.</p>
          </section>
        </div>

        <section className="ag-listings">
          <Reveal className="r-section-head">
            <div>
              <span className="r-eyebrow">Live listings</span>
              <h2 className="r-h2">Homes in {area.name}</h2>
            </div>
            {listings.length ? <Link to={viewAll} className="r-link">View all {listings.length} <LuArrowRight size={16} /></Link> : null}
          </Reveal>
          {loading && !listings.length ? (
            <div className="r-grid r-grid--3">{[0, 1, 2].map((i) => <PropertyCardSkeleton key={i} />)}</div>
          ) : sample.length ? (
            <div className="r-grid r-grid--3">{sample.map((p, i) => <Reveal key={p.id} delay={i * 0.05}><PropertyCard property={p} /></Reveal>)}</div>
          ) : (
            <EmptyState title={`No listings in ${area.name} right now`} action={<Link to={`/properties?near=${encodeURIComponent(area.slug)}&radiusKm=10&sort=distance`} className="r-btn r-btn--primary">See homes nearby</Link>}>
              New homes are added every week — try nearby areas in the meantime.
            </EmptyState>
          )}
        </section>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LuArrowRight, LuBell, LuBuilding2, LuCalendarCheck, LuCreditCard, LuFileText, LuHouse, LuKeyRound,
  LuMapPin, LuMessageCircle, LuQuote, LuSearch, LuShieldCheck, LuStar, LuWrench, LuBuilding,
} from 'react-icons/lu';
import Reveal from '../components/site/Reveal';
import PropertyCarousel from '../components/site/PropertyCarousel';
import { PropertyCardSkeleton } from '../components/site/PropertyCard';
import EmptyState from '../components/site/EmptyState';
import { useProperties } from '../hooks/useProperties';
import { formatNumber, formatPKR } from '../utils/property';
import api from '../services/api';
import LocationSearch from '../components/site/LocationSearch';
import { usePlaces } from '../hooks/usePlaces';
import { getAreas } from '../services/locationService';
import './home/Home.css';

const BUY_BUDGETS = [
  { label: 'Any budget', value: '' },
  { label: 'Up to PKR 1.5 Crore', value: '15000000' },
  { label: 'Up to PKR 3 Crore', value: '30000000' },
  { label: 'Up to PKR 5 Crore', value: '50000000' },
  { label: 'Up to PKR 10 Crore', value: '100000000' },
  { label: 'Up to PKR 25 Crore', value: '250000000' },
];

const BUDGETS = [
  { label: 'Any budget', value: '' },
  { label: 'Up to PKR 30,000', value: '30000' },
  { label: 'Up to PKR 50,000', value: '50000' },
  { label: 'Up to PKR 75,000', value: '75000' },
  { label: 'Up to PKR 1 Lakh', value: '100000' },
  { label: 'Up to PKR 1.5 Lakh', value: '150000' },
  { label: 'Up to PKR 2.5 Lakh', value: '250000' },
  { label: 'Up to PKR 5 Lakh', value: '500000' },
];

const TYPE_TILES = [
  { type: 'House', icon: LuHouse, img: '/images/site/house-exterior-09.jpg', blurb: 'Independent homes with lawns and parking' },
  { type: 'Apartment', icon: LuBuilding2, img: '/images/site/living-room-03.jpg', blurb: 'Managed buildings with lifts and security' },
  { type: 'Flat', icon: LuBuilding, img: '/images/site/apartment-building-02.jpg', blurb: 'Compact, affordable portions and flats' },
];

const STEPS = [
  { icon: LuSearch, title: 'Search verified listings', text: 'Filter by area, landmark, budget, bedrooms and type. Every listing is reviewed by our leasing team before it goes live.' },
  { icon: LuCalendarCheck, title: 'Book a visit', text: 'Pick a date that suits you and our agent confirms the viewing — no back-and-forth phone calls.' },
  { icon: LuFileText, title: 'Apply online', text: 'Submit your rental application in minutes and track its status from your dashboard.' },
  { icon: LuKeyRound, title: 'Move in & manage', text: 'Pay rent, raise maintenance requests and get reminders — all in one tenant account.' },
];

const byPhase = (items) => {
  const map = new Map();
  items.forEach((p) => {
    const key = p.phase || p.city;
    if (!key) return;
    const cur = map.get(key) || { name: key, count: 0, min: Infinity, cover: '' };
    cur.count += 1;
    if (p.price && p.price < cur.min) cur.min = p.price;
    if (!cur.cover && p.cover) cur.cover = p.cover;
    map.set(key, cur);
  });
  return [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, undefined, { numeric: true }));
};

function HeroSearch({ places }) {
  const navigate = useNavigate();
  const [purpose, setPurpose] = useState('Rent');
  const [place, setPlace] = useState(null);
  const [type, setType] = useState('');
  const [budget, setBudget] = useState('');
  const [beds, setBeds] = useState('');

  const submit = (e) => {
    e.preventDefault();
    const q = new URLSearchParams();
    q.set('purpose', purpose);
    if (place?.type === 'area') q.set('area', place.slug);
    else if (place) { q.set('near', place.slug); q.set('radiusKm', '5'); q.set('sort', 'distance'); }
    if (type) q.set('type', type);
    if (budget) q.set('maxPrice', budget);
    if (beds) q.set('beds', beds);
    navigate(`/properties${q.toString() ? `?${q}` : ''}`);
  };

  const budgets = purpose === 'Rent' ? BUDGETS : BUY_BUDGETS;
  return (
    <div className="h-searchwrap">
    <div className="h-tabs" role="tablist" aria-label="Rent or buy">
      {[['Rent', 'Rent'], ['Sale', 'Buy']].map(([v, l]) => (
        <button key={v} type="button" role="tab" aria-selected={purpose === v} className={purpose === v ? 'is-active' : ''} onClick={() => { setPurpose(v); setBudget(''); }}>          <span>{l}</span>
        </button>
      ))}
    </div>
    <form className="h-search" onSubmit={submit} role="search" aria-label="Search properties">
      <div className="h-search__field h-search__field--loc">
        <span>Location</span>
        <LocationSearch places={places} value={place} onSelect={setPlace} inputClassName="h-search__input" placeholder="Area, society, university, hospital…" ariaLabel="Location in Lahore" />
      </div>
      <label className="h-search__field">
        <span>Property type</span>
        <select className="r-select" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">Any type</option>
          <option>House</option>
          <option>Apartment</option>
          <option>Flat</option>
          <option>Commercial</option>
          {purpose === 'Sale' ? <option>Plot</option> : null}
        </select>
      </label>
      <label className="h-search__field">
        <span>{purpose === 'Rent' ? 'Monthly budget' : 'Budget'}</span>
        <select className="r-select" value={budget} onChange={(e) => setBudget(e.target.value)}>
          {budgets.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
        </select>
      </label>
      <label className="h-search__field">
        <span>Bedrooms</span>
        <select className="r-select" value={beds} onChange={(e) => setBeds(e.target.value)}>
          <option value="">Any</option>
          {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}+ beds</option>)}
        </select>
      </label>
      <button type="submit" className="r-btn r-btn--primary r-btn--lg h-search__btn"><LuSearch size={18} /> Search</button>
    </form>
    {place && place.type !== 'area' ? <p className="h-search__note"><LuMapPin size={14} /> Showing homes within 5 km of {place.name} — you can change the radius on the next page.</p> : null}
    </div>
  );
}

function Stars({ value = 5 }) {
  return (
    <span style={{ display: 'inline-flex', gap: 2, color: 'var(--accent)' }} aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => <LuStar key={i} size={15} fill={i <= value ? 'currentColor' : 'none'} />)}
    </span>
  );
}

export default function HomePage() {
  const { items, loading, error, reload } = useProperties();
  const [reviews, setReviews] = useState([]);
  const places = usePlaces();
  const [lahoreAreas, setLahoreAreas] = useState([]);

  useEffect(() => {
    let active = true;
    api.request('/reviews').then((res) => {
      if (active && Array.isArray(res?.data)) setReviews(res.data.filter((r) => r.comment && r.userName).slice(0, 3));
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (loading) return undefined;
    let active = true;
    getAreas(items.filter((p) => p.listed)).then((list) => { if (active) setLahoreAreas(list); }).catch(() => {});
    return () => { active = false; };
  }, [items, loading]);
  const topAreas = useMemo(() => [...lahoreAreas].filter((a) => a.stats.count > 0).sort((a, b) => b.stats.count - a.stats.count || a.name.localeCompare(b.name)).filter((a, _, arr) => !arr.some((c) => c.parent === a.slug)).slice(0, 8), [lahoreAreas]);

  const available = useMemo(() => items.filter((p) => p.available), [items]);
  const listedItems = useMemo(() => items.filter((p) => p.listed), [items]);
  const areas = useMemo(() => byPhase(listedItems), [listedItems]);
  const featured = useMemo(() => {
    const pool = [...available];
    pool.sort((a, b) => (Number(b.featured) - Number(a.featured)) || (Number(Boolean(b.cover)) - Number(Boolean(a.cover))) || String(b.createdAt).localeCompare(String(a.createdAt)));
    return pool.slice(0, 8);
  }, [available]);
  const typeCounts = useMemo(() => listedItems.reduce((acc, p) => ({ ...acc, [p.type]: (acc[p.type] || 0) + 1 }), {}), [listedItems]);
  const minRent = useMemo(() => available.filter((p) => p.isRent && p.price).reduce((m, p) => Math.min(m, p.price), Infinity), [available]);

  return (
    <div className="home">
      {/* HERO */}
      <section className="h-hero">
        <div className="h-hero__clip" aria-hidden="true">
          <motion.div className="h-hero__bg" initial={{ scale: 1.08 }} animate={{ scale: 1 }} transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1] }} aria-hidden="true" />
        <div className="h-hero__shade" aria-hidden="true" />
        </div>
        <div className="r-container h-hero__inner">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.1, ease: [0.22, 1, 0.36, 1] }} className="h-hero__copy">
            <span className="h-hero__kicker"><LuShieldCheck size={15} /> Verified homes · All of Lahore</span>
            <h1 className="r-h1">Find a home you&apos;ll love to live in.</h1>
            <p>Browse houses, apartments and flats checked by our leasing team — then book a visit, apply and pay rent online.</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}>
            <HeroSearch places={places} />
          </motion.div>
          <motion.div className="h-hero__stats" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.45 }}>
            {loading ? <span>Loading live listings…</span> : items.length ? (
              <>
                <span><strong>{formatNumber(available.length)}</strong> properties available now</span>
                <span><strong>{lahoreAreas.length || areas.length}</strong> Lahore areas</span>
                {Number.isFinite(minRent) ? <span>Rents from <strong>PKR {formatNumber(minRent)}</strong>/month</span> : null}
              </>
            ) : null}
          </motion.div>
        </div>
      </section>

      {/* FEATURED */}
      <section className="r-section">
        <div className="r-container">
          <Reveal className="r-section-head">
            <div>
              <span className="r-eyebrow">Available now</span>
              <h2 className="r-h2">Featured properties</h2>
              <p className="r-muted">Hand-picked listings with up-to-date pricing, straight from our property database.</p>
            </div>
            <Link to="/properties" className="r-link">View all properties <LuArrowRight size={16} /></Link>
          </Reveal>
          {loading ? (
            <div className="r-grid r-grid--3">{[0, 1, 2].map((i) => <PropertyCardSkeleton key={i} />)}</div>
          ) : error ? (
            <EmptyState title="We couldn't load listings" action={<button type="button" className="r-btn" onClick={reload}>Try again</button>}>
              The listings service is not responding right now. Please try again in a moment.
            </EmptyState>
          ) : featured.length ? (
            <Reveal><PropertyCarousel items={featured} /></Reveal>
          ) : (
            <EmptyState title="No homes listed yet">New listings are added regularly — check back soon.</EmptyState>
          )}
        </div>
      </section>

      {/* TYPES */}
      <section className="r-section r-section--alt">
        <div className="r-container">
          <Reveal className="r-section-head">
            <div>
              <span className="r-eyebrow">Browse by type</span>
              <h2 className="r-h2">What kind of home are you after?</h2>
            </div>
          </Reveal>
          <div className="h-types">
            {TYPE_TILES.map((t, i) => (
              <Reveal key={t.type} delay={i * 0.08}>
                <Link to={`/properties?type=${t.type}`} className="h-type">
                  <img src={t.img} alt="" loading="lazy" />
                  <div className="h-type__shade" />
                  <div className="h-type__body">
                    <span className="h-type__icon"><t.icon size={20} /></span>
                    <div>
                      <h3>{t.type === 'House' ? 'Houses' : `${t.type}s`}</h3>
                      <p>{t.blurb}</p>
                    </div>
                    <span className="h-type__count">{typeCounts[t.type] || 0} listing{typeCounts[t.type] === 1 ? '' : 's'} <LuArrowRight size={15} /></span>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* AREAS */}
      {topAreas.length ? (
        <section className="r-section">
          <div className="r-container">
            <Reveal className="r-section-head">
              <div>
                <span className="r-eyebrow">Area guides</span>
                <h2 className="r-h2">Explore by neighbourhood</h2>
                <p className="r-muted">The busiest areas across Lahore right now, with live listing counts and prices.</p>
              </div>
              <Link to="/areas" className="r-link">All Lahore areas <LuArrowRight size={16} /></Link>
            </Reveal>
            <div className="h-areas">
              {topAreas.map((a, i) => (
                <Reveal key={a.slug} delay={(i % 4) * 0.06}>
                  <Link to={`/areas/${a.slug}`} className="h-area">
                    <span className="h-area__pin"><LuMapPin size={18} /></span>
                    <div style={{ minWidth: 0 }}>
                      <strong>{a.name}</strong>
                      <span>{a.stats.count} listing{a.stats.count > 1 ? 's' : ''}{a.stats.rent.avg ? ` · avg rent PKR ${formatNumber(a.stats.rent.avg)}` : a.stats.sale.avg ? ` · avg ${formatPKR(a.stats.sale.avg)}` : ''}</span>
                    </div>
                    <LuArrowRight size={16} className="h-area__arrow" />
                  </Link>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* HOW IT WORKS */}
      <section className="r-section h-how">
        <div className="r-container">
          <Reveal className="r-section-head r-section-head--center">
            <div>
              <span className="r-eyebrow">How it works</span>
              <h2 className="r-h2">From search to keys in four steps</h2>
            </div>
          </Reveal>
          <div className="h-steps">
            {STEPS.map((s, i) => (
              <Reveal key={s.title} delay={i * 0.08} className="h-step">
                <div className="h-step__num">0{i + 1}</div>
                <span className="h-step__icon"><s.icon size={22} /></span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* TENANT TOOLS */}
      <section className="r-section r-section--alt">
        <div className="r-container h-split">
          <Reveal className="h-split__media">
            <img src="/images/site/living-room-01.jpg" alt="Bright living room in a rented apartment" loading="lazy" />
            <div className="h-split__card">
              <span className="r-badge r-badge--success">Rent paid</span>
              <strong>Payment received</strong>
              <span className="r-muted r-small">Your receipt is available in your dashboard.</span>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <span className="r-eyebrow">For tenants</span>
            <h2 className="r-h2" style={{ margin: '12px 0 14px' }}>Everything after move-in, handled online</h2>
            <p className="r-lead">Your RMS account stays useful long after you sign — keep your tenancy organised without chasing anyone on the phone.</p>
            <ul className="h-features">
              <li><span><LuCreditCard size={18} /></span><div><strong>Rent &amp; payment history</strong><p>Upload payment proofs and see every verified payment.</p></div></li>
              <li><span><LuWrench size={18} /></span><div><strong>Maintenance requests</strong><p>Report an issue with priority and follow it to completion.</p></div></li>
              <li><span><LuBell size={18} /></span><div><strong>Real-time notifications</strong><p>Get notified the moment your application or payment is updated.</p></div></li>
            </ul>
            <Link to="/signup" className="r-btn r-btn--dark" style={{ marginTop: 8 }}>Create a free account <LuArrowRight size={16} /></Link>
          </Reveal>
        </div>
      </section>

      {/* REVIEWS (only when real reviews exist) */}
      {reviews.length ? (
        <section className="r-section">
          <div className="r-container">
            <Reveal className="r-section-head">
              <div>
                <span className="r-eyebrow">Tenant reviews</span>
                <h2 className="r-h2">What our tenants say</h2>
              </div>
            </Reveal>
            <div className="r-grid r-grid--3">
              {reviews.map((r, i) => (
                <Reveal key={r._id || i} delay={i * 0.08} className="r-card r-card--pad h-review">
                  <LuQuote size={22} style={{ color: 'var(--brand-500)' }} />
                  <p>{r.comment}</p>
                  <div className="h-review__by">
                    <div><strong>{r.userName}</strong>{r.propertyName ? <span>{r.propertyName}</span> : null}</div>
                    <Stars value={Math.max(1, Math.min(5, Number(r.rating) || 5))} />
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* CTA */}
      <section className="r-section r-section--tight">
        <div className="r-container">
          <Reveal className="h-cta">
            <div>
              <h2>Not sure where to start?</h2>
              <p>Describe what you need in plain words — our assistant searches every live listing for you. Or talk to our leasing team directly.</p>
            </div>
            <div className="h-cta__actions">
              <button type="button" className="r-btn r-btn--lg h-cta__primary" onClick={() => document.querySelector('.rc-fab')?.click()}><LuMessageCircle size={18} /> Ask the assistant</button>
              <Link to="/contact" className="r-btn r-btn--lg r-btn--light">Contact leasing team</Link>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}

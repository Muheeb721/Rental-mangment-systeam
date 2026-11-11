import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import {
  LuArrowLeft, LuBath, LuBedDouble, LuBuilding2, LuCalendarCheck, LuCheck, LuFileText, LuHouse, LuLayers,
  LuMail, LuMapPin, LuMessageCircle, LuPhone, LuRuler, LuShare2, LuShieldCheck, LuSofa,
} from 'react-icons/lu';
import Gallery from '../components/site/Gallery';
import FavoriteButton from '../components/site/FavoriteButton';
import PropertyCard from '../components/site/PropertyCard';
import EmptyState from '../components/site/EmptyState';
import Reveal from '../components/site/Reveal';
import LocationCommute from '../components/site/LocationCommute';
import AffordabilityCalculator from '../components/site/AffordabilityCalculator';
import { ApplyModal, EnquiryForm, VisitModal } from '../components/site/PropertyForms';
import useRequireAuth from '../hooks/useRequireAuth';
import { useProperties, useProperty } from '../hooks/useProperties';
import { formatDate, formatNumber, formatPKR, formatPrice, pricePerMarla, timeAgo } from '../utils/property';
import SITE from '../config/site';
import './property/PropertyDetails.css';

function DetailSkeleton() {
  return (
    <div className="r-container pd" aria-busy="true">
      <div className="r-skel" style={{ height: 18, width: 220, marginBottom: 20 }} />
      <div className="r-skel pd-skel-gallery" />
      <div className="pd-layout" style={{ marginTop: 32 }}>
        <div style={{ display: 'grid', gap: 14 }}>
          <div className="r-skel" style={{ height: 34, width: '70%' }} />
          <div className="r-skel" style={{ height: 18, width: '40%' }} />
          <div className="r-skel" style={{ height: 90, marginTop: 12 }} />
          <div className="r-skel" style={{ height: 160 }} />
        </div>
        <div className="r-skel" style={{ height: 320, borderRadius: 18 }} />
      </div>
    </div>
  );
}

const Fact = ({ icon: Icon, label, value }) => (
  <div className="pd-fact">
    <span className="pd-fact__icon"><Icon size={20} /></span>
    <div><span>{label}</span><strong>{value}</strong></div>
  </div>
);

export default function PropertyDetailsPage() {
  const { id } = useParams();
  const { item: p, loading, error } = useProperty(id);
  const { items: all } = useProperties();
  const [visitOpen, setVisitOpen] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const requireAuth = useRequireAuth();

  useEffect(() => {
    if (p?.title) document.title = `${p.title} | RMS`;
    return () => { document.title = 'RMS — Homes for rent & sale across Lahore'; };
  }, [p?.title]);

  const similar = useMemo(() => {
    if (!p) return [];
    return all
      .filter((x) => x.id !== p.id && x.listed)
      .map((x) => ({ x, score: (x.type === p.type ? 3 : 0) + (x.phase === p.phase ? 2 : 0) + (x.purpose === p.purpose ? 1 : 0) - Math.abs((x.price - p.price) / (p.price || 1)) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(({ x }) => x);
  }, [all, p]);

  if (loading && !p) return <DetailSkeleton />;
  if (!p) {
    return (
      <div className="r-container" style={{ padding: '80px 24px' }}>
        <EmptyState icon={LuHouse} title={error === 'not-found' ? 'This listing is no longer available' : "We couldn't load this property"} action={<Link to="/properties" className="r-btn r-btn--primary">Browse all properties</Link>}>
          {error === 'not-found' ? 'It may have been rented out or removed by the owner.' : 'Please check your connection and try again.'}
        </EmptyState>
      </div>
    );
  }

  const { amount, suffix } = formatPrice(p);
  const description = p.description || `${p.type} available for ${p.purpose.toLowerCase()} in ${p.locationLabel}.`;
  const longDesc = description.length > 420;
  const agentName = p.owner.name || 'RMS Leasing Team';
  const agentPhone = p.owner.phone || SITE.phone;
  const agentPhoneHref = `tel:${agentPhone.replace(/[^\d+]/g, '')}`;
  const waHref = `https://wa.me/${agentPhone.replace(/\D/g, '').replace(/^0/, '92')}?text=${encodeURIComponent(`Hi, I'm interested in "${p.title}" (${window.location.href})`)}`;

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) { await navigator.share({ title: p.title, text: `${p.title} — ${amount} ${suffix}`, url }); return; }
      await navigator.clipboard.writeText(url);
      toast.success('Link copied to clipboard');
    } catch (e) {
      if (e?.name !== 'AbortError') toast.info(url);
    }
  };

  const facts = [
    { icon: LuHouse, label: 'Type', value: p.type },
    p.bedrooms ? { icon: LuBedDouble, label: 'Bedrooms', value: p.bedrooms } : null,
    p.bathrooms ? { icon: LuBath, label: 'Bathrooms', value: p.bathrooms } : null,
    p.areaLabel ? { icon: LuRuler, label: 'Area', value: p.areaLabel } : null,
    p.furnished ? { icon: LuSofa, label: 'Furnishing', value: p.furnished } : null,
    p.floor ? { icon: LuLayers, label: 'Floor', value: p.totalFloors ? `${p.floor} of ${p.totalFloors}` : p.floor } : null,
  ].filter(Boolean);

  const details = [
    ['Purpose', `For ${p.purpose}`],
    ['Property type', p.type],
    ['Area', p.areaLabel ? `${p.areaLabel}${p.areaAlt ? ` (${p.areaAlt})` : ''}` : ''],
    ['Price per marla', pricePerMarla(p) ? formatPKR(pricePerMarla(p)) : ''],
    ['Bedrooms', p.bedrooms || ''],
    ['Bathrooms', p.bathrooms || ''],
    ['Society', p.society],
    ['Phase / sector', p.phase],
    ['Block', p.block],
    ['City', p.city],
    ['Availability', p.available ? 'Available now' : p.statusLabel],
    ['Listed', p.createdAt ? formatDate(p.createdAt) : ''],
  ].filter(([, val]) => val !== '' && val != null);

  return (
    <div className="pd">
      <div className="r-container">
        <div className="pd-top">
          <nav className="r-crumbs" aria-label="Breadcrumb">
            <Link to="/properties" className="pd-back"><LuArrowLeft size={15} /> Back to search</Link>
            <span className="pd-crumb-sep">·</span>
            <Link to={`/properties?type=${encodeURIComponent(p.type)}`}>{p.type}s</Link>
            {p.phase ? <><span>/</span><Link to={`/properties?area=${encodeURIComponent(p.phase)}`}>{p.phase}</Link></> : null}
          </nav>
          <div className="pd-top__actions">
            <button type="button" className="r-btn r-btn--sm" onClick={share}><LuShare2 size={15} /> Share</button>
            <FavoriteButton id={p.id} variant="outline" />
          </div>
        </div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
          <Gallery images={p.images} title={p.title} />
        </motion.div>

        <div className="pd-layout">
          <div className="pd-main">
            <header className="pd-head">
              <div className="pd-badges">
                <span className={`r-badge ${p.isRent ? 'r-badge--brand' : 'r-badge--dark'}`}>For {p.purpose}</span>
                {p.available ? <span className="r-badge r-badge--success"><LuCheck size={13} /> Available</span> : <span className={`r-badge ${p.statusKey === 'reserved' ? 'r-badge--warning' : 'r-badge--danger'}`}>{p.statusLabel}</span>}
                {p.featured ? <span className="r-badge r-badge--accent">Featured</span> : null}
                {p.createdAt ? <span className="r-badge">Listed {timeAgo(p.createdAt).toLowerCase()}</span> : null}
              </div>
              <h1>{p.title}</h1>
              <p className="pd-addr"><LuMapPin size={16} /> {p.address}</p>
              <div className="pd-price-m">{amount} {suffix ? <small>{suffix}</small> : null}</div>
            </header>

            <div className="pd-facts">{facts.map((f) => <Fact key={f.label} {...f} />)}</div>

            <section className="pd-section">
              <h2>About this property</h2>
              <div className={`pd-desc ${longDesc && !expanded ? 'is-clamped' : ''}`}>
                {description.split(/\n+/).map((para, i) => <p key={i}>{para}</p>)}
              </div>
              {longDesc ? <button type="button" className="r-link" style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', marginTop: 8 }} onClick={() => setExpanded((e) => !e)}>{expanded ? 'Show less' : 'Read more'}</button> : null}
            </section>

            <section className="pd-section">
              <h2>Property details</h2>
              <dl className="pd-dl">
                {details.map(([k, val]) => <div key={k}><dt>{k}</dt><dd>{val}</dd></div>)}
              </dl>
            </section>

            {p.amenities.length ? (
              <section className="pd-section">
                <h2>Amenities</h2>
                <ul className="pd-amen">
                  {p.amenities.map((a) => <li key={a}><LuCheck size={16} /> {a}</li>)}
                </ul>
              </section>
            ) : null}

            {!p.isRent && p.price ? <AffordabilityCalculator price={p.price} /> : null}

            {p.isRent ? (
              <section className="pd-section">
                <h2>Cost breakdown</h2>
                <div className="pd-costs">
                  <div><span>Monthly rent</span><strong>PKR {formatNumber(p.price)}</strong></div>
                  <div><span>Security deposit</span><strong>{p.deposit ? `PKR ${formatNumber(p.deposit)}` : 'Discussed at signing'}</strong></div>
                  {p.otherCharges ? <div><span>Other monthly charges</span><strong>PKR {formatNumber(p.otherCharges)}</strong></div> : null}
                  {p.offer ? <div><span>Current offer</span><strong style={{ color: 'var(--success)' }}>{p.offer}% off</strong></div> : null}
                </div>
              </section>
            ) : null}

            <LocationCommute property={p} />
          </div>

          <aside className="pd-side">
            <div className="pd-card">
              <div className="pd-card__price">{amount} {suffix ? <small>{suffix}</small> : null}</div>
              {p.isRent && p.price ? <p className="r-muted r-small">≈ {formatPKR(p.price * 12)} per year</p> : null}
              {pricePerMarla(p) ? <p className="r-muted r-small">{formatPKR(pricePerMarla(p))} per marla · {p.areaLabel}</p> : null}
              <div className="pd-card__actions">
                {p.isRent ? (
                  <button type="button" className="r-btn r-btn--primary r-btn--lg r-btn--block" disabled={!p.available} onClick={requireAuth(() => setApplyOpen(true), 'Sign in to apply for this property.')}>
                    <LuFileText size={18} /> {p.available ? 'Apply to rent' : p.statusKey === 'reserved' ? 'Reserved — application pending' : `Currently ${p.statusLabel.toLowerCase()}`}
                  </button>
                ) : null}
                <button type="button" className={`r-btn r-btn--lg r-btn--block ${p.isRent ? '' : 'r-btn--primary'}`} onClick={() => setVisitOpen(true)}>
                  <LuCalendarCheck size={18} /> Book a visit
                </button>
              </div>
              <div className="pd-agent">
                <div className="r-avatar" style={{ width: 44, height: 44 }}><LuBuilding2 size={20} /></div>
                <div style={{ minWidth: 0 }}>
                  <strong>{agentName}</strong>
                  <span><LuShieldCheck size={13} /> Verified by RMS</span>
                </div>
              </div>
              <div className="pd-contact">
                <a href={agentPhoneHref} className="r-btn r-btn--sm"><LuPhone size={15} /> Call</a>
                <a href={waHref} target="_blank" rel="noreferrer" className="r-btn r-btn--sm"><LuMessageCircle size={15} /> WhatsApp</a>
                {p.owner.email ? <a href={`mailto:${p.owner.email}`} className="r-btn r-btn--sm r-btn--icon" aria-label="Email"><LuMail size={15} /></a> : null}
              </div>
              <div className="pd-divider"><span>or send a message</span></div>
              <EnquiryForm property={p} />
            </div>
          </aside>
        </div>

        {similar.length ? (
          <section className="pd-similar">
            <Reveal className="r-section-head">
              <div>
                <span className="r-eyebrow">You may also like</span>
                <h2 className="r-h2">Similar homes nearby</h2>
              </div>
              <Link to={`/properties?type=${encodeURIComponent(p.type)}`} className="r-link">See more {p.type.toLowerCase()}s</Link>
            </Reveal>
            <div className="r-grid r-grid--3">
              {similar.map((s, i) => <Reveal key={s.id} delay={i * 0.06}><PropertyCard property={s} /></Reveal>)}
            </div>
          </section>
        ) : null}
      </div>

      <div className="pd-mobilebar">
        <div>
          <strong>{amount}</strong>
          {suffix ? <span>{suffix}</span> : null}
        </div>
        <button type="button" className="r-btn" onClick={() => setVisitOpen(true)}>Visit</button>
        {p.isRent && p.available ? <button type="button" className="r-btn r-btn--primary" onClick={requireAuth(() => setApplyOpen(true), 'Sign in to apply for this property.')}>Apply</button> : null}
      </div>

      <VisitModal open={visitOpen} onClose={() => setVisitOpen(false)} property={p} />
      <ApplyModal open={applyOpen} onClose={() => setApplyOpen(false)} property={p} />
    </div>
  );
}

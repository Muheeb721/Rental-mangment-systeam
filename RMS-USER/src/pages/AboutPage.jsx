import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { LuArrowRight, LuBadgeCheck, LuHandshake, LuHeadset, LuReceipt, LuShieldCheck, LuSparkles } from 'react-icons/lu';
import PageHeader from '../components/site/PageHeader';
import Reveal from '../components/site/Reveal';
import { useProperties } from '../hooks/useProperties';

const VALUES = [
  { icon: LuShieldCheck, title: 'Verified before it’s listed', text: 'Our leasing team checks ownership, pricing and photos for every property before it appears on RMS.' },
  { icon: LuReceipt, title: 'Transparent pricing', text: 'Rent, deposit and other charges are shown upfront in PKR — no hidden “agent fees” after you visit.' },
  { icon: LuHandshake, title: 'Fair for both sides', text: 'Tenants get a clear application process; owners get screened, reliable tenants and on-time rent.' },
  { icon: LuHeadset, title: 'Support after move-in', text: 'Maintenance requests, payment records and reminders live in one place for the whole tenancy.' },
];

export default function AboutPage() {
  const { items, loading } = useProperties();
  const stats = useMemo(() => {
    const areas = new Set(items.map((p) => p.phase).filter(Boolean)).size;
    const types = new Set(items.map((p) => p.type)).size;
    return [
      { value: items.length, label: 'Live listings' },
      { value: items.filter((p) => p.available).length, label: 'Available right now' },
      { value: areas, label: 'Neighbourhoods covered' },
      { value: types, label: 'Property types' },
    ];
  }, [items]);

  return (
    <>
      <PageHeader eyebrow="About RMS" title="Renting in Lahore, done properly." crumbs={['About']}>
        RMS is a residential management platform built for Lahore — helping tenants find verified homes and helping owners manage them without the usual hassle.
      </PageHeader>

      <section className="r-section">
        <div className="r-container ip-split">
          <Reveal>
            <img className="ip-img" src="/images/site/house-exterior-09.jpg" alt="Modern family home in a gated community" loading="lazy" />
          </Reveal>
          <Reveal delay={0.1}>
            <span className="r-eyebrow">Our story</span>
            <h2 className="r-h2" style={{ margin: '12px 0 16px' }}>Built to fix the way homes are rented</h2>
            <div style={{ display: 'grid', gap: 14, color: 'var(--ink-2)', fontSize: 16, lineHeight: 1.75 }}>
              <p>Finding a rental in Lahore usually means scrolling through duplicate ads, calling agents who don’t pick up, and discovering the real price only after a visit. Once you move in, rent receipts and repair requests live in WhatsApp chats.</p>
              <p>RMS brings the whole journey into one place: verified listings with real prices, online visit booking and rental applications, and a tenant dashboard for rent payments, maintenance and notifications.</p>
            </div>
            <Link to="/properties" className="r-btn r-btn--primary" style={{ marginTop: 24 }}>Explore listings <LuArrowRight size={16} /></Link>
          </Reveal>
        </div>
      </section>

      <section className="r-section r-section--alt">
        <div className="r-container">
          <Reveal className="r-section-head">
            <div>
              <span className="r-eyebrow">RMS today</span>
              <h2 className="r-h2">Live numbers from our platform</h2>
            </div>
          </Reveal>
          <div className="ip-stats">
            {stats.map((s, i) => (
              <Reveal key={s.label} delay={i * 0.06} className="ip-stat">
                <strong>{loading ? '—' : s.value}</strong>
                <span>{s.label}</span>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="r-section">
        <div className="r-container">
          <Reveal className="r-section-head">
            <div>
              <span className="r-eyebrow">What we stand for</span>
              <h2 className="r-h2">Our principles</h2>
            </div>
          </Reveal>
          <div className="ip-cards" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
            {VALUES.map((v, i) => (
              <Reveal key={v.title} delay={i * 0.06}>
                <div className="ip-card">
                  <span className="ip-card__icon"><v.icon size={22} /></span>
                  <h3>{v.title}</h3>
                  <p>{v.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="r-section r-section--tight">
        <div className="r-container">
          <Reveal className="h-cta-lite">
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <span className="ip-card__icon" style={{ margin: 0 }}><LuSparkles size={22} /></span>
              <div>
                <h3 style={{ fontSize: 20 }}>Own a property in DHA or Askari?</h3>
                <p className="r-muted">We handle listing, tenant screening, rent collection and maintenance.</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Link to="/services" className="r-btn">Owner services</Link>
              <Link to="/contact?topic=owner" className="r-btn r-btn--dark"><LuBadgeCheck size={16} /> List your property</Link>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}

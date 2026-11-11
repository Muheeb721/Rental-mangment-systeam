import { Link } from 'react-router-dom';
import {
  LuArrowRight, LuBell, LuCalendarCheck, LuCheck, LuCreditCard, LuFileText, LuMessageCircle, LuSearch, LuUserCheck, LuWrench, LuBuilding2, LuReceipt,
} from 'react-icons/lu';
import PageHeader from '../components/site/PageHeader';
import Reveal from '../components/site/Reveal';

const TENANT = [
  { icon: LuSearch, title: 'Verified property search', text: 'Filter houses, apartments and flats by phase, budget and size — with a live map view.', to: '/properties' },
  { icon: LuCalendarCheck, title: 'Visit booking', text: 'Pick a date and time slot from any listing; an agent confirms the viewing by phone.', to: '/properties' },
  { icon: LuFileText, title: 'Online rental applications', text: 'Apply in minutes, track approval status and download your rental agreement.', to: '/dashboard?tab=applications' },
  { icon: LuCreditCard, title: 'Rent payments & records', text: 'Submit bank, JazzCash or Easypaisa payments and keep a verified payment history.', to: '/dashboard?tab=payments' },
  { icon: LuWrench, title: 'Maintenance requests', text: 'Report plumbing, electrical or AC issues with a priority level and follow progress.', to: '/dashboard?tab=maintenance' },
  { icon: LuMessageCircle, title: 'AI property assistant', text: 'Describe what you want in plain words and get matching live listings instantly.', to: null },
];

const OWNER = [
  'Professional listing with photos, pricing guidance and map location',
  'Tenant screening with CNIC and application review',
  'Monthly rent collection and payment verification',
  'Maintenance coordination with vetted technicians',
  'Rental agreements generated on approval',
  'Real-time notifications for every application and payment',
];

export default function ServicesPage() {
  return (
    <>
      <PageHeader eyebrow="Services" title="Everything you need to rent — and to let." crumbs={['Services']}>
        From the first search to the last rent receipt, RMS covers the full tenancy for tenants and property owners across Lahore.
      </PageHeader>

      <section className="r-section">
        <div className="r-container">
          <Reveal className="r-section-head">
            <div>
              <span className="r-eyebrow">For tenants</span>
              <h2 className="r-h2">Find, apply and live better</h2>
            </div>
            <Link to="/signup" className="r-link">Create a free account <LuArrowRight size={16} /></Link>
          </Reveal>
          <div className="ip-cards">
            {TENANT.map((s, i) => (
              <Reveal key={s.title} delay={(i % 3) * 0.06}>
                <div className="ip-card">
                  <span className="ip-card__icon"><s.icon size={22} /></span>
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                  {s.to ? <Link to={s.to} className="r-link" style={{ marginTop: 6, fontSize: 14 }}>Get started <LuArrowRight size={14} /></Link>
                    : <button type="button" className="r-link" style={{ marginTop: 6, fontSize: 14, background: 'none', border: 0, padding: 0, cursor: 'pointer', justifySelf: 'start' }} onClick={() => document.querySelector('.rc-fab')?.click()}>Ask the assistant <LuArrowRight size={14} /></button>}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="r-section r-section--alt">
        <div className="r-container ip-split">
          <Reveal>
            <span className="r-eyebrow">For property owners</span>
            <h2 className="r-h2" style={{ margin: '12px 0 14px' }}>Hands-off property management</h2>
            <p className="r-lead">Let your house or apartment through RMS and we take care of the work in between — while you keep full visibility of every application and payment.</p>
            <ul className="ip-list" style={{ margin: '24px 0 28px' }}>
              {OWNER.map((o) => <li key={o}><LuCheck size={17} /> {o}</li>)}
            </ul>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Link to="/contact?topic=owner" className="r-btn r-btn--primary">List your property <LuArrowRight size={16} /></Link>
              <Link to="/faq" className="r-btn">Read the FAQs</Link>
            </div>
          </Reveal>
          <Reveal delay={0.1} style={{ position: 'relative' }}>
            <img className="ip-img" src="/images/site/apartment-building-02.jpg" alt="Apartment building managed by RMS" loading="lazy" />
            <div className="h-split__card" style={{ left: 'auto', right: -16, bottom: 24 }}>
              <span style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 600 }}><LuBell size={16} style={{ color: 'var(--brand)' }} /> New application</span>
              <span className="r-muted r-small">You&apos;ll be notified the moment a tenant applies.</span>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="r-section">
        <div className="r-container">
          <Reveal className="r-section-head r-section-head--center">
            <div>
              <span className="r-eyebrow">How we work with owners</span>
              <h2 className="r-h2">Three steps to a reliable tenant</h2>
            </div>
          </Reveal>
          <div className="ip-cards">
            {[
              { icon: LuBuilding2, t: '1. List with us', d: 'Share your property details. We visit, photograph and publish a verified listing.' },
              { icon: LuUserCheck, t: '2. We screen applicants', d: 'Applicants apply online with CNIC details; you approve the tenant you prefer.' },
              { icon: LuReceipt, t: '3. Rent, managed', d: 'Rent is collected and verified monthly; maintenance is coordinated for you.' },
            ].map((s, i) => (
              <Reveal key={s.t} delay={i * 0.08}>
                <div className="ip-card"><span className="ip-card__icon"><s.icon size={22} /></span><h3>{s.t}</h3><p>{s.d}</p></div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

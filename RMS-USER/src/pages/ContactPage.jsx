import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LuCircleCheck, LuClock, LuMail, LuMapPin, LuMessageCircle, LuPhone } from 'react-icons/lu';
import { toast } from 'react-toastify';
import PageHeader from '../components/site/PageHeader';
import Reveal from '../components/site/Reveal';
import Field from '../components/site/Field';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import SITE from '../config/site';
import { isEmail, isPhone, required, validate } from '../utils/validate';

const TOPICS = [
  { value: 'General', label: 'General question' },
  { value: 'Rental Inquiry', label: 'Looking to rent' },
  { value: 'Property Owner', label: 'I want to list my property' },
  { value: 'Tenant Support', label: 'Support for current tenants' },
  { value: 'Complaint', label: 'Complaint or feedback' },
];

export default function ContactPage() {
  const [params] = useSearchParams();
  const { user, isAuthenticated } = useAuth();
  const [v, setV] = useState({
    name: isAuthenticated ? user?.name || '' : '',
    email: isAuthenticated ? user?.email || '' : '',
    phone: isAuthenticated ? user?.phone || '' : '',
    topic: params.get('topic') === 'owner' ? 'Property Owner' : 'General',
    message: '',
  });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const on = (k) => (e) => { setV((s) => ({ ...s, [k]: e.target.value })); if (errors[k]) setErrors((x) => ({ ...x, [k]: '' })); };

  const submit = async (e) => {
    e.preventDefault();
    const errs = validate(v, {
      name: [[required, 'Please enter your name.'], [(n) => String(n).trim().length >= 3, 'Name looks too short.']],
      email: [[required, 'Please enter your email.'], [isEmail, 'Enter a valid email address.']],
      phone: [[(p) => !p || isPhone(p), 'Enter a valid Pakistani number, e.g. 0300 1234567.']],
      message: [[(m) => String(m).trim().length >= 20, 'Please write at least 20 characters so we can help.']],
    });
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      await api.request('/contact', { method: 'POST', body: { fullName: v.name.trim(), email: v.email.trim(), phone: v.phone.trim(), inquiryType: v.topic, message: v.message.trim() } });
      setDone(true);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'We couldn’t send your message. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const cards = [
    { icon: LuPhone, title: 'Call us', value: SITE.phone, href: SITE.phoneHref },
    { icon: LuMessageCircle, title: 'WhatsApp', value: 'Chat with the leasing team', href: SITE.whatsappHref },
    { icon: LuMail, title: 'Email', value: SITE.email, href: SITE.emailHref },
    { icon: LuMapPin, title: 'Office', value: SITE.address, href: SITE.mapsHref },
  ];

  return (
    <>
      <PageHeader eyebrow="Contact" title="Talk to our leasing team" crumbs={['Contact']}>
        Questions about a listing, your tenancy, or letting your property? Send us a message and we&apos;ll reply within one working day.
      </PageHeader>
      <section className="r-section">
        <div className="r-container ct-grid">
          <Reveal className="r-card r-card--pad ct-form">
            {done ? (
              <div style={{ display: 'grid', gap: 12, justifyItems: 'start', padding: '24px 0' }}>
                <span className="ip-card__icon" style={{ background: 'var(--success-50)', color: 'var(--success)' }}><LuCircleCheck size={24} /></span>
                <h2 style={{ fontSize: 24 }}>Thanks, {v.name.split(' ')[0]} — message received.</h2>
                <p className="r-muted">We&apos;ll get back to you at <strong>{v.email}</strong> within one working day. For anything urgent, call {SITE.phone}.</p>
                <button type="button" className="r-btn" onClick={() => { setDone(false); setV((s) => ({ ...s, message: '' })); }}>Send another message</button>
              </div>
            ) : (
              <form onSubmit={submit} noValidate className="r-form-grid">
                <h2 className="span-2" style={{ fontSize: 22 }}>Send us a message</h2>
                <Field label="Full name" name="name" value={v.name} onChange={on('name')} error={errors.name} autoComplete="name" />
                <Field label="Email" name="email" type="email" value={v.email} onChange={on('email')} error={errors.email} autoComplete="email" />
                <Field label="Phone (optional)" name="phone" type="tel" value={v.phone} onChange={on('phone')} error={errors.phone} placeholder="0300 1234567" autoComplete="tel" />
                <Field label="Topic" as="select" name="topic" value={v.topic} onChange={on('topic')}>
                  {TOPICS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </Field>
                <Field className="span-2" label="Message" as="textarea" name="message" rows={6} value={v.message} onChange={on('message')} error={errors.message} hint={`${v.message.trim().length}/20 characters minimum`} placeholder="How can we help?" />
                <div className="span-2" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <span className="r-hint">We never share your details with third parties.</span>
                  <button type="submit" className="r-btn r-btn--primary r-btn--lg" disabled={busy}>{busy ? 'Sending…' : 'Send message'}</button>
                </div>
              </form>
            )}
          </Reveal>
          <div className="ct-side">
            {cards.map((c, i) => (
              <Reveal key={c.title} delay={i * 0.05}>
                <a href={c.href} className="ct-card" target={c.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer">
                  <span className="ip-card__icon" style={{ margin: 0 }}><c.icon size={20} /></span>
                  <div style={{ minWidth: 0 }}><strong>{c.title}</strong><span>{c.value}</span></div>
                </a>
              </Reveal>
            ))}
            <Reveal delay={0.2}>
              <div className="ct-card" style={{ cursor: 'default' }}>
                <span className="ip-card__icon" style={{ margin: 0 }}><LuClock size={20} /></span>
                <div><strong>Office hours</strong><span>{SITE.hours}</span></div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>
    </>
  );
}

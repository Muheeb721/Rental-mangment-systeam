import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LuCircleCheck } from 'react-icons/lu';
import { toast } from 'react-toastify';
import api from '../../services/api';
import applicationService from '../../services/applicationService';
import { useAuth } from '../../contexts/AuthContext';
import Field from './Field';
import Modal from './Modal';
import { formatCnic, isCnic, isEmail, isPhone, required, todayISO, validate } from '../../utils/validate';
import { formatDate, priceText } from '../../utils/property';

const errMsg = (e, fallback) => e?.response?.data?.message || e?.message || fallback;

function Success({ title, children, action }) {
  return (
    <div style={{ display: 'grid', justifyItems: 'center', textAlign: 'center', gap: 10, padding: '12px 0 4px' }}>
      <span style={{ width: 56, height: 56, borderRadius: 16, display: 'grid', placeItems: 'center', background: 'var(--success-50)', color: 'var(--success)' }}><LuCircleCheck size={28} /></span>
      <h4 style={{ fontSize: 18 }}>{title}</h4>
      <p className="r-muted" style={{ maxWidth: 360 }}>{children}</p>
      {action}
    </div>
  );
}

const useContactDefaults = () => {
  const { user, isAuthenticated } = useAuth();
  return {
    name: isAuthenticated ? user?.name || '' : '',
    email: isAuthenticated ? user?.email || '' : '',
    phone: isAuthenticated ? user?.phone || '' : '',
  };
};

const contactRules = {
  name: [[required, 'Please enter your name.'], [(v) => String(v).trim().length >= 3, 'Name looks too short.']],
  email: [[required, 'Please enter your email.'], [isEmail, 'Enter a valid email address.']],
  phone: [[required, 'Please enter a phone number.'], [isPhone, 'Enter a valid Pakistani number, e.g. 0300 1234567.']],
};

/** Inline enquiry form shown in the property sidebar. */
export function EnquiryForm({ property }) {
  const defaults = useContactDefaults();
  const [v, setV] = useState({ ...defaults, message: `Hi, I'm interested in "${property.title}". Is it still available?` });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const on = (k) => (e) => { setV((s) => ({ ...s, [k]: e.target.value })); if (errors[k]) setErrors((x) => ({ ...x, [k]: '' })); };

  const submit = async (e) => {
    e.preventDefault();
    const errs = validate(v, { ...contactRules, message: [[(m) => String(m).trim().length >= 10, 'Please write at least a short message.']] });
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      await api.request('/property-inquiries', {
        method: 'POST',
        body: {
          fullName: v.name.trim(), email: v.email.trim(), phone: v.phone.trim(), message: v.message.trim(),
          propertyId: property.id, propertyName: property.title, inquiryType: 'Property Inquiry', preferredContactMethod: 'Phone',
        },
      });
      setDone(true);
    } catch (err) {
      toast.error(errMsg(err, 'Could not send your message. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return <Success title="Message sent">Our leasing team will get back to you shortly at {v.email}.</Success>;
  }

  return (
    <form onSubmit={submit} noValidate style={{ display: 'grid', gap: 12 }}>
      <Field name="name" placeholder="Full name" aria-label="Full name" value={v.name} onChange={on('name')} error={errors.name} autoComplete="name" />
      <Field name="email" type="email" placeholder="Email" aria-label="Email" value={v.email} onChange={on('email')} error={errors.email} autoComplete="email" />
      <Field name="phone" type="tel" placeholder="Phone, e.g. 0300 1234567" aria-label="Phone" value={v.phone} onChange={on('phone')} error={errors.phone} autoComplete="tel" />
      <Field as="textarea" name="message" aria-label="Message" rows={3} style={{ minHeight: 96 }} value={v.message} onChange={on('message')} error={errors.message} />
      <button type="submit" className="r-btn r-btn--dark r-btn--block" disabled={busy}>{busy ? 'Sending…' : 'Send message'}</button>
    </form>
  );
}

const SLOTS = ['10:00 am – 12:00 pm', '12:00 pm – 2:00 pm', '2:00 pm – 4:00 pm', '4:00 pm – 6:00 pm'];

/** Book a viewing — sent to the leasing team as a property inquiry. */
export function VisitModal({ open, onClose, property }) {
  const defaults = useContactDefaults();
  const [v, setV] = useState({ ...defaults, date: todayISO(1), slot: SLOTS[0], note: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const on = (k) => (e) => { setV((s) => ({ ...s, [k]: e.target.value })); if (errors[k]) setErrors((x) => ({ ...x, [k]: '' })); };

  const submit = async (e) => {
    e.preventDefault();
    const errs = validate(v, { ...contactRules, date: [[required, 'Choose a date.'], [(d) => d >= todayISO(1), 'Pick a date from tomorrow onwards.']] });
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      await api.request('/property-inquiries', {
        method: 'POST',
        body: {
          fullName: v.name.trim(), email: v.email.trim(), phone: v.phone.trim(),
          propertyId: property.id, propertyName: property.title, inquiryType: 'Visit Request', preferredContactMethod: 'Phone',
          message: `Visit request for ${formatDate(v.date)}, ${v.slot}.${v.note.trim() ? ` Note: ${v.note.trim()}` : ''}`,
        },
      });
      setDone(true);
    } catch (err) {
      toast.error(errMsg(err, 'Could not book the visit. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const close = () => { onClose(); setTimeout(() => setDone(false), 300); };

  return (
    <Modal open={open} onClose={close} title={done ? '' : 'Book a visit'} subtitle={done ? '' : property.title}>
      {done ? (
        <Success title="Visit requested" action={<button type="button" className="r-btn r-btn--primary" onClick={close}>Done</button>}>
          We&apos;ve received your request for {formatDate(v.date)} ({v.slot}). An agent will call {v.phone} to confirm.
        </Success>
      ) : (
        <form onSubmit={submit} noValidate className="r-form-grid">
          <Field label="Preferred date" name="date" type="date" min={todayISO(1)} value={v.date} onChange={on('date')} error={errors.date} />
          <Field label="Time slot" name="slot" as="select" value={v.slot} onChange={on('slot')}>
            {SLOTS.map((s) => <option key={s}>{s}</option>)}
          </Field>
          <Field className="span-2" label="Full name" name="name" value={v.name} onChange={on('name')} error={errors.name} autoComplete="name" />
          <Field label="Email" name="email" type="email" value={v.email} onChange={on('email')} error={errors.email} autoComplete="email" />
          <Field label="Phone" name="phone" type="tel" placeholder="0300 1234567" value={v.phone} onChange={on('phone')} error={errors.phone} autoComplete="tel" />
          <Field className="span-2" label="Anything we should know? (optional)" as="textarea" name="note" rows={3} style={{ minHeight: 90 }} value={v.note} onChange={on('note')} />
          <div className="span-2" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" className="r-btn" onClick={close}>Cancel</button>
            <button type="submit" className="r-btn r-btn--primary" disabled={busy}>{busy ? 'Sending…' : 'Request visit'}</button>
          </div>
        </form>
      )}
    </Modal>
  );
}

const DURATIONS = ['6 months', '1 year', '2 years', '3 years'];

/** Online rental application (POST /applications). Requires sign-in. */
export function ApplyModal({ open, onClose, property }) {
  const { user } = useAuth();
  const [v, setV] = useState({ name: user?.name || '', email: user?.email || '', phone: user?.phone || '', cnic: '', moveIn: todayISO(7), duration: '1 year', occupants: '2', notes: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const on = (k) => (e) => {
    const value = k === 'cnic' ? formatCnic(e.target.value) : e.target.value;
    setV((s) => ({ ...s, [k]: value }));
    if (errors[k]) setErrors((x) => ({ ...x, [k]: '' }));
  };

  const submit = async (e) => {
    e.preventDefault();
    const errs = validate(v, {
      ...contactRules,
      cnic: [[required, 'CNIC is required for rental applications.'], [isCnic, 'Use the format 35202-1234567-1.']],
      moveIn: [[required, 'Choose a move-in date.'], [(d) => d >= todayISO(0), 'Move-in date cannot be in the past.']],
      occupants: [[(o) => Number(o) >= 1 && Number(o) <= 20, 'Enter between 1 and 20 occupants.']],
    });
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const res = await applicationService.createApplication({
        propertyId: property.id, propertyTitle: property.title, propertyType: property.type, rent: property.price,
        userName: v.name.trim(), userEmail: v.email.trim(), userPhone: v.phone.trim(), cnic: v.cnic,
        preferredMoveInDate: v.moveIn, rentalDuration: v.duration, occupants: Number(v.occupants), notes: v.notes.trim(),
      });
      if (res?.success === false) throw new Error(res.message);
      setDone(true);
    } catch (err) {
      toast.error(errMsg(err, 'Could not submit your application. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const close = () => { onClose(); setTimeout(() => setDone(false), 300); };

  return (
    <Modal open={open} onClose={close} width={620} title={done ? '' : 'Apply to rent'} subtitle={done ? '' : `${property.title} · ${priceText(property)}`}>
      {done ? (
        <Success title="Application submitted" action={<Link to="/dashboard?tab=applications" className="r-btn r-btn--primary" onClick={close}>Track application</Link>}>
          Our team will review your application and notify you here and by email. You can follow its status in your dashboard.
        </Success>
      ) : (
        <form onSubmit={submit} noValidate className="r-form-grid">
          <Field label="Full name (as on CNIC)" name="name" value={v.name} onChange={on('name')} error={errors.name} autoComplete="name" />
          <Field label="CNIC" name="cnic" inputMode="numeric" placeholder="35202-1234567-1" value={v.cnic} onChange={on('cnic')} error={errors.cnic} />
          <Field label="Email" name="email" type="email" value={v.email} onChange={on('email')} error={errors.email} autoComplete="email" />
          <Field label="Phone" name="phone" type="tel" placeholder="0300 1234567" value={v.phone} onChange={on('phone')} error={errors.phone} autoComplete="tel" />
          <Field label="Move-in date" name="moveIn" type="date" min={todayISO(0)} value={v.moveIn} onChange={on('moveIn')} error={errors.moveIn} />
          <Field label="Lease duration" name="duration" as="select" value={v.duration} onChange={on('duration')}>
            {DURATIONS.map((d) => <option key={d}>{d}</option>)}
          </Field>
          <Field label="Occupants" name="occupants" type="number" min={1} max={20} value={v.occupants} onChange={on('occupants')} error={errors.occupants} />
          <div />
          <Field className="span-2" label="Message to the landlord (optional)" as="textarea" name="notes" rows={3} style={{ minHeight: 90 }} placeholder="Tell us about your household, work, or any questions." value={v.notes} onChange={on('notes')} />
          <p className="span-2 r-hint">By applying you agree to a background check of the details provided. Applying doesn&apos;t commit you to rent.</p>
          <div className="span-2" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" className="r-btn" onClick={close}>Cancel</button>
            <button type="submit" className="r-btn r-btn--primary" disabled={busy}>{busy ? 'Submitting…' : 'Submit application'}</button>
          </div>
        </form>
      )}
    </Modal>
  );
}


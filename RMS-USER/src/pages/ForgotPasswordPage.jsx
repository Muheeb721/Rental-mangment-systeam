import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LuCircleAlert, LuMail, LuMailCheck } from 'react-icons/lu';
import AuthLayout from '../components/site/AuthLayout';
import api from '../services/api';
import SITE from '../config/site';
import { isEmail } from '../utils/validate';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!isEmail(email)) errs.email = 'Enter the email address you signed up with.';
    setErrors(errs);
    setFormError('');
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      await api.request('/auth/forgot-password', { method: 'POST', body: { email: email.trim().toLowerCase() } });
      setDone(true);
    } catch (err) {
      setFormError(err?.response?.data?.message || 'We couldn’t send your request. Please try again or contact support.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title={done ? 'Check your inbox' : 'Reset your password'}
      subtitle={done ? '' : 'Enter the email on your account and we’ll send you a link to choose a new password.'}
      footer={<>Remembered it? <Link to="/login">Back to sign in</Link></>}
      image="/images/site/living-room-03.jpg"
    >
      {done ? (
        <div className="au-stack">
          <div className="r-alert r-alert--success"><LuMailCheck size={18} /> <span>If an account exists for <strong>{email}</strong>, a password reset link is on its way. The link expires soon, so use it promptly.</span></div>
          <p className="r-muted">Didn&apos;t get it? Check your spam folder, or call us on <a className="r-link" href={SITE.phoneHref}>{SITE.phone}</a> ({SITE.hours}).</p>
          <Link to="/login" className="r-btn r-btn--primary r-btn--lg r-btn--block">Back to sign in</Link>
        </div>
      ) : (
        <form className="au-stack" onSubmit={submit} noValidate>
          {formError ? <div className="r-alert r-alert--error" role="alert"><LuCircleAlert size={18} /> {formError}</div> : null}
          <div className="r-field">
            <label className="r-label" htmlFor="fp-email">Email</label>
            <div className="r-input-wrap">
              <LuMail size={17} />
              <input id="fp-email" type="email" className={`r-input ${errors.email ? 'has-error' : ''}`} value={email} onChange={(e) => { setEmail(e.target.value); setErrors({}); }} autoComplete="email" placeholder="you@example.com" />
            </div>
            {errors.email ? <span className="r-error" role="alert">{errors.email}</span> : null}
          </div>
          <button type="submit" className="r-btn r-btn--primary r-btn--lg r-btn--block" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</button>
        </form>
      )}
    </AuthLayout>
  );
}

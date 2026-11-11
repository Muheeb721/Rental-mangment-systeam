import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { toast } from 'react-toastify';
import { LuCircleAlert, LuEye, LuEyeOff } from 'react-icons/lu';
import AuthLayout from '../components/site/AuthLayout';
import Field from '../components/site/Field';
import PasswordStrength from '../components/site/PasswordStrength';
import authService from '../services/authService';
import { useAuth } from '../contexts/AuthContext';
import { readAuthResponse, safeRedirect, startSession } from '../utils/session';
import { isEmail, isPhone, required, validate } from '../utils/validate';


export default function Signup() {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const { login: authLogin } = useAuth();
  const redirect = new URLSearchParams(location.search).get('redirect') || '';
  const [v, setV] = useState({ name: '', email: '', phone: '', password: '', confirm: '', terms: false });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const on = (k) => (e) => { const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value; setV((s) => ({ ...s, [k]: val })); if (errors[k]) setErrors((x) => ({ ...x, [k]: '' })); };

  const submit = async (e) => {
    e.preventDefault();
    const errs = validate(v, {
      name: [[required, 'Please enter your full name.'], [(n) => /^[a-zA-Z\s.'-]{3,60}$/.test(n.trim()), 'Use letters only (3–60 characters).']],
      email: [[required, 'Please enter your email address.'], [isEmail, 'Enter a valid email address.']],
      phone: [[required, 'Please enter your mobile number.'], [isPhone, 'Enter a valid Pakistani number, e.g. 0300 1234567.']],
      password: [[(p) => p.length >= 8, 'Use at least 8 characters.'], [(p) => /\d/.test(p) && /[a-zA-Z]/.test(p), 'Include at least one letter and one number.']],
      confirm: [[(c, all) => c === all.password, 'Passwords don’t match.']],
      terms: [[(t) => t === true, 'Please accept the terms to continue.']],
    });
    setErrors(errs);
    setFormError('');
    if (Object.keys(errs).length) return;
    setBusy(true);
    const res = await authService.signup({ name: v.name.trim(), email: v.email.trim().toLowerCase(), phone: v.phone.trim(), password: v.password, confirmPassword: v.confirm, role: 'resident' });
    const { token, user } = readAuthResponse(res);
    if (!res?.success) {
      setBusy(false);
      if (res?.status === 409) setErrors((x) => ({ ...x, email: 'An account with this email already exists.' }));
      else setFormError(res?.message || 'We couldn’t create your account right now. Please try again.');
      return;
    }
    if (token && user) {
      await startSession({ token, user }, authLogin, dispatch);
      toast.success('Your account is ready — welcome to RMS!');
      navigate(safeRedirect(redirect), { replace: true });
    } else {
      toast.success('Account created. Please sign in.');
      navigate('/login', { replace: true });
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Save homes, apply online and track your rent — free for tenants."
      image="/images/site/house-exterior-12.jpg"
      quote="Apply for a home in minutes, then pay rent and raise maintenance requests from one dashboard."
      footer={<>Already have an account? <Link to={`/login${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''}`}>Sign in</Link></>}
    >
      <form className="au-stack" onSubmit={submit} noValidate>
        {formError ? <div className="r-alert r-alert--error" role="alert"><LuCircleAlert size={18} /> {formError}</div> : null}
        <Field label="Full name" name="name" value={v.name} onChange={on('name')} error={errors.name} autoComplete="name" placeholder="e.g. Ayesha Khan" />
        <Field label="Email" name="email" type="email" value={v.email} onChange={on('email')} error={errors.email} autoComplete="email" placeholder="you@example.com" />
        <Field label="Mobile number" name="phone" type="tel" value={v.phone} onChange={on('phone')} error={errors.phone} autoComplete="tel" placeholder="0300 1234567" />
        <div className="r-field">
          <label className="r-label" htmlFor="su-password">Password</label>
          <div className="r-input-wrap">
            <input id="su-password" type={show ? 'text' : 'password'} className={`r-input ${errors.password ? 'has-error' : ''}`} style={{ paddingLeft: 14 }} value={v.password} onChange={on('password')} autoComplete="new-password" placeholder="At least 8 characters" />
            <button type="button" className="r-input-action" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}>{show ? <LuEyeOff size={17} /> : <LuEye size={17} />}</button>
          </div>
          <PasswordStrength value={v.password} />
          {errors.password ? <span className="r-error" role="alert">{errors.password}</span> : null}
        </div>
        <Field label="Confirm password" name="confirm" type={show ? 'text' : 'password'} value={v.confirm} onChange={on('confirm')} error={errors.confirm} autoComplete="new-password" />
        <div className="r-field">
          <label className="au-check" style={{ fontSize: 14 }}><input type="checkbox" checked={v.terms} onChange={on('terms')} /> I agree to the RMS terms of use and privacy policy.</label>
          {errors.terms ? <span className="r-error" role="alert">{errors.terms}</span> : null}
        </div>
        <button type="submit" className="r-btn r-btn--primary r-btn--lg r-btn--block" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
      </form>
    </AuthLayout>
  );
}

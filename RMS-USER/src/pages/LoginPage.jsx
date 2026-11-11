import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { toast } from 'react-toastify';
import { LuCircleAlert, LuEye, LuEyeOff, LuLock, LuMail } from 'react-icons/lu';
import AuthLayout from '../components/site/AuthLayout';
import authService from '../services/authService';
import authRedirect from '../utils/authRedirect';
import { useAuth } from '../contexts/AuthContext';
import { isStaffRole, readAuthResponse, safeRedirect, startSession } from '../utils/session';
import { isEmail } from '../utils/validate';

const REMEMBER_KEY = 'rms_remembered_email';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const { login: authLogin, isAuthenticated, user } = useAuth();
  const redirect = new URLSearchParams(location.search).get('redirect') || '';

  const [email, setEmail] = useState(() => { try { return window.localStorage.getItem(REMEMBER_KEY) || ''; } catch { return ''; } });
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isAuthenticated && user?.isLoggedIn) navigate(isStaffRole(user.role) ? '/admin' : safeRedirect(redirect), { replace: true });
  }, [isAuthenticated, user, navigate, redirect]);

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!email.trim()) errs.email = 'Please enter your email address.';
    else if (!isEmail(email)) errs.email = 'That email address doesn’t look right.';
    if (!password) errs.password = 'Please enter your password.';
    setErrors(errs);
    setFormError('');
    if (Object.keys(errs).length) return;

    setBusy(true);
    const res = await authService.login(email.trim(), password);
    const { token, user: u } = readAuthResponse(res);
    if (!res?.success || !token || !u) {
      setBusy(false);
      setFormError(res?.status === 401 || res?.status === 400 ? 'Incorrect email or password. Please try again.' : res?.message || 'We couldn’t sign you in right now. Please try again shortly.');
      return;
    }
    try {
      if (remember) window.localStorage.setItem(REMEMBER_KEY, email.trim());
      else window.localStorage.removeItem(REMEMBER_KEY);
    } catch { /* ignore */ }
    const session = await startSession({ token, user: u }, authLogin, dispatch);
    toast.success(`Welcome back, ${session.name?.split(' ')[0] || 'there'}!`);
    const pending = authRedirect.consumePendingAction();
    navigate(isStaffRole(session.role) ? '/admin' : safeRedirect(pending?.returnRoute || redirect), { replace: true });
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to manage applications, saved homes and rent payments."
      footer={<>New to RMS? <Link to={`/signup${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''}`}>Create an account</Link></>}
    >
      <form className="au-stack" onSubmit={submit} noValidate>
        {formError ? <div className="r-alert r-alert--error" role="alert"><LuCircleAlert size={18} /> {formError}</div> : null}
        <div className="r-field">
          <label className="r-label" htmlFor="login-email">Email</label>
          <div className="r-input-wrap">
            <LuMail size={17} />
            <input id="login-email" type="email" className={`r-input ${errors.email ? 'has-error' : ''}`} value={email} onChange={(e) => { setEmail(e.target.value); setErrors((x) => ({ ...x, email: '' })); }} autoComplete="email" placeholder="you@example.com" aria-invalid={Boolean(errors.email)} />
          </div>
          {errors.email ? <span className="r-error" role="alert">{errors.email}</span> : null}
        </div>
        <div className="r-field">
          <label className="r-label" htmlFor="login-password">Password</label>
          <div className="r-input-wrap">
            <LuLock size={17} />
            <input id="login-password" type={show ? 'text' : 'password'} className={`r-input ${errors.password ? 'has-error' : ''}`} value={password} onChange={(e) => { setPassword(e.target.value); setErrors((x) => ({ ...x, password: '' })); }} autoComplete="current-password" placeholder="Your password" aria-invalid={Boolean(errors.password)} />
            <button type="button" className="r-input-action" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}>{show ? <LuEyeOff size={17} /> : <LuEye size={17} />}</button>
          </div>
          {errors.password ? <span className="r-error" role="alert">{errors.password}</span> : null}
        </div>
        <div className="au-row">
          <label className="au-check"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Remember me</label>
          <Link to="/forgot-password">Forgot password?</Link>
        </div>
        <button type="submit" className="r-btn r-btn--primary r-btn--lg r-btn--block" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </AuthLayout>
  );
}

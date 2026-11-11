import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { LuCircleAlert, LuEye, LuEyeOff } from 'react-icons/lu';
import AuthLayout from '../components/site/AuthLayout';
import Field from '../components/site/Field';
import PasswordStrength from '../components/site/PasswordStrength';
import api from '../services/api';

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';
  const email = params.get('email') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (password.length < 8) errs.password = 'Use at least 8 characters.';
    else if (!/\d/.test(password) || !/[a-zA-Z]/.test(password)) errs.password = 'Include at least one letter and one number.';
    if (confirm !== password) errs.confirm = 'Passwords don’t match.';
    setErrors(errs);
    setFormError('');
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const res = await api.request('/auth/reset-password', { method: 'POST', body: { token, email, password, confirmPassword: confirm } });
      toast.success(res?.message || 'Your password has been reset. Please sign in.');
      navigate('/login', { replace: true });
    } catch (err) {
      setFormError(err?.response?.data?.message || 'We couldn’t reset your password. Please request a new link.');
    } finally {
      setBusy(false);
    }
  };

  if (!token) {
    return (
      <AuthLayout title="Reset link missing" subtitle="This page needs the link from your password reset email." footer={<Link to="/login">Back to sign in</Link>}>
        <Link to="/forgot-password" className="r-btn r-btn--primary r-btn--lg r-btn--block">Request a new reset link</Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Choose a new password"
      subtitle={email ? `Resetting the password for ${email}.` : 'Enter and confirm your new password.'}
      footer={<>Remembered it? <Link to="/login">Back to sign in</Link></>}
      image="/images/site/living-room-03.jpg"
    >
      <form className="au-stack" onSubmit={submit} noValidate>
        {formError ? (
          <div className="r-alert r-alert--error" role="alert">
            <LuCircleAlert size={18} />
            <span>{formError} <Link className="r-link" to="/forgot-password">Request a new link</Link></span>
          </div>
        ) : null}
        <div className="r-field">
          <label className="r-label" htmlFor="rp-password">New password</label>
          <div className="r-input-wrap">
            <input id="rp-password" type={show ? 'text' : 'password'} className={`r-input ${errors.password ? 'has-error' : ''}`} style={{ paddingLeft: 14 }} value={password} onChange={(e) => { setPassword(e.target.value); setErrors((x) => ({ ...x, password: '' })); }} autoComplete="new-password" placeholder="At least 8 characters" />
            <button type="button" className="r-input-action" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}>{show ? <LuEyeOff size={17} /> : <LuEye size={17} />}</button>
          </div>
          <PasswordStrength value={password} />
          {errors.password ? <span className="r-error" role="alert">{errors.password}</span> : null}
        </div>
        <Field label="Confirm new password" name="confirm" type={show ? 'text' : 'password'} value={confirm} onChange={(e) => { setConfirm(e.target.value); setErrors((x) => ({ ...x, confirm: '' })); }} error={errors.confirm} autoComplete="new-password" />
        <button type="submit" className="r-btn r-btn--primary r-btn--lg r-btn--block" disabled={busy}>{busy ? 'Saving…' : 'Reset password'}</button>
      </form>
    </AuthLayout>
  );
}

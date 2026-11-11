import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { api } from '../lib/api';
import { Button, Field } from '../components/ui';

/** Admin password reset: email -> 6-digit OTP -> new password. */
export default function ForgotPasswordView() {
  const navigate = useNavigate();
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const run = async (fn) => {
    setError('');
    setMessage('');
    setLoading(true);
    try { await fn(); } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  const sendCode = (event) => {
    event?.preventDefault();
    run(async () => {
      const result = await api.post('/auth/admin/forgot-password', { email: email.trim() });
      setMessage(result.message);
      setStep('otp');
    });
  };
  const verify = (event) => {
    event.preventDefault();
    run(async () => {
      const result = await api.post('/auth/admin/verify-otp', { email: email.trim(), otp });
      setResetToken(result.resetToken);
      setStep('password');
    });
  };
  const reset = (event) => {
    event.preventDefault();
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    run(async () => {
      const result = await api.post('/auth/admin/reset-password', { email: email.trim(), resetToken, password, confirmPassword });
      navigate('/login', { replace: true, state: { passwordResetMessage: result.message } });
    });
  };

  return (
    <div className="full-center" style={{ padding: 16 }}>
      <div className="card" style={{ width: '100%', maxWidth: 420 }}>
        <div className="card-body stack">
          <div className="stat-icon tone-blue"><KeyRound size={20} /></div>
          <div>
            <h2 style={{ fontSize: 22 }}>{step === 'email' ? 'Forgot password?' : step === 'otp' ? 'Check your email' : 'Set a new password'}</h2>
            <p className="muted mt-8">
              {step === 'email' && 'We will email a six-digit code to the admin address.'}
              {step === 'otp' && `Enter the code sent to ${email}. It expires in 10 minutes.`}
              {step === 'password' && 'Choose a new password (at least 8 characters).'}
            </p>
          </div>
          {message && <div className="alert alert-success">{message}</div>}
          {error && <div className="alert alert-error" role="alert">{error}</div>}
          {step === 'email' && (
            <form className="stack" onSubmit={sendCode}>
              <Field label="Admin email"><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" autoFocus /></Field>
              <Button type="submit" variant="primary" loading={loading} disabled={!email.trim()}>Send code</Button>
            </form>
          )}
          {step === 'otp' && (
            <form className="stack" onSubmit={verify}>
              <Field label="Six-digit code"><input className="input" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" autoFocus /></Field>
              <Button type="submit" variant="primary" loading={loading} disabled={otp.length !== 6}>Verify code</Button>
              <Button variant="ghost" onClick={sendCode} disabled={loading}>Resend code</Button>
            </form>
          )}
          {step === 'password' && (
            <form className="stack" onSubmit={reset}>
              <Field label="New password"><input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" autoFocus /></Field>
              <Field label="Confirm password"><input className="input" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" /></Field>
              <Button type="submit" variant="primary" loading={loading}>Reset password</Button>
            </form>
          )}
          <Link to="/login" className="small strong">← Back to sign in</Link>
        </div>
      </div>
    </div>
  );
}

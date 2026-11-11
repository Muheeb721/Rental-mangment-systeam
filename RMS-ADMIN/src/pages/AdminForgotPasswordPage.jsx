import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './LoginPage.css';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

function AdminForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('admin@rms.com');
  const [otp, setOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const request = async (endpoint, payload) => {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.success) throw new Error(result?.message || 'Unable to complete password reset.');
    return result;
  };

  const handleSendCode = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const result = await request('/auth/admin/forgot-password', { email });
      setMessage(result.message);
      setStep('otp');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const result = await request('/auth/admin/verify-otp', { email, otp });
      setResetToken(result.resetToken);
      setStep('password');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (event) => {
    event.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const result = await request('/auth/admin/reset-password', { email, resetToken, password, confirmPassword });
      navigate('/login', { replace: true, state: { passwordResetMessage: result.message } });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-shell login-page">
      <div className="login-card">
        <div className="login-visual">
          <div className="brand-badge">RMS</div>
          <span className="visual-label">Property Management</span>
          <h1>Account recovery</h1>
          <p>Verify your admin email to securely choose a new password.</p>
        </div>
        <div className="login-panel">
          <div className="brand-block">
            <div className="mini-brand">RMS Admin</div>
            <h2>{step === 'email' ? 'Forgot password?' : step === 'otp' ? 'Verify your email' : 'Set a new password'}</h2>
            <p>
              {step === 'email' && 'We will send a six-digit code to the admin email address.'}
              {step === 'otp' && `Enter the code sent to ${email}. It expires in 10 minutes.`}
              {step === 'password' && 'Choose a password with at least 6 characters.'}
            </p>
          </div>

          {message && <div role="status" className="success-text">{message}</div>}
          {error && <div role="alert" className="error-text">{error}</div>}

          {step === 'email' && (
            <form onSubmit={handleSendCode} className="login-form">
              <label>
                Admin email address
                <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" />
              </label>
              <button type="submit" className="primary-button full-width" disabled={loading}>
                {loading ? 'Sending code...' : 'Send OTP'}
              </button>
            </form>
          )}

          {step === 'otp' && (
            <form onSubmit={handleVerifyCode} className="login-form">
              <label>
                Six-digit code
                <input value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" required />
              </label>
              <button type="submit" className="primary-button full-width" disabled={loading || otp.length !== 6}>
                {loading ? 'Verifying...' : 'Verify code'}
              </button>
              <button type="button" className="password-toggle" onClick={handleSendCode} disabled={loading}>
                {loading ? 'Sending...' : 'Resend OTP'}
              </button>
            </form>
          )}

          {step === 'password' && (
            <form onSubmit={handleResetPassword} className="login-form">
              <label>
                New password
                <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={6} autoComplete="new-password" required />
              </label>
              <label>
                Confirm password
                <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={6} autoComplete="new-password" required />
              </label>
              <button type="submit" className="primary-button full-width" disabled={loading}>
                {loading ? 'Saving password...' : 'Reset password'}
              </button>
            </form>
          )}
          <p style={{ marginTop: 24 }}><Link to="/login">Back to admin login</Link></p>
        </div>
      </div>
    </div>
  );
}

export default AdminForgotPasswordPage;

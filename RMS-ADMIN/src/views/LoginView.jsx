import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { BarChart3, Building2, Eye, EyeOff, LockKeyhole, ShieldCheck } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { Button, Field } from '../components/ui';

export default function LoginView() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
      navigate('/', { replace: true });
    } catch (loginError) {
      setError(loginError.message || 'Unable to sign in.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-visual">
        <div className="row"><div className="brand-mark">RMS</div><strong style={{ fontSize: 16 }}>RMS Admin</strong></div>
        <div>
          <h1>Manage every rental in DHA &amp; Askari from one place.</h1>
          <p>Listings, bookings, rent collection, maintenance and tenants, all connected to the live RMS website.</p>
          <div className="auth-points">
            <div><Building2 size={18} /> Publish properties with photos in minutes</div>
            <div><ShieldCheck size={18} /> Approve bookings and rent applications</div>
            <div><BarChart3 size={18} /> Track revenue, dues and occupancy</div>
          </div>
        </div>
        <small style={{ color: '#8ea2c3' }}>© {new Date().getFullYear()} RMS · Residential Management System</small>
      </div>

      <div className="auth-form-wrap">
        <form className="auth-form" onSubmit={submit} noValidate>
          <div>
            <div className="stat-icon tone-blue" style={{ marginBottom: 14 }}><LockKeyhole size={20} /></div>
            <h2>Sign in to admin</h2>
            <p className="muted mt-8">Use your administrator account.</p>
          </div>
          {location.state?.passwordResetMessage && <div className="alert alert-success">{location.state.passwordResetMessage}</div>}
          {error && <div className="alert alert-error" role="alert">{error}</div>}
          <Field label="Email address" htmlFor="email">
            <input id="email" name="email" className="input" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@rental.com" autoFocus />
          </Field>
          <Field label="Password" htmlFor="password">
            <div style={{ position: 'relative' }}>
              <input id="password" name="password" className="input" type={show ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" style={{ paddingRight: 40 }} />
              <button type="button" className="icon-btn" style={{ position: 'absolute', right: 3, top: 3 }} onClick={() => setShow((value) => !value)} aria-label={show ? 'Hide password' : 'Show password'}>
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </Field>
          <div className="row spread">
            <span />
            <Link to="/forgot-password" className="small strong">Forgot password?</Link>
          </div>
          <Button type="submit" variant="primary" size="lg" loading={loading} className="btn-block">Sign in</Button>
        </form>
      </div>
    </div>
  );
}

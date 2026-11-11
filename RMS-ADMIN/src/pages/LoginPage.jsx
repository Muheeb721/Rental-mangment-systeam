import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import './LoginPage.css';

function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('admin@rms.com');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const location = useLocation();
  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const success = await onLogin(email, password);
      if (!success) {
        setError('Please enter a valid admin email and password.');
        return;
      }
      navigate('/', { replace: true });
    } finally {
      setLoading(false);
    }
  };

  const navigate = useNavigate();

  return (
    <div className="login-shell login-page">
      <div className="login-card">
        <div className="login-visual">
          <div className="brand-badge">RMS</div>
          <span className="visual-label">Property Management</span>
          <h1>Welcome back</h1>
          <p>Secure access to your operations dashboard and admin tools.</p>

          <ul className="feature-list">
            <li>Live property insights</li>
            <li>Bookings and payments</li>
            <li>Users and notifications</li>
          </ul>
        </div>

        <div className="login-panel">
          <div className="brand-block">
            <div className="mini-brand">RMS Admin</div>
            <h2>Sign in</h2>
            <p>Use your admin account to continue</p>
            {location.state?.passwordResetMessage && <div role="status" className="success-text">{location.state.passwordResetMessage}</div>}
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            <label>
              Email Address
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@example.com" required />
            </label>
            <label>
              Password
              <div className="password-field-wrap">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </label>
            <Link to="/forgot-password" style={{ color: '#a7f3d0', alignSelf: 'flex-end' }}>Forgot Password?</Link>
            {error && <div className="error-text">{error}</div>}
            <button type="submit" className="primary-button full-width" disabled={loading}>{loading ? 'Signing in...' : 'Login to Dashboard'}</button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;

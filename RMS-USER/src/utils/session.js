import { login as reduxLogin } from '../redux/store';
import { saveSessionUser } from '../services/notificationService.jsx';

export const isStaffRole = (role) => ['admin', 'owner', 'manager'].includes(String(role || '').toLowerCase());

/** Extract { token, user } from the various auth response shapes the backend returns. */
export function readAuthResponse(res) {
  const data = res?.data ?? {};
  const inner = data?.result ?? data;
  return {
    token: inner?.token ?? data?.token ?? res?.token ?? '',
    user: inner?.user ?? data?.user ?? res?.user ?? null,
  };
}

/** Persist a session in AuthContext, Redux and localStorage (used for refresh continuity). */
export async function startSession({ token, user }, authLogin, dispatch) {
  const now = new Date();
  const fullUser = {
    ...user,
    id: user?.id || user?._id || '',
    name: user?.name || (user?.email || '').split('@')[0],
    email: user?.email || '',
    phone: user?.phone || '',
    role: user?.role || 'resident',
    isLoggedIn: true,
    loginDate: now.toLocaleDateString('en-PK'),
    loginTime: now.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' }),
  };
  const sessionUser = saveSessionUser(fullUser);
  const normalized = await authLogin({ user: fullUser, token });
  try {
    window.localStorage.setItem('rms_auth_session', JSON.stringify(normalized));
    window.localStorage.setItem('rms_token', token);
  } catch {
    // storage unavailable — session stays in memory
  }
  dispatch(reduxLogin(sessionUser));
  return normalized;
}

export const safeRedirect = (value, fallback = '/dashboard') => {
  if (!value || typeof value !== 'string') return fallback;
  try {
    const decoded = decodeURIComponent(value);
    return decoded.startsWith('/') && !decoded.startsWith('//') && !/^\/(login|signup|register)/.test(decoded) ? decoded : fallback;
  } catch {
    return fallback;
  }
};

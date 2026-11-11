import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const AuthContext = createContext(null);

// in-memory keys - do NOT persist sensitive tokens in localStorage
const TOKEN_KEY = '__rms_inmemory_token';
const USER_KEY = '__rms_inmemory_user';

const normalizeRole = (value) => (typeof value === 'string' ? value.toLowerCase() : 'user');

const readStoredUser = () => {
  if (typeof window === 'undefined') return null;
  try {
    const saved = window[USER_KEY] || null;
    if (saved && typeof saved === 'object') return saved;
    // fallback to localStorage-stored session (persisted on login)
    try {
      const raw = window.localStorage.getItem('rms_auth_session');
      if (raw) {
        const parsed = JSON.parse(raw);
        return parsed;
      }
    } catch (e) {
      // ignore
    }
    return null;
  } catch (error) {
    console.warn('Unable to read stored user from memory', error);
    return null;
  }
};

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => {
    if (typeof window === 'undefined') return '';
    return window[TOKEN_KEY] || window.localStorage.getItem('rms_token') || '';
  });

  const [user, setUser] = useState(() => readStoredUser() || {
    id: '',
    name: '',
    email: '',
    role: 'user',
    isLoggedIn: false,
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (token) window[TOKEN_KEY] = token; else delete window[TOKEN_KEY];
    // also expose __RMS_AUTH_TOKEN for apiClient interceptor
    if (token) window.__RMS_AUTH_TOKEN = token; else delete window.__RMS_AUTH_TOKEN;
  }, [token]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (user && user.isLoggedIn) window[USER_KEY] = user; else delete window[USER_KEY];
  }, [user]);

  const login = async ({ user: userData, token: authToken }) => {
    const normalizedUser = {
      ...userData,
      id: userData?.id || userData?._id || userData?.userId || '',
      role: normalizeRole(userData?.role || 'user'),
      isLoggedIn: true,
    };

    const resolvedToken = authToken || token || '';
    setUser(normalizedUser);
    setToken(resolvedToken);

    if (typeof window !== 'undefined') {
      try {
        if (resolvedToken) {
          window.__RMS_AUTH_TOKEN = resolvedToken;
          window.__rms_inmemory_token = resolvedToken;
          window.localStorage.setItem('rms_token', resolvedToken);
          if (['admin', 'owner', 'manager'].includes(normalizeRole(normalizedUser.role))) {
            window.localStorage.setItem('rms_admin_token', resolvedToken);
          }
        }
        const sessionPayload = JSON.stringify(normalizedUser || {});
        window.localStorage.setItem('rms_auth_session', sessionPayload);
        window.localStorage.setItem('rms_user_role', normalizedUser.role || 'resident');
      } catch (e) {
        // ignore session storage issues
      }
    }

    return normalizedUser;
  };

  const logout = () => {
    setUser({
      id: '',
      name: '',
      email: '',
      role: 'user',
      isLoggedIn: false,
    });
    setToken('');
    // clear persisted session traces
    if (typeof window !== 'undefined') {
      try {
        delete window.__RMS_AUTH_TOKEN;
        delete window.__rms_inmemory_token;
        delete window[USER_KEY];
        window.localStorage.removeItem('rms_auth_session');
        window.localStorage.removeItem('rms_user_role');
        window.localStorage.removeItem('rms_admin_auth');
        window.localStorage.removeItem('rms_admin_token');
        window.localStorage.removeItem('rms_token');
        window.localStorage.removeItem('rms_remembered_email');
        window.sessionStorage?.removeItem?.('rms_auth_session');
      } catch (e) {
        // ignore
      }
    }
  };


  const isAuthenticated = Boolean(token || user?.isLoggedIn);
  const isAdmin = ['admin', 'owner', 'manager'].includes(normalizeRole(user?.role));

  const value = useMemo(
    () => ({
      token,
      user,
      setUser,
      setToken,
      login,
      logout,
      isAuthenticated,
      isAdmin,
    }),
    [token, user, isAuthenticated, isAdmin],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}

export default AuthContext;

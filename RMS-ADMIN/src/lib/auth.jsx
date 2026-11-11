/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, getToken, setToken } from './api';

const AuthContext = createContext(null);

/** Holds the signed-in admin. The JWT lives in localStorage (rms_admin_token) and is verified via /auth/me on load. */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(Boolean(getToken()));

  useEffect(() => {
    if (!getToken()) return undefined;
    let active = true;
    api.get('/auth/me')
      .then((response) => {
        if (!active) return;
        if (String(response.data?.role).toLowerCase() === 'admin') setUser(response.data);
        else setToken('');
      })
      .catch(() => { if (active) setToken(''); })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const onUnauthorized = () => setUser(null);
    window.addEventListener('rms-admin:unauthorized', onUnauthorized);
    return () => window.removeEventListener('rms-admin:unauthorized', onUnauthorized);
  }, []);

  const login = useCallback(async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    const token = response.data?.token || response.token;
    const account = response.data?.user || response.user;
    if (String(account?.role || '').toLowerCase() !== 'admin') {
      throw new Error('This account does not have admin access.');
    }
    setToken(token);
    setUser(account);
    return account;
  }, []);

  const logout = useCallback(() => {
    setToken('');
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, setUser, checking, login, logout }), [user, checking, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

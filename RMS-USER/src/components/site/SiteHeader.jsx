import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { AnimatePresence, motion } from 'framer-motion';
import {
  LuBookmark, LuChevronDown, LuCreditCard, LuHeart, LuLayoutDashboard, LuLogOut, LuMenu, LuUser, LuWrench, LuX,
} from 'react-icons/lu';
import Logo from './Logo';
import NotificationBell from '../Notifications/NotificationBell';
import { useAuth } from '../../contexts/AuthContext';
import { logout as reduxLogout } from '../../redux/store';
import { useFavoriteIds, syncFavorites } from '../../hooks/useFavoriteIds';

const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/properties', label: 'Properties' },
  { to: '/areas', label: 'Areas' },
  { to: '/services', label: 'Services' },
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
];

const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join('') || 'U';

function UserMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const location = useLocation();

  useEffect(() => { setOpen(false); }, [location.pathname]);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const first = (user?.name || 'Account').split(' ')[0];
  return (
    <div className="r-usermenu" ref={ref}>
      <button type="button" className="r-usermenu__btn" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="menu">
        <span className="r-avatar" style={{ width: 30, height: 30, fontSize: 12 }}>{initials(user?.name)}</span>
        <span className="hide-mobile" style={{ maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{first}</span>
        <LuChevronDown size={16} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div className="r-usermenu__pop" role="menu" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
            <div className="r-usermenu__head">
              <strong>{user?.name || 'My account'}</strong>
              <span>{user?.email}</span>
            </div>
            <Link className="r-menu-item" to="/dashboard"><LuLayoutDashboard size={16} /> Dashboard</Link>
            <Link className="r-menu-item" to="/dashboard?tab=saved"><LuHeart size={16} /> Saved homes</Link>
            <Link className="r-menu-item" to="/dashboard?tab=searches"><LuBookmark size={16} /> Saved searches</Link>
            <Link className="r-menu-item" to="/dashboard?tab=payments"><LuCreditCard size={16} /> Rent &amp; payments</Link>
            <Link className="r-menu-item" to="/dashboard?tab=maintenance"><LuWrench size={16} /> Maintenance</Link>
            <Link className="r-menu-item" to="/dashboard?tab=profile"><LuUser size={16} /> Profile</Link>
            <div style={{ height: 1, background: 'var(--line-2)', margin: '6px 0' }} />
            <button type="button" className="r-menu-item" onClick={onLogout}><LuLogOut size={16} /> Sign out</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function SiteHeader({ overlay = false }) {
  const [scrolled, setScrolled] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const { user, isAuthenticated, logout } = useAuth();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { count } = useFavoriteIds();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => { setDrawer(false); }, [location.pathname]);

  useEffect(() => {
    if (isAuthenticated) syncFavorites(dispatch).catch(() => {});
  }, [dispatch, isAuthenticated]);

  const handleLogout = () => {
    logout();
    dispatch(reduxLogout());
    navigate('/');
  };

  return (
    <>
      <header className={`r-header ${scrolled ? 'is-scrolled' : ''} ${overlay ? 'is-overlay' : ''}`}>
        <div className="r-container r-header__inner">
          <Logo />
          <nav className="r-nav" aria-label="Main">
            {NAV.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `r-nav__link ${isActive ? 'is-active' : ''}`}>
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="r-header__actions">
            {isAuthenticated ? (
              <>
                <Link to="/dashboard?tab=saved" className="r-btn r-btn--ghost r-btn--icon hide-mobile" aria-label={`Saved homes (${count})`} style={{ position: 'relative', color: overlay && !scrolled ? '#fff' : undefined }}>
                  <LuHeart size={19} />
                  {count ? <span className="r-dot-count">{count}</span> : null}
                </Link>
                <div className="r-bell-wrap"><NotificationBell /></div>
                <UserMenu user={user} onLogout={handleLogout} />
              </>
            ) : (
              <>
                <Link to="/login" className={`r-btn ${overlay && !scrolled ? 'r-btn--light' : 'r-btn--ghost'} hide-mobile`}>Sign in</Link>
                <Link to="/signup" className="r-btn r-btn--primary hide-mobile">Create account</Link>
              </>
            )}
            <button type="button" className={`r-btn r-btn--icon r-header__burger ${overlay && !scrolled ? 'r-btn--light' : ''}`} onClick={() => setDrawer(true)} aria-label="Open menu">
              <LuMenu size={20} />
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {drawer && (
          <>
            <motion.div className="r-drawer-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDrawer(false)} />
            <motion.aside className="r-drawer" data-lenis-prevent initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'tween', duration: 0.32, ease: [0.22, 1, 0.36, 1] }} aria-label="Menu">
              <div className="r-drawer__head">
                <Logo />
                <button type="button" className="r-btn r-btn--ghost r-btn--icon" onClick={() => setDrawer(false)} aria-label="Close menu"><LuX size={20} /></button>
              </div>
              <nav>
                {NAV.map((item) => (
                  <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => (isActive ? 'is-active' : '')}>{item.label}</NavLink>
                ))}
                {isAuthenticated ? <NavLink to="/dashboard" className={({ isActive }) => (isActive ? 'is-active' : '')}>Dashboard</NavLink> : null}
              </nav>
              <div className="r-drawer__foot">
                {isAuthenticated ? (
                  <button type="button" className="r-btn r-btn--block" onClick={handleLogout}><LuLogOut size={16} /> Sign out</button>
                ) : (
                  <>
                    <Link to="/login" className="r-btn r-btn--block">Sign in</Link>
                    <Link to="/signup" className="r-btn r-btn--primary r-btn--block">Create account</Link>
                  </>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

import { Layout } from "antd";
import {
  HomeOutlined,
  InfoCircleOutlined,
  CompassOutlined,
  PhoneOutlined,
  AppstoreOutlined,
  UserOutlined,
  DashboardOutlined,
  LogoutOutlined,
} from "@ant-design/icons";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { logout } from "../redux/store";
import { useAuth } from "../contexts/AuthContext";
import NotificationBell from "./Notifications/NotificationBell";
import "../pages/header.css";

const { Header } = Layout;

function HeaderNav() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const authContext = useAuth();
  const { theme, user } = useSelector((state) => state.auth);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [siteContent, setSiteContent] = useState({
    brandName: 'RMS',
    brandTagline: 'Residential Management System',
  });
  const isLoggedIn = Boolean(user?.isLoggedIn || user?.email);

  useEffect(() => {
    let active = true;

    fetch('/api/site-content')
      .then((response) => response.json())
      .then((result) => {
        if (!active || !result?.success || !result?.data) return;
        setSiteContent((prev) => ({ ...prev, ...result.data }));
      })
      .catch(() => {
        // keep defaults
      });

    return () => {
      active = false;
    };
  }, []);

  const handleLogout = () => {
    try {
      authContext?.logout?.();
    } catch (e) {
      // ignore
    }
    dispatch(logout());
    window.localStorage.removeItem('rms_auth_session');
    window.localStorage.removeItem('rms_user_role');
    window.localStorage.removeItem('rms_token');
    window.localStorage.removeItem('rms_admin_token');
    window.localStorage.removeItem('rms_remembered_email');
    navigate('/login', { replace: true });
    window.location.replace('/login');
  };

  const navItems = [
    { to: "/", label: "Home", icon: <HomeOutlined /> },
    { to: "/about", label: "About", icon: <InfoCircleOutlined /> },
    { to: "/services", label: "Services", icon: <AppstoreOutlined /> },
    { to: "/properties", label: "Properties", icon: <CompassOutlined /> },
    { to: "/contact", label: "Contact", icon: <PhoneOutlined /> },
  ];

  return (
    <Header
      className="topbar"
      style={{
        background: theme === "dark" ? "#0b2450" : "rgba(255,255,255,0.9)",
        position: "relative",
        zIndex: 100,
        backdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(231,235,242,0.9)",
      }}
    >
      <div className="topbar-inner">
        <Link to="/" className="brand-link" style={{ color: theme === "dark" ? "#fff" : "#0b2450" }}>
          <div className="brand-mark">🏠</div>
          <div className="brand-copy">
            <div className="brand-name">{siteContent.brandName || 'RMS'}</div>
            <div className="brand-tagline">{siteContent.brandTagline || 'Residential Management System'}</div>
          </div>
        </Link>

        <nav className="topbar-nav" aria-label="Main navigation">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                isActive ? "top-nav-link active" : "top-nav-link"
              }
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <button
          type="button"
          className="hamburger"
          aria-label="Toggle menu"
          onClick={() => setIsMenuOpen((s) => !s)}
        >
          <span className={isMenuOpen ? "line open" : "line"} />
          <span className={isMenuOpen ? "line open" : "line"} />
          <span className={isMenuOpen ? "line open" : "line"} />
        </button>

        <div className="topbar-actions">
          <NotificationBell />
          {isLoggedIn ? (
            <>
              <Link to="/dashboard" className="btn-primary header-action-btn">
                <DashboardOutlined />
                <span>Dashboard</span>
              </Link>
              <Link to="/profile" className="btn-secondary header-action-btn">
                <UserOutlined />
                <span>{user?.name ? user.name.split(" ")[0] : "Profile"}</span>
              </Link>
              <button type="button" className="btn-secondary header-action-btn" onClick={handleLogout}>
                <LogoutOutlined />
                <span>Logout</span>
              </button>
            </>
          ) : (
            <Link to="/login" className="btn-primary header-action-btn">
              <UserOutlined />
              <span>Login</span>
            </Link>
          )}
        </div>

        <div className={isMenuOpen ? "mobile-menu open" : "mobile-menu"}>
          <div className="mobile-menu-inner">
            <nav className="mobile-nav">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    isActive ? "top-nav-link active" : "top-nav-link"
                  }
                  onClick={() => setIsMenuOpen(false)}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </nav>

            <div className="mobile-actions">
              {isLoggedIn ? (
                <>
                  <Link to="/dashboard" className="btn-primary" onClick={() => setIsMenuOpen(false)}>
                    Dashboard
                  </Link>
                  <Link to="/profile" className="btn-secondary" onClick={() => setIsMenuOpen(false)}>
                    Profile
                  </Link>
                  <button type="button" className="btn-secondary" onClick={() => { setIsMenuOpen(false); handleLogout(); }}>
                    Logout
                  </button>
                </>
              ) : (
                <Link to="/login" className="btn-primary" onClick={() => setIsMenuOpen(false)}>
                  Login
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </Header>
  );
}

export default HeaderNav;

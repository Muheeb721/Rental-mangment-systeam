import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  HomeOutlined,
  ApartmentOutlined,
  RightOutlined,
  MenuOutlined,
  HeartOutlined,
  BellOutlined,
  UserOutlined,
  LogoutOutlined,
  SettingOutlined,
  FileTextOutlined,
  DollarCircleOutlined,
} from '@ant-design/icons';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../redux/store';
import { useAuth } from '../contexts/AuthContext';
import './Sidebar.css';

function Sidebar({ collapsed, onToggle }) {
  const [openMobile, setOpenMobile] = useState(false);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const auth = useSelector((s)=>s.auth || {});
  const authContext = useAuth();

  const handleLogout = () => {
    try {
      if (authContext && typeof authContext.logout === 'function') authContext.logout();
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

  const menu = [
    { to: '/', label: 'Dashboard', icon: <HomeOutlined /> },
    { to: '/properties', label: 'Properties', icon: <ApartmentOutlined /> },
    { to: '/bookings', label: 'Bookings', icon: <FileTextOutlined /> },
    { to: '/admin/applications', label: 'Applications', icon: <FileTextOutlined /> },
    { to: '/payments', label: 'Payments', icon: <DollarCircleOutlined /> },
    { to: '/upload-payment-proof', label: 'Upload Payment Proof', icon: <DollarCircleOutlined /> },
    { to: '/favorites', label: 'Favorites', icon: <HeartOutlined /> },
    { to: '/notifications', label: 'Notifications', icon: <BellOutlined /> },
    { to: '/profile', label: 'Profile', icon: <UserOutlined /> },
  ];
  const [openAll, setOpenAll] = useState(false);

  const allPages = [
    { to: '/', label: 'Home' },
    { to: '/about', label: 'About' },
    { to: '/services', label: 'Services' },
    { to: '/demo', label: 'Demo' },
    { to: '/demo/house', label: 'Demo - House' },
    { to: '/demo/hostel', label: 'Demo - Hostel' },
    { to: '/demo/flats', label: 'Demo - Flats' },
    { to: '/demo/rooms', label: 'Demo - Rooms' },
    { to: '/demo/apartments', label: 'Demo - Apartments' },
    { to: '/contact', label: 'Contact' },
    { to: '/faq', label: 'FAQ' },
    { to: '/properties', label: 'All Properties' },
    { to: '/compare', label: 'Compare' },
    { to: '/saved-searches', label: 'Saved Searches' },
    { to: '/ai-recommendations', label: 'AI Recommendations' },
    { to: '/bookings', label: 'Bookings' },
    { to: '/admin/applications', label: 'Applications' },
    { to: '/maintenance', label: 'Maintenance' },
    { to: '/hostels', label: 'Hostels' },
    { to: '/favorites', label: 'Favorites' },
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/profile', label: 'Profile' },
    { to: '/payments', label: 'Payments' },
    { to: '/my-rent', label: 'My Rent' },
  ];

  return (
    <>
      <aside className={collapsed ? 'rms-sidebar slim' : 'rms-sidebar'}>
        <div className="sidebar-top">
          <div className="profile" onClick={() => navigate('/profile')}>
            <div className="avatar">{(auth?.user?.name || 'R').charAt(0)}</div>
            {!collapsed && (
              <div className="profile-info">
                <div className="profile-name">{auth?.user?.name || 'RMS User'}</div>
                <div className="profile-role">{auth?.user?.role || 'Resident'}</div>
              </div>
            )}
          </div>
          <button className="collapse-btn" onClick={onToggle} aria-label="Toggle sidebar">
            <RightOutlined />
          </button>
        </div>

        <nav className="sidebar-nav">
          <div className={openAll ? 'nav-item group open' : 'nav-item group'}>
            <div className="group-head" onClick={() => setOpenAll((s)=>!s)}>
              <div className="left"><FileTextOutlined />{!collapsed && <span>All Pages</span>}</div>
            </div>
            {!collapsed && openAll && (
              <div className="group-body">
                {allPages.map(p => (
                  <NavLink key={p.to} to={p.to} className={({isActive}) => isActive ? 'sub-item active' : 'sub-item'} onClick={()=>setOpenMobile(false)}>
                    {p.label}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
          {menu.map((m) => (
            <NavLink key={m.to} to={m.to} className={({isActive})=> isActive? 'nav-item active' : 'nav-item'} onClick={()=>setOpenMobile(false)}>
              <div className="nav-icon">{m.icon}</div>
              {!collapsed && <div className="nav-label">{m.label}</div>}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <NavLink to="/settings" className={({isActive})=> isActive? 'nav-item active' : 'nav-item'}>
            <div className="nav-icon"><SettingOutlined /></div>
            {!collapsed && <div className="nav-label">Settings</div>}
          </NavLink>
          <button className="nav-item logout" onClick={handleLogout}>
            <div className="nav-icon"><LogoutOutlined /></div>
            {!collapsed && <div className="nav-label">Logout</div>}
          </button>
        </div>
      </aside>

      {/* Mobile menu button: visible on small screens */}
      <button className="mobile-menu-btn" onClick={()=>setOpenMobile(true)} aria-label="Open menu"><MenuOutlined /></button>

      {/* Mobile drawer overlay */}
      <div className={openMobile ? 'mobile-drawer open' : 'mobile-drawer'}>
        <div className="drawer-inner">
          <div className="drawer-head">
            <div className="drawer-brand">RMS</div>
            <button onClick={()=>setOpenMobile(false)} className="drawer-close">Close</button>
          </div>
          <nav className="drawer-nav">
            {menu.map((m)=> (
              <NavLink key={m.to} to={m.to} className={({isActive})=> isActive? 'drawer-item active' : 'drawer-item'} onClick={()=>setOpenMobile(false)}>
                <div className="nav-icon">{m.icon}</div>
                <div className="nav-label">{m.label}</div>
              </NavLink>
            ))}
          </nav>
          <div className="drawer-bottom">
            <NavLink to="/settings" className="drawer-item" onClick={()=>setOpenMobile(false)}>
              <div className="nav-icon"><SettingOutlined /></div>
              <div className="nav-label">Settings</div>
            </NavLink>
            <button className="drawer-item logout" onClick={()=>{ setOpenMobile(false); handleLogout(); }}>
              <div className="nav-icon"><LogoutOutlined /></div>
              <div className="nav-label">Logout</div>
            </button>
          </div>
        </div>
        <div className="drawer-backdrop" onClick={()=>setOpenMobile(false)} />
      </div>
    </>
  );
}

export default Sidebar;

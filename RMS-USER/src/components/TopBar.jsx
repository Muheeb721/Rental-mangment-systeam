import { useState } from 'react';
import { Input, Button, Drawer } from 'antd';
import { MenuOutlined, SearchOutlined } from '@ant-design/icons';
import NotificationBell from './Notifications/NotificationBell';
import FavoriteBadge from './FavoriteBadge';
import { Link } from 'react-router-dom';
import Sidebar from './Sidebar';
import './TopBar.css';

function TopBar({ collapsed, onToggleCollapse }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rms-topbar">
      <div className="topbar-left">
        <Button className="mobile-menu" icon={<MenuOutlined />} onClick={() => setOpen(true)} />
        <Link to="/" className="topbar-brand">RMS</Link>
      </div>

      <div className="topbar-center">
        <Input placeholder="Search properties, areas..." prefix={<SearchOutlined />} style={{ maxWidth: 520 }} />
      </div>

      <div className="topbar-right">
        <NotificationBell />
        <FavoriteBadge />
        <Button onClick={onToggleCollapse} className="collapse-toggle">{collapsed ? 'Expand' : 'Collapse'}</Button>
      </div>

      <Drawer placement="left" onClose={() => setOpen(false)} open={open} bodyStyle={{ padding:0 }}>
        <Sidebar collapsed={false} onToggle={() => setOpen(false)} />
      </Drawer>
    </div>
  );
}

export default TopBar;

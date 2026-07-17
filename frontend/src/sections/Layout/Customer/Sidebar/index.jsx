import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Server, Bell, ShieldAlert, User, LogOut, X, ChevronDown, ChevronUp,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import authApi from '@/api/auth';
import Viewlogo from '@/components/Viewlogo';

const CustomerSidebar = ({ isSidebarOpen, setIsSidebarOpen }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isFullscreenLogo, setIsFullscreenLogo] = useState(false);

  const handleClose = () => {
    if (window.innerWidth <= 768) {
      setIsSidebarOpen(false);
    }
  };

  const handleLogout = async () => {
    try {
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        await authApi.logout({ refreshToken });
      }
    } catch (e) {
      console.error('Logout failed:', e);
    } finally {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      sessionStorage.removeItem('cached_user');
      navigate('/login', { replace: true });
    }
  };

  const navItems = [
    { to: '/customer/dashboard', icon: LayoutDashboard, label: t('customer.sidebar.dashboard', 'Dashboard') },
    { to: '/customer/devices', icon: Server, label: t('customer.sidebar.devices', 'Thiết bị của tôi') },
    { to: '/customer/alerts', icon: Bell, label: t('customer.sidebar.alerts', 'Cảnh báo') },
    { to: '/customer/incidents', icon: ShieldAlert, label: t('customer.sidebar.incidents', 'Sự cố') },
  ];

  return (
    <>
      <div
        className={'sidebar-overlay ' + (isSidebarOpen ? 'visible' : '')}
        onClick={() => setIsSidebarOpen(false)}
      />

      <aside className={'sidebar ' + (isSidebarOpen ? 'mobile-open' : 'collapsed')}>
        <div className="sidebar-logo flex-logo-container">
          <div className="logo-wrapper">
            <Viewlogo
              animate={false}
              className="logo-icon"
              style={{ width: '40px', height: '40px', cursor: 'pointer', objectFit: 'cover' }}
              onClick={() => setIsFullscreenLogo(true)}
            />
            <div>
              <span className="logo-text">ICS Guard</span>
            </div>
          </div>
          <button className="close-sidebar-btn" onClick={() => setIsSidebarOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => 'nav-item ' + (isActive ? 'active' : '')}
              onClick={handleClose}
            >
              <Icon size={20} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="nav-item logout-btn" onClick={handleLogout}>
            <LogOut size={20} />
            <span>{t('layout.sidebar.logout', 'Đăng xuất')}</span>
          </button>
        </div>
      </aside>

      {isFullscreenLogo && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 9999,
            display: 'flex', justifyContent: 'center', alignItems: 'center',
          }}
          onClick={() => setIsFullscreenLogo(false)}
        >
          <button
            style={{ position: 'absolute', top: '20px', right: '20px', background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}
            onClick={(e) => { e.stopPropagation(); setIsFullscreenLogo(false); }}
          >
            <X size={32} />
          </button>
          <Viewlogo
            animate={false}
            alt={t('layout.sidebar.logo_fullscreen', 'Logo Fullscreen')}
            style={{ maxWidth: '90vw', maxHeight: '90vh' }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
};

export default CustomerSidebar;

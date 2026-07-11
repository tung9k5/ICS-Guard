import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ShieldAlert, Network, Server, FileText, Settings, X, LogOut, User, Activity, Crosshair } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import authApi from '@/api/auth';
import Viewlogo from '@/components/Viewlogo';
import './Sidebar.scss';

const Sidebar = ({ isSidebarOpen, setIsSidebarOpen, collapsed, setCollapsed }) => {
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
      sessionStorage.removeItem('cached_user'); // Xoá cache user khi đăng xuất
      navigate('/login', { replace: true });
    }
  };

  return (
    <>
      {/* Overlay cho mobile khi mở sidebar */}
      <div
        className={`sidebar-overlay ${isSidebarOpen ? 'visible' : ''}`}
        onClick={() => setIsSidebarOpen(false)}
      />

      <aside className={`sidebar ${isSidebarOpen ? 'mobile-open' : 'collapsed'}`}>
        <div className="sidebar-logo flex-logo-container">
          <div className="logo-wrapper">
            <Viewlogo
              animate={false}
              className="logo-icon"
              style={{ width: '40px', height: '40px', cursor: 'pointer', objectFit: 'cover' }}
              onClick={() => setIsFullscreenLogo(true)}
            />
            <span className="logo-text">ICS Guard</span>
          </div>
          {/* Nút đóng trên mobile */}
          <button
            className="close-sidebar-btn"
            onClick={() => setIsSidebarOpen(false)}
          >
            <X size={20} />
          </button>
        </div>
        <nav className="sidebar-nav">
          <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} end onClick={handleClose}>
            <LayoutDashboard size={20} />
            <span>{t('layout.sidebar.overview')}</span>
          </NavLink>
          <NavLink to="/coming-soon" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={handleClose}>
            <Network size={20} />
            <span>{t('layout.sidebar.topology')}</span>
          </NavLink>
          <NavLink to="/incident-management" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={handleClose}>
            <ShieldAlert size={20} />
            <span>{t('layout.sidebar.alerts')}</span>
          </NavLink>
          <NavLink to="/device-management" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={handleClose}>
            <Server size={20} />
            <span>{t('layout.sidebar.assets')}</span>
          </NavLink>
          <NavLink to="/user-management" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={handleClose}>
            <User size={20} />
            <span>{t('layout.sidebar.users')}</span>
          </NavLink>
          <NavLink to="/audit-management" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={handleClose}>
            <Activity size={20} />
            <span>{t('layout.sidebar.audit')}</span>
          </NavLink>
          <NavLink to="/attack-simulator" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={handleClose}>
            <Crosshair size={20} />
            <span>{t('layout.sidebar.attack')}</span>
          </NavLink>
          <NavLink to="/coming-soon" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={handleClose}>
            <FileText size={20} />
            <span>{t('layout.sidebar.reports')}</span>
          </NavLink>
          <NavLink to="/coming-soon" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={handleClose}>
            <Settings size={20} />
            <span>{t('layout.sidebar.settings')}</span>
          </NavLink>
        </nav>

        <div className="sidebar-footer">
          <button className="nav-item logout-btn" onClick={handleLogout}>
            <LogOut size={20} />
            <span>{t('layout.sidebar.logout')}</span>
          </button>
        </div>
      </aside>

      {/* Fullscreen Logo Modal */}
      {isFullscreenLogo && (
        <div 
          className="fullscreen-logo-overlay"
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            zIndex: 9999,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
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
            alt="Logo Fullscreen"
            style={{ maxWidth: '90vw', maxHeight: '90vh' }}
            onClick={(e) => e.stopPropagation()} 
          />
        </div>
      )}
    </>
  );
};

export default Sidebar;

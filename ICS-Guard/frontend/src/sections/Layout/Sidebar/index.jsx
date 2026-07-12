import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, ShieldAlert, Server, FileText, Settings, X, LogOut, User, Activity, Crosshair, Bell, ClipboardList, ChevronDown, ChevronUp, Shield } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import authApi from '@/api/auth';
import Viewlogo from '@/components/Viewlogo';
import './Sidebar.scss';

const NavGroup = ({ title, icon: Icon, children, collapsed, pathPrefixes }) => {
  const location = useLocation();
  const isActiveGroup = pathPrefixes.some(prefix => location.pathname.startsWith(prefix));
  const [isOpen, setIsOpen] = React.useState(isActiveGroup);

  React.useEffect(() => {
    if (isActiveGroup) {
      setIsOpen(true);
    }
  }, [isActiveGroup]);

  return (
    <div className={'nav-group ' + (isOpen ? 'open' : '') + (isActiveGroup ? ' active-group' : '')}>
      <button
        className={'nav-item nav-group-header ' + (isActiveGroup && collapsed ? 'active' : '')}
      onClick={() => setIsOpen(!isOpen)}
      style={{ justifyContent: 'space-between', width: '100%', background: 'transparent', border: 'none' }}
      >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Icon size={20} />
        {!collapsed && <span>{title}</span>}
      </div>
      {!collapsed && (
        isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />
      )}
    </button>
      {
    (!collapsed && isOpen) && (
      <div className="nav-group-content" style={{ paddingLeft: '32px' }}>
        {children}
      </div>
    )
  }
    </div >
  );
};

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
      sessionStorage.removeItem('cached_user');
      navigate('/login', { replace: true });
    }
  };

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
            <span className="logo-text">ICS Guard</span>
          </div>
          <button
            className="close-sidebar-btn"
            onClick={() => setIsSidebarOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        <nav className="sidebar-nav">
          <NavLink to="/" className={({ isActive }) => 'nav-item ' + (isActive ? 'active' : '')} end onClick={handleClose}>
            <LayoutDashboard size={20} />
            <span>{t('layout.sidebar.overview')}</span>
          </NavLink>

          <NavGroup title={t('sidebar.security_group', 'An ninh & Sự cố')} icon={Shield} collapsed={!isSidebarOpen} pathPrefixes={['/incident-management', '/alert-management', '/rule-management']}>
            <NavLink to="/incident-management" className={({ isActive }) => 'nav-item ' + (isActive ? 'active' : '')} onClick={handleClose} style={{ padding: '8px 12px', minHeight: '40px' }}>
              <ShieldAlert size={18} />
              <span style={{ fontSize: '13px' }}>{t('layout.sidebar.alerts', 'Sự cố')}</span>
            </NavLink>
            <NavLink to="/alert-management" className={({ isActive }) => 'nav-item ' + (isActive ? 'active' : '')} onClick={handleClose} style={{ padding: '8px 12px', minHeight: '40px' }}>
              <Bell size={18} />
              <span style={{ fontSize: '13px' }}>{t('sidebar.alert_management', 'Cảnh báo thô')}</span>
            </NavLink>
            <NavLink to="/rule-management" className={({ isActive }) => 'nav-item ' + (isActive ? 'active' : '')} onClick={handleClose} style={{ padding: '8px 12px', minHeight: '40px' }}>
              <ClipboardList size={18} />
              <span style={{ fontSize: '13px' }}>{t('sidebar.rule_management', 'Quy tắc')}</span>
            </NavLink>
          </NavGroup>

          <NavGroup title={t('sidebar.system_group', 'Hệ thống & Thiết bị')} icon={Server} collapsed={!isSidebarOpen} pathPrefixes={['/device-management', '/audit-management', '/attack-simulator']}>
            <NavLink to="/device-management" className={({ isActive }) => 'nav-item ' + (isActive ? 'active' : '')} onClick={handleClose} style={{ padding: '8px 12px', minHeight: '40px' }}>
              <Server size={18} />
              <span style={{ fontSize: '13px' }}>{t('layout.sidebar.assets')}</span>
            </NavLink>
            <NavLink to="/audit-management" className={({ isActive }) => 'nav-item ' + (isActive ? 'active' : '')} onClick={handleClose} style={{ padding: '8px 12px', minHeight: '40px' }}>
              <Activity size={18} />
              <span style={{ fontSize: '13px' }}>{t('layout.sidebar.audit')}</span>
            </NavLink>
            <NavLink to="/attack-simulator" className={({ isActive }) => 'nav-item ' + (isActive ? 'active' : '')} onClick={handleClose} style={{ padding: '8px 12px', minHeight: '40px' }}>
              <Crosshair size={18} />
              <span style={{ fontSize: '13px' }}>{t('layout.sidebar.attack')}</span>
            </NavLink>
          </NavGroup>

          <NavGroup title={t('sidebar.admin_group', 'Quản trị hệ thống')} icon={Settings} collapsed={!isSidebarOpen} pathPrefixes={['/user-management', '/coming-soon']}>
            <NavLink to="/user-management" className={({ isActive }) => 'nav-item ' + (isActive ? 'active' : '')} onClick={handleClose} style={{ padding: '8px 12px', minHeight: '40px' }}>
              <User size={18} />
              <span style={{ fontSize: '13px' }}>{t('layout.sidebar.users')}</span>
            </NavLink>
            <NavLink to="/coming-soon" className={({ isActive }) => 'nav-item ' + (isActive ? 'active' : '')} onClick={handleClose} style={{ padding: '8px 12px', minHeight: '40px' }}>
              <FileText size={18} />
              <span style={{ fontSize: '13px' }}>{t('layout.sidebar.reports')}</span>
            </NavLink>
            <NavLink to="/coming-soon?settings" className={({ isActive }) => 'nav-item ' + (isActive ? 'active' : '')} onClick={handleClose} style={{ padding: '8px 12px', minHeight: '40px' }}>
              <Settings size={18} />
              <span style={{ fontSize: '13px' }}>{t('layout.sidebar.settings')}</span>
            </NavLink>
          </NavGroup>
        </nav>

        <div className="sidebar-footer">
          <button className="nav-item logout-btn" onClick={handleLogout}>
            <LogOut size={20} />
            <span>{t('layout.sidebar.logout')}</span>
          </button>
        </div>
      </aside>

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

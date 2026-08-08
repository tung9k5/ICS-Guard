import React, { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ShieldAlert, Server, FileText, Settings, X, LogOut, User, Activity, Crosshair, ClipboardList, ChevronDown, ChevronUp, Shield } from 'lucide-react';
import { jwtDecode } from 'jwt-decode';
import { useTranslation } from 'react-i18next';
import authApi from '@/api/auth';
import Viewlogo from '@/components/Viewlogo';
import './Sidebar.scss';

const NavGroup = ({ title, icon: Icon, children, collapsed, pathPrefixes }) => {
  const location = useLocation();
  const isActiveGroup = pathPrefixes.some(prefix => location.pathname.startsWith(prefix));
  const [isOpen, setIsOpen] = useState(isActiveGroup);

  useEffect(() => {
    if (isActiveGroup && !collapsed) {
      setIsOpen(true);
    }
  }, [isActiveGroup, collapsed]);

  return (
    <div className={'nav-group ' + (isOpen ? 'open' : '') + (isActiveGroup ? ' active-group' : '')}>
      <button
        className={'nav-item nav-group-header ' + (isActiveGroup ? 'active-group' : '')}
        onClick={() => setIsOpen(!isOpen)}
        title={title}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Icon size={18} />
          {!collapsed && <span>{title}</span>}
        </div>
        {!collapsed && (
          isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />
        )}
      </button>
      {(!collapsed && isOpen) && (
        <div className="nav-group-content">
          {children}
        </div>
      )}
    </div>
  );
};

const Sidebar = ({ isSidebarOpen, setIsSidebarOpen, collapsed, setCollapsed }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isFullscreenLogo, setIsFullscreenLogo] = useState(false);

  const token = localStorage.getItem('access_token');
  let userRole = 'admin';
  try {
    if (token) {
      const payload = jwtDecode(token);
      userRole = payload.role || 'admin';
    }
  } catch (e) {}

  const canAccess = (allowedRoles) => userRole === 'admin' || allowedRoles.includes(userRole);

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
              style={{ width: '32px', height: '32px', cursor: 'pointer', objectFit: 'contain' }}
              onClick={() => setIsFullscreenLogo(true)}
            />
            <span className="logo-text">ICS Guard</span>
          </div>
          <button
            className="close-sidebar-btn"
            onClick={() => setIsSidebarOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        <nav className="sidebar-nav">
          <NavLink to="/" className={({ isActive }) => 'nav-item ' + (isActive ? 'active' : '')} end onClick={handleClose} title={t('layout.sidebar.overview')}>
            <LayoutDashboard size={18} />
            <span>{t('layout.sidebar.overview')}</span>
          </NavLink>

          {canAccess(['analyst']) && (
            <NavGroup title={t('sidebar.security_group', 'An ninh & Sự cố')} icon={Shield} collapsed={!isSidebarOpen} pathPrefixes={['/incident-management', '/alert-management', '/rule-management', '/threat-intel']}>
              <NavLink to="/incident-management" className={({ isActive }) => 'nav-item ' + (isActive ? 'active' : '')} onClick={handleClose} title="Quản lý Sự cố & Cảnh báo">
                <ShieldAlert size={16} />
                <span>Quản lý Sự cố & Cảnh báo</span>
              </NavLink>
              <NavLink to="/threat-intel" className={({ isActive }) => 'nav-item ' + (isActive ? 'active' : '')} onClick={handleClose} title="Threat Intelligence">
                <Crosshair size={16} />
                <span>Threat Intelligence</span>
              </NavLink>
              <NavLink to="/rule-management" className={({ isActive }) => 'nav-item ' + (isActive ? 'active' : '')} onClick={handleClose} title={t('sidebar.rule_management', 'Quy tắc')}>
                <ClipboardList size={16} />
                <span>{t('sidebar.rule_management', 'Quy tắc')}</span>
              </NavLink>
            </NavGroup>
          )}

          {canAccess(['device_management']) && (
            <NavGroup title={t('sidebar.system_group', 'Hệ thống & Thiết bị')} icon={Server} collapsed={!isSidebarOpen} pathPrefixes={['/device-management', '/ot-zone-matrix']}>
              <NavLink to="/device-management" className={({ isActive }) => 'nav-item ' + (isActive ? 'active' : '')} onClick={handleClose} title={t('layout.sidebar.assets', 'Thiết bị OT')}>
                <Server size={16} />
                <span>{t('layout.sidebar.assets', 'Thiết bị OT')}</span>
              </NavLink>
              <NavLink to="/ot-zone-matrix" className={({ isActive }) => 'nav-item ' + (isActive ? 'active' : '')} onClick={handleClose} title="An ninh Phân vùng">
                <Activity size={16} />
                <span>An ninh Phân vùng</span>
              </NavLink>
            </NavGroup>
          )}

          {canAccess(['hr_management']) && (
            <NavGroup title={t('sidebar.admin_group', 'Quản trị hệ thống')} icon={Settings} collapsed={!isSidebarOpen} pathPrefixes={['/user-management', '/audit-management']}>
              <NavLink to="/user-management" className={({ isActive }) => 'nav-item ' + (isActive ? 'active' : '')} onClick={handleClose} title={t('layout.sidebar.users', 'Người dùng')}>
                <User size={16} />
                <span>{t('layout.sidebar.users', 'Người dùng')}</span>
              </NavLink>
              <NavLink to="/audit-management" className={({ isActive }) => 'nav-item ' + (isActive ? 'active' : '')} onClick={handleClose} title={t('layout.sidebar.audit', 'Nhật ký hệ thống')}>
                <FileText size={16} />
                <span>{t('layout.sidebar.audit', 'Nhật ký hệ thống')}</span>
              </NavLink>
            </NavGroup>
          )}
        </nav>

        <div className="sidebar-footer">
          <button className="nav-item logout-btn" onClick={handleLogout} title={t('layout.sidebar.logout')}>
            <LogOut size={18} />
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

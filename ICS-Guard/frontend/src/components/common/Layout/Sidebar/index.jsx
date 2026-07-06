import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ShieldAlert, Network, Server, FileText, Settings, X, LogOut } from 'lucide-react';
import authApi from '@/api/auth';
import './Sidebar.scss';

const Sidebar = ({ isSidebarOpen, setIsSidebarOpen }) => {
  const navigate = useNavigate();

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
      {isSidebarOpen && window.innerWidth <= 768 && (
        <div 
          className="sidebar-overlay"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      
      <aside className={`sidebar ${isSidebarOpen ? 'mobile-open' : 'collapsed'}`}>
        <div className="sidebar-logo flex-logo-container">
          <div className="logo-wrapper">
            <div className="logo-icon">🛡️</div>
            <span className="logo-text">ICS-Guard</span>
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
          <NavLink to="/" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`} end onClick={handleClose}>
            <LayoutDashboard size={20} />
            <span>Tổng quan</span>
          </NavLink>
          <NavLink to="/topology" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`} onClick={handleClose}>
            <Network size={20} />
            <span>Sơ đồ mạng</span>
          </NavLink>
          <NavLink to="/alerts" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`} onClick={handleClose}>
            <ShieldAlert size={20} />
            <span>Cảnh báo an ninh</span>
          </NavLink>
          <NavLink to="/assets" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`} onClick={handleClose}>
            <Server size={20} />
            <span>Quản lý thiết bị</span>
          </NavLink>
          <NavLink to="/reports" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`} onClick={handleClose}>
            <FileText size={20} />
            <span>Báo cáo</span>
          </NavLink>
          <NavLink to="/settings" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`} onClick={handleClose}>
            <Settings size={20} />
            <span>Cài đặt</span>
          </NavLink>
        </nav>
        
        <div className="sidebar-footer">
          <button className="nav-item logout-btn" onClick={handleLogout}>
            <LogOut size={20} />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;

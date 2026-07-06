import React from 'react';
import { Bell, ChevronDown, User, Menu } from 'lucide-react';
import './Header.scss';

const Header = ({ toggleSidebar, user }) => {
  return (
    <header className="header">
      <div className="header-left">
        <button className="toggle-sidebar-btn" onClick={toggleSidebar}>
          <Menu size={20} />
        </button>
        <div className="header-titles">
          <h2>Xin chào, {user?.full_name || user?.username || '...'} !</h2>
          <p>Hệ thống giám sát và bảo vệ hạ tầng điều khiển công nghiệp (ICS-Guard)</p>
        </div>
      </div>
      <div className="header-right">
        <button className="notification-btn">
          <Bell size={20} />
          <span className="notification-dot"></span>
        </button>
        <div className="user-profile">
          <div className="avatar">
            <User size={16} />
          </div>
          <ChevronDown size={16} />
        </div>
      </div>
    </header>
  );
};

export default Header;

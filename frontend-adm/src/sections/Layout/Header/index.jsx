import React, { useState, useEffect, useRef } from 'react';
import { Bell, User, Menu } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import NotificationDropdown from './NotificationDropdown';
import { useNotifications } from '@/hooks/useNotifications';
import './Header.scss';

const Header = ({ toggleSidebar, user, onUpdateUser, onOpenProfile }) => {
  const { t } = useTranslation();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  
  const { 
    notifications, 
    unreadCount, 
    markRead, 
    markAllRead 
  } = useNotifications();

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <header className="header">
      <div className="header-left">
        <button className="toggle-sidebar-btn" onClick={toggleSidebar}>
          <Menu size={20} />
        </button>
        <div className="header-titles">
          <h2>{t('layout.header.hello', { name: user?.username})}</h2>
          <p>{t('layout.header.subtitle')}</p>
        </div>
      </div>
      <div className="header-right">
        <LanguageSwitcher />
        <div className="notification-container" ref={dropdownRef} style={{ position: 'relative' }}>
          <button className="notification-btn" onClick={() => setIsDropdownOpen(!isDropdownOpen)}>
            <Bell size={20} />
            {unreadCount > 0 && <span className="notification-dot">{unreadCount}</span>}
          </button>
          <NotificationDropdown
            notifications={notifications}
            unreadCount={unreadCount}
            isOpen={isDropdownOpen}
            onClose={() => setIsDropdownOpen(false)}
            onMarkRead={markRead}
            onMarkAllRead={markAllRead}
          />
        </div>
        <div className="user-profile" onClick={onOpenProfile} style={{ cursor: 'pointer', marginLeft: '16px' }}>
          {user?.avatar ? (
            <img src={user.avatar} alt="Avatar" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            <User size={16} />
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;

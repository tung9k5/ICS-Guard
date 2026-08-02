import React from 'react';
import { Bell, Menu, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useState, useRef, useEffect } from 'react';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import NotificationDropdown from './NotificationDropdown';
import { useNotifications } from '@/hooks/useNotifications';
import './Header.scss';

const CustomerHeader = ({ toggleSidebar, user, onOpenProfile }) => {
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
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="header customer-header">
      <div className="header-left">
        <button className="toggle-sidebar-btn" onClick={toggleSidebar}>
          <Menu size={20} />
        </button>
        <div className="header-titles">
          <h2>{t('layout.header.hello', { name: user?.username || t('layout.header.loading', '...') })}</h2>
          <p>{t('layout.header.subtitle')}</p>
        </div>
      </div>
      <div className="header-right">
        <LanguageSwitcher />
        <div className="notification-container" ref={dropdownRef} style={{ position: 'relative' }}>
          <button 
            className="notification-btn" 
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            style={{ position: 'relative' }}
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="notification-badge" style={{
                position: 'absolute',
                top: '-5px',
                right: '-5px',
                background: 'var(--custom-color-18)',
                color: 'white',
                fontSize: '10px',
                padding: '2px 6px',
                borderRadius: '10px',
                fontWeight: 'bold'
              }}>{unreadCount > 99 ? '99+' : unreadCount}</span>
            )}
          </button>
          <NotificationDropdown 
            isOpen={isDropdownOpen}
            onClose={() => setIsDropdownOpen(false)}
            notifications={notifications}
            unreadCount={unreadCount}
            onMarkRead={markRead}
            onMarkAllRead={markAllRead}
          />
        </div>
        <div className="user-profile" onClick={onOpenProfile}>
          {user?.avatar ? (
            <img src={user.avatar} alt={t('layout.header.avatar', 'Avatar')} />
          ) : (
            <User size={20} />
          )}
        </div>
      </div>
    </header>
  );
};

export default CustomerHeader;

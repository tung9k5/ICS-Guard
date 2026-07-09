import React from 'react';
import { Bell, ChevronDown, User, Menu } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '@/components/common/LanguageSwitcher';
import './Header.scss';

const Header = ({ toggleSidebar, user, onUpdateUser, onOpenProfile }) => {
  const { t } = useTranslation();

  return (
    <header className="header">
      <div className="header-left">
        <button className="toggle-sidebar-btn" onClick={toggleSidebar}>
          <Menu size={20} />
        </button>
        <div className="header-titles">
          <h2>{t('layout.header.hello', { name: user?.full_name || user?.username || '...' })}</h2>
          <p>{t('layout.header.subtitle')}</p>
        </div>
      </div>
      <div className="header-right">
        <LanguageSwitcher />
        <button className="notification-btn">
          <Bell size={20} />
          <span className="notification-dot"></span>
        </button>
        <div className="user-profile" onClick={onOpenProfile} style={{ cursor: 'pointer' }}>
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

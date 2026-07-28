import './AuthLayout.scss';
import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '@/components/LanguageSwitcher';

const AuthLayout = () => {
  const location = useLocation();
  const isAttacker = location.pathname.startsWith('/attacker');
  const { t } = useTranslation();

  return (
    <div className={`auth-layout ${isAttacker ? 'attacker-theme' : ''}`}>
      <div className="auth-cover">
        <div className="auth-cover-content">
          <h1>{isAttacker ? t('auth.attacker_portal') : t('auth.welcome_ics_guard')}</h1>
          <p>
            {isAttacker 
              ? t('auth.attacker_desc') 
              : t('auth.ics_guard_desc')}
          </p>
        </div>
      </div>

      <div className="auth-panel">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
          <LanguageSwitcher />
        </div>
        
        <Outlet />
      </div>
    </div>
  );
};

export default AuthLayout;

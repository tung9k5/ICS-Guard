import './AuthLayout.scss';
import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ShieldCheck } from 'lucide-react';
import LanguageSwitcher from '@/components/LanguageSwitcher';

const AuthLayout = () => {
  const location = useLocation();
  const isAttacker = location.pathname.startsWith('/attacker');
  const { t } = useTranslation();

  return (
    <div className={`auth-layout ${isAttacker ? 'attacker-theme' : ''}`}>
      <div className="auth-cover">
        <div className="auth-cover-content">
          <div className="auth-brand-kicker">
            <ShieldCheck size={14} />
            {isAttacker ? 'ATTACK SIMULATION PORTAL' : 'ICS-GUARD OT SECURITY PLATFORM'}
          </div>
          <h1>{isAttacker ? t('auth.attacker_portal') : t('auth.welcome_ics_guard')}</h1>
          <p>
            {isAttacker 
              ? t('auth.attacker_desc') 
              : t('auth.ics_guard_desc')}
          </p>
        </div>
      </div>

      <div className="auth-panel">
        <div className="auth-panel-inner">
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
            <LanguageSwitcher />
          </div>
          
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;

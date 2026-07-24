import './Login.scss';
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Lock, User } from 'lucide-react';
import VInput from '@/components/VInput';
import VButton from '@/components/VButton';
import { toast } from '@/utils/toast';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from 'react-i18next';
import authApi from '@/api/auth';
import { AUTH_KEYS } from '@/constants/authConstants';

const Login = ({ isAttacker = false }) => {
  const { t, i18n } = useTranslation();
  const { login, loginGoogle, loading } = useAuth();
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [rememberMe, setRememberMe] = useState(false);

  useEffect(() => {
    const savedData = localStorage.getItem(AUTH_KEYS.REMEMBERED_ACCOUNT);
    if (savedData) {
      try {
        const { username, expires } = JSON.parse(savedData);
        if (Date.now() < expires) {
          setFormData(prev => ({ ...prev, username: username }));
          setRememberMe(true);
        } else {
          localStorage.removeItem(AUTH_KEYS.REMEMBERED_ACCOUNT);
        }
      } catch (e) {
        localStorage.removeItem(AUTH_KEYS.REMEMBERED_ACCOUNT);
      }
    }
  }, [isAttacker, i18n.language]);

  const handleGoogleLoginRedirect = async () => {
    try {
      const res = await authApi.getGoogleAuthUrl();
      if (res && res.data && res.data.url) {
        window.location.href = res.data.url;
      }
    } catch (error) {
      toast.error(t('auth.login.google_fail'));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await login(formData, rememberMe, isAttacker);
  };

  return (
    <div className="auth-form-card">
      <div style={{ textAlign: 'center', marginBottom: '1.7143rem' }}>
        <h2 style={{ fontSize: '1.7143rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '0.5714rem' }}>
          {isAttacker ? t('auth.attacker_portal', 'Attacker Portal') : t('auth.login.welcome')}
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>{t('auth.login.enter_info')}</p>
      </div>

      <form onSubmit={handleSubmit}>
        <VInput
          id="username"
          name="username"
          label={t('auth.login.username', 'Username')}
          placeholder={t('auth.login.enter_username', 'Enter username')}
          icon={User}
          value={formData.username}
          onChange={(e) => setFormData({...formData, username: e.target.value})}
          required
        />

        <VInput
          id="password"
          name="password"
          type="password"
          label={t('auth.login.password')}
          placeholder={t('auth.login.enter_password')}
          icon={Lock}
          value={formData.password}
          onChange={(e) => setFormData({...formData, password: e.target.value})}
          required
        />

        <div className="auth-form-options">
          <label className="checkbox-container">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            <span>{t('auth.login.remember_me')}</span>
          </label>
        </div>

        <div className="auth-form-actions">
          <VButton
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            loading={loading}
          >
            {t('auth.login.submit')}
          </VButton>
        </div>
      </form>

      {!isAttacker && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', margin: '1.4286rem 0' }}>
            <hr style={{ flex: 1, borderTop: '0.0714rem solid var(--gray-light-2)' }} />
            <span style={{ padding: '0 0.7143rem', color: 'var(--gray-dark)', fontSize: '1rem' }}>{t('auth.login.or')}</span>
            <hr style={{ flex: 1, borderTop: '0.0714rem solid var(--gray-light-2)' }} />
          </div>
          <div style={{ marginBottom: '1.4286rem' }}>
            <VButton 
              type="button" 
              variant="outline" 
              fullWidth 
              onClick={handleGoogleLoginRedirect}
              size="lg"
              disabled={loading}
              style={{ 
                backgroundColor: 'white', 
                border: '0.0714rem solid var(--gray-light-3)'
              }}
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" style={{ width: '1.2857rem', height: '1.2857rem' }} />
              <span style={{ fontWeight: '700' }}>{t('auth.login.login_google')}</span>
            </VButton>
          </div>
          <div className="auth-form-footer" style={{ textAlign: 'center' }}>
            {t('auth.login.no_account')}
            <Link to="/register" className="auth-link" style={{ marginLeft: '0.4286rem' }}>
              {t('auth.login.register_now')}
            </Link>
          </div>
        </>
      )}
    </div>
  );
};

export default Login;


import './Login.scss';
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Lock, User } from 'lucide-react';
import VInput from '@/components/VInput';
import VButton from '@/components/VButton';
import { toast } from '@/utils/toast';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from 'react-i18next';

const Login = ({ isAttacker = false }) => {
  const { t, i18n } = useTranslation();
  const { login, loginGoogle, loading } = useAuth();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [rememberMe, setRememberMe] = useState(false);

  useEffect(() => {
    const savedData = localStorage.getItem('remembered_account');
    if (savedData) {
      try {
        const { email, expires } = JSON.parse(savedData);
        if (Date.now() < expires) {
          setFormData(prev => ({ ...prev, email: email }));
          setRememberMe(true);
        } else {
          localStorage.removeItem('remembered_account');
        }
      } catch (e) {
        localStorage.removeItem('remembered_account');
      }
    }

    if (!isAttacker) {
      const hasGoogleConfig = !!import.meta.env.VITE_GOOGLE_CLIENT_ID && !!import.meta.env.VITE_GOOGLE_GSI_CLIENT_URL;
      
      if (!hasGoogleConfig) return;

      const renderGoogleButton = () => {
        if (window.google) {
          window.google.accounts.id.initialize({
            client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
            callback: handleGoogleCallback
          });
          const container = document.getElementById('googleSignInDiv');
          if (container) {
            const width = container.offsetWidth || 384;
            window.google.accounts.id.renderButton(
              container,
              { theme: 'outline', size: 'large', width: width, logo_alignment: 'center', locale: i18n.language }
            );
          }
        }
      };

      const loadGsiScript = () => {
        if (document.getElementById('google-jssdk')) {
          renderGoogleButton();
          return;
        }
        const script = document.createElement('script');
        script.id = 'google-jssdk';
        script.src = import.meta.env.VITE_GOOGLE_GSI_CLIENT_URL;
        script.async = true;
        script.defer = true;
        script.onload = renderGoogleButton;
        document.body.appendChild(script);
      };
      loadGsiScript();
    }
  }, [isAttacker, i18n.language]);

  const handleGoogleCallback = async (response) => {
    await loginGoogle(response.credential);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await login(formData, rememberMe, isAttacker);
  };

  return (
    <div className="auth-form-card">
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '8px' }}>
          {isAttacker ? t('auth.attacker_portal', 'Attacker Portal') : t('auth.login.welcome')}
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>{t('auth.login.enter_info')}</p>
      </div>

      <form onSubmit={handleSubmit}>
        <VInput
          id="email"
          name="email"
          label="Email"
          placeholder="admin@example.com"
          icon={User}
          value={formData.email}
          onChange={(e) => setFormData({...formData, email: e.target.value})}
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
            fullWidth
            loading={loading}
          >
            {t('auth.login.submit')}
          </VButton>
        </div>
      </form>

      {!isAttacker && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0' }}>
            <hr style={{ flex: 1, borderTop: '1px solid var(--gray-light-2)' }} />
            <span style={{ padding: '0 10px', color: 'var(--gray-dark)', fontSize: '14px' }}>{t('auth.login.or')}</span>
            <hr style={{ flex: 1, borderTop: '1px solid var(--gray-light-2)' }} />
          </div>
          {!!import.meta.env.VITE_GOOGLE_CLIENT_ID && !!import.meta.env.VITE_GOOGLE_GSI_CLIENT_URL ? (
            <div key={i18n.language} id="googleSignInDiv" style={{ width: '100%', marginBottom: '20px' }}></div>
          ) : (
            <div style={{ marginBottom: '20px' }}>
              <VButton 
                type="button" 
                variant="outline" 
                fullWidth 
                onClick={() => toast.info(t('auth.login.missing_env'))}
                style={{ 
                  backgroundColor: 'white', 
                  color: 'var(--gray-dark-2)', 
                  border: '1px solid var(--gray-light-3)',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px'
                }}
              >
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" style={{ width: '18px', height: '18px' }} />
                {t('auth.login.login_google')}
              </VButton>
            </div>
          )}
          <div className="auth-form-footer" style={{ textAlign: 'center' }}>
            {t('auth.login.no_account')}
            <Link to="/register" className="auth-link" style={{ marginLeft: '6px' }}>
              {t('auth.login.register_now')}
            </Link>
          </div>
        </>
      )}
    </div>
  );
};

export default Login;


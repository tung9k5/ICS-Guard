import './Login.scss';
import React, { useState, useEffect } from 'react';
import { Lock, User } from 'lucide-react';
import VInput from '@/components/VInput';
import VButton from '@/components/VButton';
import { useAuth } from '@/hooks/useAuth';

import { useTranslation } from 'react-i18next';

const Login = ({ isAttacker = false }) => {
  const { t } = useTranslation();
  const { login, loading } = useAuth();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [rememberMe, setRememberMe] = useState(false);

  useEffect(() => {
    const savedData = localStorage.getItem('remembered_account');
    if (savedData) {
      try {
        const { email, username, expires } = JSON.parse(savedData);
        if (Date.now() < expires) {
          setFormData(prev => ({ ...prev, email: email || username }));
          setRememberMe(true);
        } else {
          localStorage.removeItem('remembered_account');
        }
      } catch (e) {
        localStorage.removeItem('remembered_account');
      }
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await login(formData, rememberMe, isAttacker);
  };

  return (
    <div className="auth-form-card">
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '8px' }}>{t('auth.login.welcome')}</h2>
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
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
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
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
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
    </div>
  );
};

export default Login;

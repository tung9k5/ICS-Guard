import './Login.scss';
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User } from 'lucide-react';
import VInput from '@/components/VInput';
import VButton from '@/components/VButton';
import { toast } from '@/utils/toast';
import { useAuth } from '@/hooks/useAuth';
import authApi from '@/api/auth';
import { refreshSocketAuthentication } from '@/services/socket';

import { useTranslation } from 'react-i18next';

const Login = ({ isAttacker = false }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { login, loading } = useAuth();
  const [localLoading, setLocalLoading] = useState(false);
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
    setLocalLoading(true);

    if (isAttacker) {
      if (formData.email === 'adminattack' && formData.password === 'Admin@123') {
        localStorage.setItem('attacker_authenticated', 'true');
        toast.success(t('auth.login.success'));
        navigate('/attacker', { replace: true });
      } else {
        toast.error('Tên đăng nhập hoặc mật khẩu tấn công không chính xác!');
        setFormData({ email: '', password: '' });
      }

      setLocalLoading(false);
      return;
    }

    try {
      const response = await authApi.login({ 
        email: formData.email, 
        username: formData.email, 
        password: formData.password 
      });
      if (response && response.access_token) {
        if (rememberMe) {
          const expires = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days in ms
          localStorage.setItem('remembered_account', JSON.stringify({
            username: formData.email,
            email: formData.email,
            expires
          }));
        } else {
          localStorage.removeItem('remembered_account');
        }

        toast.success(t('auth.login.success'));
        localStorage.setItem('access_token', response.access_token);
        localStorage.setItem('refresh_token', response.refresh_token);
        refreshSocketAuthentication();
        navigate('/', { replace: true });
      }
    } catch (err) {
      const msg = err.response?.data?.message;
      const errorText = (msg === 'Invalid username or password.' || msg === 'Bad Request')
        ? 'Tài khoản hoặc mật khẩu không chính xác. Đăng nhập thất bại!'
        : (msg || t('auth.login.fail'));
      toast.error(errorText);
      setFormData({ email: '', password: '' });
    } finally {
      setLocalLoading(false);
    }


  };

  return (
    <div className="auth-form-card">
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: '600', color: '#ffffff', marginBottom: '8px' }}>{t('auth.login.welcome')}</h2>
        <p style={{ color: '#e2e8f0', fontSize: '14px' }}>{t('auth.login.enter_info')}</p>
      </div>


      <form onSubmit={handleSubmit}>
        <VInput
          id="email"
          name="email"
          label="Email hoặc Tên đăng nhập"
          placeholder="admin@example.com hoặc admin"
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
            loading={localLoading || loading}
          >
            {t('auth.login.submit')}
          </VButton>
        </div>
      </form>
    </div>
  );
};

export default Login;

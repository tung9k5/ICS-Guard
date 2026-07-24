import './Register.scss';
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock, User, Mail } from 'lucide-react';
import VInput from '@/components/VInput';
import VButton from '@/components/VButton';
import { toast } from '@/utils/toast';
import { useAuth } from '@/hooks/useAuth';

import { useTranslation } from 'react-i18next';

const Register = () => {
  const { t } = useTranslation();
  const { register, loading } = useAuth();
  const [formData, setFormData] = useState({ 
    username: '', 
    email: '', 
    password: '',
    confirmPassword: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      toast.error(t('auth.register.password_mismatch'));
      return;
    }

    const payload = {
      username: formData.username,
      email: formData.email,
      password: formData.password
    };
    
    await register(payload);
  };

  return (
    <div className="auth-form-card">
      <div style={{ textAlign: 'center', marginBottom: '1.7143rem' }}>
        <h2 style={{ fontSize: '1.7143rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '0.5714rem' }}>{t('auth.register.welcome')}</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>{t('auth.register.enter_info')}</p>
      </div>

      <form onSubmit={handleSubmit}>
        <VInput
          id="username"
          name="username"
          label={t('auth.register.username')}
          placeholder="admin123"
          icon={User}
          value={formData.username}
          onChange={(e) => setFormData({...formData, username: e.target.value})}
          required
        />

        <VInput
          id="email"
          name="email"
          type="email"
          label={t('auth.register.email')}
          placeholder="admin@example.com"
          icon={Mail}
          value={formData.email}
          onChange={(e) => setFormData({...formData, email: e.target.value})}
          required
        />

        <VInput
          id="password"
          name="password"
          type="password"
          label={t('auth.register.password')}
          placeholder="••••••••"
          icon={Lock}
          value={formData.password}
          onChange={(e) => setFormData({...formData, password: e.target.value})}
          required
        />

        <VInput
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          label={t('auth.register.confirm_password')}
          placeholder="••••••••"
          icon={Lock}
          value={formData.confirmPassword}
          onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
          error={formData.confirmPassword && formData.password !== formData.confirmPassword ? t('auth.register.password_mismatch') : ""}
          required
        />

        <div className="auth-form-actions">
          <VButton 
            type="submit" 
            variant="primary" 
            fullWidth 
            size="lg"
            loading={loading}
          >
            {t('auth.register.submit')}
          </VButton>
        </div>
      </form>

      <div className="auth-form-footer">
        {t('auth.register.have_account')}
        <Link to="/login" className="auth-link">
          {t('auth.register.login_now')}
        </Link>
      </div>
    </div>
  );
};

export default Register;

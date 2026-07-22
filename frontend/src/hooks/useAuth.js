import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/utils/toast';
import authApi from '@/api/auth';
import { useTranslation } from 'react-i18next';

export const useAuth = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const getDefaultRoute = (role) => {
    return role === 'customer' ? '/customer/dashboard' : '/';
  };

  const login = async (formData, rememberMe, isAttacker = false) => {
    setLoading(true);
    try {
      const response = await authApi.login(formData);
      if (response && (response.accessToken)) {
        localStorage.setItem('access_token', response.accessToken);
        localStorage.setItem('refresh_token', response.refreshToken);
        
        if (rememberMe) {
          const expires = Date.now() + 30 * 24 * 60 * 60 * 1000;
          localStorage.setItem('remembered_account', JSON.stringify({
            email: formData.email,
            expires
          }));
        } else {
          localStorage.removeItem('remembered_account');
        }

        toast.success(t('auth.login.success'));
        if (isAttacker) {
          navigate('/attacker', { replace: true });
        } else {
          const role = response.user?.role;
          navigate(getDefaultRoute(role), { replace: true });
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.message || t('auth.login.fail'));
    } finally {
      setLoading(false);
    }
  };

  const loginGoogle = async (credential) => {
    try {
      setLoading(true);
      const res = await authApi.loginGoogle({ idToken: credential });
      if (res && (res.accessToken || res.access_token)) {
        localStorage.setItem('access_token', res.accessToken || res.access_token);
        localStorage.setItem('refresh_token', res.refreshToken || res.refresh_token);
        toast.success(t('auth.login.success'));
        const role = res.user?.role;
        navigate(getDefaultRoute(role), { replace: true });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || t('auth.login.google_fail'));
    } finally {
      setLoading(false);
    }
  };

  const register = async (payload) => {
    setLoading(true);
    try {
      await authApi.register(payload);
      toast.success(t('auth.register.success'));
      navigate('/login');
    } catch (err) {
      toast.error(err.response?.data?.message || t('auth.register.fail'));
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    login,
    loginGoogle,
    register
  };
};

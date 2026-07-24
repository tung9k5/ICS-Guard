import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/utils/toast';
import authApi from '@/api/auth';
import { useTranslation } from 'react-i18next';
import { AUTH_KEYS } from '@/constants/authConstants';
import { APP_ROUTES } from '@/constants/routes';

export const useAuth = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const getDefaultRoute = (role) => {
    return role === 'customer' ? APP_ROUTES.CUSTOMER.DASHBOARD : APP_ROUTES.SOC.DASHBOARD;
  };

  const login = async (formData, rememberMe, isAttacker = false) => {
    setLoading(true);
    try {
      const response = await authApi.login(formData);
      if (response && (response.accessToken)) {
        localStorage.setItem(AUTH_KEYS.ACCESS_TOKEN, response.accessToken);
        localStorage.setItem(AUTH_KEYS.REFRESH_TOKEN, response.refreshToken);
        
        if (rememberMe) {
          const expires = Date.now() + 30 * 24 * 60 * 60 * 1000;
          localStorage.setItem(AUTH_KEYS.REMEMBERED_ACCOUNT, JSON.stringify({
            username: formData.username,
            expires
          }));
        } else {
          localStorage.removeItem(AUTH_KEYS.REMEMBERED_ACCOUNT);
        }

        toast.success(t('auth.login.success'));
        if (isAttacker) {
          navigate(APP_ROUTES.AUTH.ATTACKER_LOGIN.replace('/login', ''), { replace: true });
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
        localStorage.setItem(AUTH_KEYS.ACCESS_TOKEN, res.accessToken || res.access_token);
        localStorage.setItem(AUTH_KEYS.REFRESH_TOKEN, res.refreshToken || res.refresh_token);
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
      navigate(APP_ROUTES.AUTH.LOGIN);
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

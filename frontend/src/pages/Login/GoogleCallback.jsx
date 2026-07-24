import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from '@/utils/toast';
import authApi from '@/api/auth';
import GlobalLoading from '@/components/GlobalLoading';
import { AUTH_KEYS } from '@/constants/authConstants';
import { APP_ROUTES } from '@/constants/routes';

const GoogleCallback = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleCallback = async () => {
      const searchParams = new URLSearchParams(location.search);
      if (searchParams.get('error')) {
        toast.error(t('auth.login.google_fail'));
        navigate(APP_ROUTES.AUTH.LOGIN, { replace: true });
        return;
      }

      try {
        const res = await authApi.refreshToken({});
        
        if (res && (res.accessToken || res.data?.accessToken)) {
          const accessToken = res.accessToken || res.data?.accessToken;
          const refreshToken = res.refreshToken || res.data?.refreshToken;
          const user = res.user || res.data?.user;
          
          localStorage.setItem(AUTH_KEYS.ACCESS_TOKEN, accessToken);
          localStorage.setItem(AUTH_KEYS.REFRESH_TOKEN, refreshToken);
          
          toast.success(t('auth.login.success'));
          
          const role = user?.role;
          const defaultRoute = role === 'customer' ? APP_ROUTES.CUSTOMER.DASHBOARD : APP_ROUTES.SOC.DASHBOARD;
          navigate(defaultRoute, { replace: true });
        } else {
          throw new Error('No tokens returned');
        }
      } catch (err) {
        toast.error(t('auth.login.google_fail'));
        navigate(APP_ROUTES.AUTH.LOGIN, { replace: true });
      }
    };

    handleCallback();
  }, [location, navigate, t]);

  return <GlobalLoading forceShow={true} />;
};

export default GoogleCallback;

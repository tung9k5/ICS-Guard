import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from '@/utils/toast';
import authApi from '@/api/auth';
import { useSelector } from 'react-redux';
import GlobalLoading from '@/components/GlobalLoading';
import { AUTH_KEYS } from '@/constants/authConstants';
import { APP_ROUTES } from '@/constants/routes';

const GoogleCallback = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { isInitialized, isAuthenticated, user } = useSelector(state => state.auth);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get('error')) {
      toast.error(t('auth.login.google_fail'));
      navigate(APP_ROUTES.AUTH.LOGIN, { replace: true });
      return;
    }

    if (isInitialized) {
      if (isAuthenticated) {
        toast.success(t('auth.login.success'));
        const role = user?.role;
        const defaultRoute = role === 'customer' ? APP_ROUTES.CUSTOMER.DASHBOARD : APP_ROUTES.SOC.DASHBOARD;
        navigate(defaultRoute, { replace: true });
      } else {
        toast.error(t('auth.login.google_fail'));
        navigate(APP_ROUTES.AUTH.LOGIN, { replace: true });
      }
    }
  }, [location, isInitialized, isAuthenticated, user, navigate, t]);

  return <GlobalLoading forceShow={true} />;
};

export default GoogleCallback;

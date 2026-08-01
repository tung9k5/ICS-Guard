import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AuthLayout from '@/layouts/AuthLayout';
import CustomerLayout from '@/layouts/MainLayout';
import StatusLayout from '@/layouts/StatusLayout';
import { APP_ROUTES } from '@/constants/routes';

// Lazy load pages
const Login = lazy(() => import('@/pages/Login'));
const Register = lazy(() => import('@/pages/Register'));
const GoogleCallback = lazy(() => import('@/pages/Login/GoogleCallback'));
const NotFound = lazy(() => import('@/pages/NotFound'));
const UnderConstruction = lazy(() => import('@/pages/UnderConstruction'));
const CustomerDashboard = lazy(() => import('@/pages/Dashboard'));
const CustomerDevices = lazy(() => import('@/pages/DeviceManagement'));
const CustomerAlerts = lazy(() => import('@/pages/AlertManagement'));
const CustomerIncidents = lazy(() => import('@/pages/IncidentManagement'));

const AppRoutes = () => {
  return (
    <Suspense fallback={<div className="global-loading-fallback" />}>
      <Routes>
        {/* Redirect root to customer dashboard */}
        <Route path="/" element={<Navigate to={APP_ROUTES.CUSTOMER.DASHBOARD} replace />} />

        <Route element={<AuthLayout />}>
          <Route path={APP_ROUTES.AUTH.LOGIN} element={<Login />} />
          <Route path={APP_ROUTES.AUTH.REGISTER} element={<Register />} />
        </Route>

        <Route path={APP_ROUTES.AUTH.GOOGLE_CALLBACK} element={<GoogleCallback />} />

        <Route element={<CustomerLayout />}>
          <Route path={APP_ROUTES.CUSTOMER.DASHBOARD} element={<CustomerDashboard />} />
          <Route path={APP_ROUTES.CUSTOMER.DEVICES} element={<CustomerDevices />} />
          <Route path={APP_ROUTES.CUSTOMER.ALERTS} element={<CustomerAlerts />} />
          <Route path={APP_ROUTES.CUSTOMER.INCIDENTS} element={<CustomerIncidents />} />
        </Route>

        <Route element={<StatusLayout />}>
          <Route path={APP_ROUTES.STATUS.COMING_SOON} element={<UnderConstruction />} />
          <Route path={APP_ROUTES.STATUS.NOT_FOUND} element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
};

export default AppRoutes;

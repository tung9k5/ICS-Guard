import React, { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import AuthLayout from '@/layouts/AuthLayout';
import MainLayout from '@/layouts/MainLayout';
import StatusLayout from '@/layouts/StatusLayout';
import CustomerLayout from '@/layouts/CustomerLayout';
import { APP_ROUTES } from '@/constants/routes';

// Lazy load pages for better bundle splitting
const Login = lazy(() => import('@/pages/Login'));
const GoogleCallback = lazy(() => import('@/pages/Login/GoogleCallback'));
const Register = lazy(() => import('@/pages/Register'));
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const DeviceManagement = lazy(() => import('@/pages/DeviceManagement'));
const UserManagement = lazy(() => import('@/pages/UserManagement'));
const IncidentManagement = lazy(() => import('@/pages/IncidentManagement'));
const AuditManagement = lazy(() => import('@/pages/AuditManagement'));
const AttackSimulator = lazy(() => import('@/pages/AttackSimulator'));
const RuleManagement = lazy(() => import('@/pages/RuleManagement'));
const AlertManagement = lazy(() => import('@/pages/AlertManagement'));
const NotFound = lazy(() => import('@/pages/NotFound'));
const UnderConstruction = lazy(() => import('@/pages/UnderConstruction'));
const CustomerDashboard = lazy(() => import('@/pages/Customer/Dashboard'));
const CustomerDevices = lazy(() => import('@/pages/Customer/DeviceManagement'));
const CustomerAlerts = lazy(() => import('@/pages/Customer/AlertManagement'));
const CustomerIncidents = lazy(() => import('@/pages/Customer/IncidentManagement'));

const AppRoutes = () => {
  return (
    <Suspense fallback={<div className="global-loading-fallback" />}>
      <Routes>
        <Route element={<AuthLayout />}>
          <Route path={APP_ROUTES.AUTH.LOGIN} element={<Login />} />
          <Route path={APP_ROUTES.AUTH.REGISTER} element={<Register />} />
          <Route path={APP_ROUTES.AUTH.ATTACKER_LOGIN} element={<Login isAttacker={true} />} />
        </Route>

        <Route path={APP_ROUTES.AUTH.GOOGLE_CALLBACK} element={<GoogleCallback />} />

        <Route element={<MainLayout />}>
          <Route path={APP_ROUTES.SOC.DASHBOARD} element={<Dashboard />} />
          <Route path={APP_ROUTES.SOC.DEVICE_MANAGEMENT} element={<DeviceManagement />} />
          <Route path={APP_ROUTES.SOC.USER_MANAGEMENT} element={<UserManagement />} />
          <Route path={APP_ROUTES.SOC.INCIDENT_MANAGEMENT} element={<IncidentManagement />} />
          <Route path={APP_ROUTES.SOC.RULE_MANAGEMENT} element={<RuleManagement />} />
          <Route path={APP_ROUTES.SOC.ALERT_MANAGEMENT} element={<AlertManagement />} />
          <Route path={APP_ROUTES.SOC.AUDIT_MANAGEMENT} element={<AuditManagement />} />
          <Route path={APP_ROUTES.SOC.ATTACK_SIMULATOR} element={<AttackSimulator />} />
        </Route>
        
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

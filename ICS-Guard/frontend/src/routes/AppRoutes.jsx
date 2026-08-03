import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import AuthLayout from '@/layouts/AuthLayout';
import MainLayout from '@/layouts/MainLayout';
import StatusLayout from '@/layouts/StatusLayout';
const Login = lazy(() => import('@/pages/Login'));
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const DeviceManagement = lazy(() => import('@/pages/DeviceManagement'));
const Onboarding = lazy(() => import('@/pages/Onboarding'));
const Topology = lazy(() => import('@/pages/Topology'));
const UserManagement = lazy(() => import('@/pages/UserManagement'));
const OperationReports = lazy(() => import('@/pages/OperationReports'));
const IncidentManagement = lazy(() => import('@/pages/IncidentManagement'));
const AlertManagement = lazy(() => import('@/pages/AlertManagement'));
const RuleManagement = lazy(() => import('@/pages/RuleManagement'));
const PlaybookManagement = lazy(() => import('@/pages/PlaybookManagement'));
const AuditManagement = lazy(() => import('@/pages/AuditManagement'));
const OtZoneMatrix = lazy(() => import('@/pages/OtZoneMatrix'));
const ThreatIntel = lazy(() => import('@/pages/ThreatIntel'));
const SystemSettings = lazy(() => import('@/pages/Settings'));
const NotFound = lazy(() => import('@/pages/NotFound'));
const UnderConstruction = lazy(() => import('@/pages/UnderConstruction'));


const RouteFallback = () => (
  <div role="status" aria-live="polite" style={{ padding: '2rem', textAlign: 'center' }}>
    Đang tải trang…
  </div>
);

// Hàm kiểm tra Hybrid Onboarding - đồng bộ với MainLayout
const shouldOnboard = (token) => {
  try {
    const payload = jwtDecode(token);
    const isFirst = payload.isFirstLogin === true;
    const isCriticalRole = ['admin', 'analyst'].includes(payload.role);
    const isTelegramMissing = !payload.telegramChatId;
    return isFirst || (isCriticalRole && isTelegramMissing);
  } catch (e) {
    return false;
  }
};

// Route /onboarding: Chỉ hiện nếu cần onboard, ngược lại redirect về /
const OnboardingRoute = () => {
  const token = localStorage.getItem('access_token');
  if (!token) return <Navigate to="/login" replace />;
  if (shouldOnboard(token)) return <Onboarding />;
  return <Navigate to="/" replace />;
};

// Guard cho AuthLayout: Nếu đã đăng nhập thì redirect đúng chỗ
const AuthGuard = () => {
  const token = localStorage.getItem('access_token');
  if (!token) return <Outlet />;
  // Đã đăng nhập: kiểm tra có cần onboarding không
  if (shouldOnboard(token)) return <Navigate to="/onboarding" replace />;
  return <Navigate to="/" replace />;
};

const RoleProtectedRoute = ({ allowedRoles, children }) => {
  const token = localStorage.getItem('access_token');
  if (!token) return <Navigate to="/login" replace />;
  try {
    const payload = jwtDecode(token);
    if (!payload || !payload.role || !allowedRoles.includes(payload.role)) {
      return <Navigate to="/coming-soon" replace />;
    }
  } catch (e) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

const AppRoutes = () => {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
      <Route element={<AuthGuard />}>
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<Login />} />
        </Route>
      </Route>

      {/* Onboarding Route */}
      <Route path="/onboarding" element={<OnboardingRoute />} />

      {/* Protected SOC Dashboard Routes */}
      <Route element={<MainLayout />}>
        <Route path="/" element={<Dashboard />} />
        
        {/* Security & Incidents */}
        <Route path="/incident-management" element={
          <RoleProtectedRoute allowedRoles={['admin', 'analyst', 'l2_responder', 'ot_operator']}>
            <IncidentManagement />
          </RoleProtectedRoute>
        } />
        <Route path="/alert-management" element={<Navigate to="/incident-management?tab=alerts" replace />} />
        <Route path="/rule-management" element={
          <RoleProtectedRoute allowedRoles={['admin', 'analyst']}>
            <RuleManagement />
          </RoleProtectedRoute>
        } />
        <Route path="/playbook-management" element={
          <RoleProtectedRoute allowedRoles={['admin', 'analyst']}>
            <PlaybookManagement />
          </RoleProtectedRoute>
        } />
        <Route path="/threat-intel" element={
          <RoleProtectedRoute allowedRoles={['admin', 'analyst', 'l2_responder']}>
            <ThreatIntel />
          </RoleProtectedRoute>
        } />

        {/* System & Devices */}
        <Route path="/device-management" element={
          <RoleProtectedRoute allowedRoles={['admin', 'device_management']}>
            <DeviceManagement />
          </RoleProtectedRoute>
        } />
        <Route path="/ot-zone-matrix" element={
          <RoleProtectedRoute allowedRoles={['admin', 'device_management', 'analyst']}>
            <OtZoneMatrix />
          </RoleProtectedRoute>
        } />
        <Route path="/topology" element={
          <RoleProtectedRoute allowedRoles={['admin', 'device_management', 'analyst']}>
            <Topology />
          </RoleProtectedRoute>
        } />

        {/* Administration */}
        <Route path="/user-management" element={
          <RoleProtectedRoute allowedRoles={['admin', 'hr_management']}>
            <UserManagement />
          </RoleProtectedRoute>
        } />
        <Route path="/audit-management" element={
          <RoleProtectedRoute allowedRoles={['admin', 'hr_management']}>
            <AuditManagement />
          </RoleProtectedRoute>
        } />
        <Route path="/reports" element={
          <RoleProtectedRoute allowedRoles={['admin', 'hr_management']}>
            <OperationReports />
          </RoleProtectedRoute>
        } />
        <Route path="/settings" element={
          <RoleProtectedRoute allowedRoles={['admin', 'device_management', 'analyst', 'hr_management']}>
            <SystemSettings />
          </RoleProtectedRoute>
        } />
        <Route path="/coming-soon" element={<UnderConstruction />} />
      </Route>

      {/* Status Routes (Under Construction & Not Found) */}
      <Route element={<StatusLayout />}>
        <Route path="*" element={<NotFound />} />
      </Route>
      </Routes>
    </Suspense>
  );
};

export default AppRoutes;

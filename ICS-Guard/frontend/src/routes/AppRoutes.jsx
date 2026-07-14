import React from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import AuthLayout from '@/layouts/AuthLayout';
import MainLayout from '@/layouts/MainLayout';
import StatusLayout from '@/layouts/StatusLayout';
import AttackerLayout from '@/layouts/AttackerLayout';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import Dashboard from '@/pages/Dashboard';
import Assets from '@/pages/Assets';
import Onboarding from '@/pages/Onboarding';
import AttackerConsole from '@/pages/AttackerConsole';
import HardwareSimulator from '@/pages/HardwareSimulator';
import Topology from '@/pages/Topology';
import UserManagement from '@/pages/UserManagement';
import OperationReports from '@/pages/OperationReports';
import NotFound from '@/pages/NotFound';
import UnderConstruction from '@/pages/UnderConstruction';

// Hàm kiểm tra Hybrid Onboarding - đồng bộ với MainLayout
const shouldOnboard = (token) => {
  try {
    const payload = jwtDecode(token);
    const isFirst = payload.isFirstLogin === true;
    const isCriticalRole = ['admin', 'l3_manager'].includes(payload.role);
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
    <Routes>
      {/* Auth Routes - AuthGuard chặn người đã đăng nhập vào lại */}
      <Route element={<AuthGuard />}>
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/attacker/login" element={<Login isAttacker={true} />} />
        </Route>
      </Route>

      {/* Onboarding Route */}
      <Route path="/onboarding" element={<OnboardingRoute />} />

      {/* Protected SOC Dashboard Routes */}
      <Route element={<MainLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/devices" element={
          <RoleProtectedRoute allowedRoles={['admin', 'device_manager']}>
            <Assets />
          </RoleProtectedRoute>
        } />
        <Route path="/topology" element={
          <RoleProtectedRoute allowedRoles={['admin', 'device_manager', 'analyst']}>
            <Topology />
          </RoleProtectedRoute>
        } />
        <Route path="/users" element={
          <RoleProtectedRoute allowedRoles={['admin', 'hr_manager']}>
            <UserManagement />
          </RoleProtectedRoute>
        } />
        <Route path="/reports" element={
          <RoleProtectedRoute allowedRoles={['admin', 'hr_manager', 'device_manager', 'analyst']}>
            <OperationReports />
          </RoleProtectedRoute>
        } />
        <Route path="/coming-soon" element={<UnderConstruction />} />
      </Route>

      {/* Attacker Console Routes */}
      <Route element={<AttackerLayout />}>
        <Route path="/attacker" element={<AttackerConsole />} />
      </Route>

      {/* IoT Hardware Simulator Route */}
      <Route path="/simulator" element={<HardwareSimulator />} />

      {/* Status Routes (Under Construction & Not Found) */}
      <Route element={<StatusLayout />}>
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
};

export default AppRoutes;

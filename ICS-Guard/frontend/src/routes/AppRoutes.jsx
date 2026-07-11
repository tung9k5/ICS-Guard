import React from 'react';
import { Routes, Route } from 'react-router-dom';
import AuthLayout from '@/layouts/AuthLayout';
import MainLayout from '@/layouts/MainLayout';
import StatusLayout from '@/layouts/StatusLayout';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import Dashboard from '@/pages/Dashboard';
import DeviceManagement from '@/pages/DeviceManagement';
import UserManagement from '@/pages/UserManagement';
import IncidentManagement from '@/pages/IncidentManagement';
import AuditManagement from '@/pages/AuditManagement';
import AttackSimulator from '@/pages/AttackSimulator';
import NotFound from '@/pages/NotFound';
import UnderConstruction from '@/pages/UnderConstruction';


const AppRoutes = () => {
  return (
    <Routes>
      {/* Auth Routes */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/attacker/login" element={<Login isAttacker={true} />} />
      </Route>

      {/* Protected SOC Dashboard Routes */}
      <Route element={<MainLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/device-management" element={<DeviceManagement />} />
        <Route path="/user-management" element={<UserManagement />} />
        <Route path="/incident-management" element={<IncidentManagement />} />
        <Route path="/audit-management" element={<AuditManagement />} />
        <Route path="/attack-simulator" element={<AttackSimulator />} />
      </Route>

      {/* Status Routes (Under Construction & Not Found) */}
      <Route element={<StatusLayout />}>
        <Route path="/coming-soon" element={<UnderConstruction />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
};

export default AppRoutes;

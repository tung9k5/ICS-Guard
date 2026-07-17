import React from 'react';
import { Routes, Route } from 'react-router-dom';
import AuthLayout from '@/layouts/AuthLayout';
import MainLayout from '@/layouts/MainLayout';
import StatusLayout from '@/layouts/StatusLayout';
import CustomerLayout from '@/layouts/CustomerLayout';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import Dashboard from '@/pages/Dashboard';
import DeviceManagement from '@/pages/DeviceManagement';
import UserManagement from '@/pages/UserManagement';
import IncidentManagement from '@/pages/IncidentManagement';
import AuditManagement from '@/pages/AuditManagement';
import AttackSimulator from '@/pages/AttackSimulator';
import RuleManagement from '@/pages/RuleManagement';
import AlertManagement from '@/pages/AlertManagement';
import NotFound from '@/pages/NotFound';
import UnderConstruction from '@/pages/UnderConstruction';
import CustomerDashboard from '@/pages/Customer/Dashboard';
import CustomerDevices from '@/pages/Customer/DeviceManagement';
import CustomerAlerts from '@/pages/Customer/AlertManagement';
import CustomerIncidents from '@/pages/Customer/IncidentManagement';


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
        <Route path="/rule-management" element={<RuleManagement />} />
        <Route path="/alert-management" element={<AlertManagement />} />
        <Route path="/audit-management" element={<AuditManagement />} />
        <Route path="/attack-simulator" element={<AttackSimulator />} />
      </Route>
      
      {/* Protected Customer Routes */}
      <Route element={<CustomerLayout />}>
        <Route path="/customer/dashboard" element={<CustomerDashboard />} />
        <Route path="/customer/devices" element={<CustomerDevices />} />
        <Route path="/customer/alerts" element={<CustomerAlerts />} />
        <Route path="/customer/incidents" element={<CustomerIncidents />} />
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

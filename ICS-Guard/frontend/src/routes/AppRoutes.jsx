import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AuthLayout from '@/layouts/AuthLayout';
import MainLayout from '@/layouts/MainLayout';
import AttackerLayout from '@/layouts/AttackerLayout';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import Dashboard from '@/pages/Dashboard';
import AttackerConsole from '@/pages/AttackerConsole';

import Onboarding from '@/pages/Onboarding';

const AppRoutes = () => {
  return (
    <Routes>
      {/* Auth Routes */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/attacker/login" element={<Login isAttacker={true} />} />
        <Route path="/onboarding" element={<Onboarding />} />
      </Route>

      {/* Protected SOC Dashboard Routes */}
      <Route element={<MainLayout />}>
        <Route path="/" element={<Dashboard />} />
      </Route>

      {/* Protected Attacker Console Routes */}
      <Route element={<AttackerLayout />}>
        <Route path="/attacker" element={<AttackerConsole />} />
      </Route>

      {/* Fallback route */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default AppRoutes;

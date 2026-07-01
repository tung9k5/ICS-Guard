import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AuthLayout from '@/layouts/AuthLayout';
import MainLayout from '@/layouts/MainLayout';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import Dashboard from '@/pages/Dashboard';
import AttackerConsole from '@/pages/AttackerConsole';

const AppRoutes = () => {
  return (
    <Routes>
      {/* Auth Routes */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Route>

      {/* Standalone Public Route for Attacker Console */}
      <Route path="/attacker" element={<AttackerConsole />} />

      {/* Protected Routes */}
      <Route element={<MainLayout />}>
        <Route path="/" element={<Dashboard />} />
        
        {/* Fallback route within MainLayout */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
};

export default AppRoutes;

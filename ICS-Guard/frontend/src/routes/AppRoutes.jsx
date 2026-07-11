import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AuthLayout from '@/layouts/AuthLayout';
import MainLayout from '@/layouts/MainLayout';
import StatusLayout from '@/layouts/StatusLayout';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import Dashboard from '@/pages/Dashboard';
import Assets from '@/pages/Assets';
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
        <Route path="/assets" element={<Assets />} />
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

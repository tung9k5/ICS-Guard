import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import AttackerLayout from '@/layouts/AttackerLayout';
import StatusLayout from '@/layouts/StatusLayout';

const AttackerConsole = lazy(() => import('@/pages/AttackerConsole'));
const HardwareSimulator = lazy(() => import('@/pages/HardwareSimulator'));
const NotFound = lazy(() => import('@/pages/NotFound'));
const Login = lazy(() => import('@/pages/Login'));

const AppRoutes = () => {
  return (
    <Suspense fallback={<div role="status" style={{ padding: '2rem', textAlign: 'center' }}>Đang tải…</div>}>
      <Routes>
        <Route path="/" element={<HardwareSimulator />} />
        <Route path="/simulator" element={<HardwareSimulator />} />
        <Route path="/attacks" element={<AttackerConsole />} />
        <Route element={<AttackerLayout />}>
          <Route path="/attacker" element={<AttackerConsole />} />
        </Route>
        <Route path="/login" element={<Login />} />
        <Route path="/attacker/login" element={<Login isAttacker />} />
        <Route element={<StatusLayout />}>
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
};

export default AppRoutes;

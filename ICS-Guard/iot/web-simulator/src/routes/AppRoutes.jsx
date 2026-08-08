import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AttackerLayout from '@/layouts/AttackerLayout';
import StatusLayout from '@/layouts/StatusLayout';

const AttackerConsole = lazy(() => import('@/pages/AttackerConsole'));
const HardwareSimulator = lazy(() => import('@/pages/HardwareSimulator'));
const NotFound = lazy(() => import('@/pages/NotFound'));

const AppRoutes = () => {
  return (
    <Suspense fallback={<div role="status" style={{ padding: '2rem', textAlign: 'center' }}>Đang tải…</div>}>
      <Routes>
        <Route path="/" element={<HardwareSimulator />} />
        <Route path="/simulator" element={<HardwareSimulator />} />
        <Route element={<AttackerLayout />}>
          <Route path="/attacks" element={<AttackerConsole />} />
          <Route path="/attacker" element={<AttackerConsole />} />
          <Route path="/attacker/login" element={<Navigate to="/attacker" replace />} />
        </Route>
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route element={<StatusLayout />}>
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
};

export default AppRoutes;

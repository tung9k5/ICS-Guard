import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';

const AttackerLayout = () => {
  const isAuthenticated = localStorage.getItem('attacker_authenticated') === 'true';

  if (!isAuthenticated) {
    return <Navigate to="/attacker/login" replace />;
  }

  return (
    <div className="main-layout">
      <div className="main-content-wrapper relative">
        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AttackerLayout;

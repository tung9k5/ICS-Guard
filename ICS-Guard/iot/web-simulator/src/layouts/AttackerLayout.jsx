import React from 'react';
import { Outlet } from 'react-router-dom';

const AttackerLayout = () => {
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

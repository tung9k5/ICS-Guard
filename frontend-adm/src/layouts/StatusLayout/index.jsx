import React from 'react';
import { Outlet } from 'react-router-dom';
import './StatusLayout.scss';

const StatusLayout = () => {
  return (
    <div className="status-layout">
      <div className="status-container">
        <Outlet />
      </div>
    </div>
  );
};

export default StatusLayout;

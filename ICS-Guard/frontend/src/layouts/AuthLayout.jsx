import React from 'react';
import { Outlet } from 'react-router-dom';
import './AuthLayout.scss';

const AuthLayout = () => {
  return (
    <div className="auth-layout">
      <div className="auth-cover">
        <div className="auth-cover-content">
          <h1>Chào mừng đến với ICS-Guard</h1>
          <p>Nền tảng giám sát an ninh mạng thế hệ mới dành cho hệ thống điều khiển công nghiệp.</p>
        </div>
      </div>

      <div className="auth-panel">
        <div className="auth-header">
          <img src="/logo.png" alt="ICS-Guard Logo" className="auth-logo" />
          <p className="auth-subtitle">Nền Tảng Giám Sát An Ninh</p>
        </div>
        
        <Outlet />
      </div>
    </div>
  );
};

export default AuthLayout;

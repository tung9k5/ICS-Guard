import React from 'react';
import { Outlet, Navigate, useNavigate, useLocation, Link } from 'react-router-dom';
import { LogOut, Shield, ShieldAlert } from 'lucide-react';
import authApi from '@/api/auth';
import './MainLayout.scss';

const MainLayout = () => {
  const token = localStorage.getItem('access_token');
  const navigate = useNavigate();
  const location = useLocation();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  const getIsFirstLogin = () => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.isFirstLogin === true;
    } catch (e) {
      return false;
    }
  };

  if (getIsFirstLogin()) {
    return <Navigate to="/onboarding" replace />;
  }

  const currentPath = location.pathname;

  const handleLogout = async () => {
    try {
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        await authApi.logout({ refresh_token: refreshToken });
      }
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      navigate('/login');
    }
  };

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

export default MainLayout;

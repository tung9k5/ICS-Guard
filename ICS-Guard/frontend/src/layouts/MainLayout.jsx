import React from 'react';
import { Outlet, Navigate, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import authApi from '@/api/auth';
import './MainLayout.scss';

const MainLayout = () => {
  const token = localStorage.getItem('access_token');
  const navigate = useNavigate();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

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
        <button 
          onClick={handleLogout}
          className="logout-floating-btn"
          title="Đăng xuất"
        >
          <LogOut size={20} />
          <span>Đăng xuất</span>
        </button>
        
        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MainLayout;

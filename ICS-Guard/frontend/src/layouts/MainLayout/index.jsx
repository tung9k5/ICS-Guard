import './MainLayout.scss';
import React, { useState } from 'react';
import { Outlet, Navigate, useNavigate, useLocation } from 'react-router-dom';
import authApi from '@/api/auth';
import Sidebar from '@/sections/Layout/Sidebar';
import Header from '@/sections/Layout/Header';
import GlobalLoading from '@/components/GlobalLoading';
import Profile from '@/sections/Profile';
import { connectAuthenticatedSocket, disconnectSocket } from '@/services/socket';

const MainLayout = () => {
  const token = localStorage.getItem('access_token');
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [user, setUser] = useState(() => {
    const cached = sessionStorage.getItem('cached_user');
    return cached ? JSON.parse(cached) : null;
  });

  React.useEffect(() => {
    connectAuthenticatedSocket();
    return () => disconnectSocket();
  }, []);

  React.useEffect(() => {
    const fetchUser = async () => {
      try {
        const token = localStorage.getItem('access_token');
        if (!token) return;

        const cached = sessionStorage.getItem('cached_user');
        if (cached) return;

        const res = await authApi.getProfile();
        if (res && res.user) {
          sessionStorage.setItem('cached_user', JSON.stringify(res.user));
          setUser(res.user);
        }
      } catch (err) {
        console.error('Failed to fetch user:', err);
      }
    };

    fetchUser();
  }, []);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  const getShouldOnboard = () => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const isFirst = payload.isFirstLogin === true;
      const isCriticalRole = ['admin', 'analyst'].includes(payload.role);
      const isTelegramMissing = !payload.telegramChatId;
      return isFirst || (isCriticalRole && isTelegramMissing);
    } catch (e) {
      return false;
    }
  };

  if (getShouldOnboard()) {
    return <Navigate to="/onboarding" replace />;
  }

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  const handleUpdateUser = (updatedUser) => {
    setUser(updatedUser);
    sessionStorage.setItem('cached_user', JSON.stringify(updatedUser));
  };

  return (
    <div className="main-layout">
      <Sidebar isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} />
      <div className="main-content-wrapper relative">
        <Header
          toggleSidebar={toggleSidebar}
          user={user}
          onUpdateUser={handleUpdateUser}
          onOpenProfile={() => setIsProfileOpen(true)}
        />
        <main className="main-content">
          <div className="page-container">
            <Outlet />
          </div>
        </main>
      </div>
      <GlobalLoading />
      {isProfileOpen && (
        <Profile
          user={user}
          onClose={() => setIsProfileOpen(false)}
          onUpdate={handleUpdateUser}
        />
      )}
    </div>
  );
};

export default MainLayout;

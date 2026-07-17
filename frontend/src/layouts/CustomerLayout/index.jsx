import React, { useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import authApi from '@/api/auth';
import CustomerSidebar from '@/sections/Layout/Customer/Sidebar';
import CustomerHeader from '@/sections/Layout/Customer/Header';
import GlobalLoading from '@/components/GlobalLoading';
import Profile from '@/sections/Profile';
import DraggableChatbot from '@/components/DraggableChatbot';

const CustomerLayout = () => {
  const token = localStorage.getItem('access_token');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [user, setUser] = useState(() => {
    const cached = sessionStorage.getItem('cached_user');
    return cached ? JSON.parse(cached) : null;
  });

  React.useEffect(() => {
    const fetchUser = async () => {
      try {
        const t = localStorage.getItem('access_token');
        if (!t) return;
        const res = await authApi.getProfile();
        const userData = res.data?.user || res.data || res.user;
        if (userData) {
          sessionStorage.setItem('cached_user', JSON.stringify(userData));
          setUser(userData);
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

  // If admin somehow lands here, redirect to admin dashboard
  if (user && user.role === 'admin') {
    return <Navigate to="/" replace />;
  }

  const handleUpdateUser = (updatedUser) => {
    setUser(updatedUser);
    sessionStorage.setItem('cached_user', JSON.stringify(updatedUser));
  };

  return (
    <div className="main-layout">
      <CustomerSidebar isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} />
      <div className="main-content-wrapper">
        <CustomerHeader
          toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
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
      <DraggableChatbot />
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

export default CustomerLayout;

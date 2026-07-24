import React, { useState } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import authApi from '@/api/auth';
import CustomerSidebar from '@/sections/Layout/Customer/Sidebar';
import CustomerHeader from '@/sections/Layout/Customer/Header';
import GlobalLoading from '@/components/GlobalLoading';
import Profile from '@/sections/Profile';
import DraggableChatbot from '@/components/DraggableChatbot';
import { AUTH_KEYS } from '@/constants/authConstants';

const CustomerLayout = () => {
  const token = localStorage.getItem(AUTH_KEYS.ACCESS_TOKEN);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [user, setUser] = useState(() => {
    const cached = sessionStorage.getItem(AUTH_KEYS.CACHED_USER);
    return cached ? JSON.parse(cached) : null;
  });

  const fetchedRef = React.useRef(false);

  React.useEffect(() => {
    const fetchUser = async () => {
      if (fetchedRef.current) return;
      fetchedRef.current = true;
      try {
        const t = localStorage.getItem(AUTH_KEYS.ACCESS_TOKEN);
        if (!t) return;
        const res = await authApi.getProfile();
        const userData = res.data?.user || res.data || res.user;
        if (userData) {
          sessionStorage.setItem(AUTH_KEYS.CACHED_USER, JSON.stringify(userData));
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
      <DraggableChatbot key={user?.id || user?._id || 'guest'} user={user} />
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

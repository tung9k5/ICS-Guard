import './MainLayout.scss';
import React, { useState } from 'react';
import { Outlet, Navigate, useNavigate, useLocation, Link } from 'react-router-dom';
import { AlertOctagon } from 'lucide-react';
import authApi from '@/api/auth';
import http from '@/http/clients/api';
import Sidebar from '@/sections/Layout/Sidebar';
import Header from '@/sections/Layout/Header';
import GlobalLoading from '@/components/GlobalLoading';
import Profile from '@/sections/Profile';
import DraggableChatbot from '@/components/DraggableChatbot';

const MainLayout = () => {
  const token = localStorage.getItem('access_token');
  const navigate = useNavigate();
  const location = useLocation();
  const [emergencyAlert, setEmergencyAlert] = useState(null);
  const [quarantineLoading, setQuarantineLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [user, setUser] = useState(() => {
    const cached = sessionStorage.getItem('cached_user');
    return cached ? JSON.parse(cached) : null;
  });

  React.useEffect(() => {
    const fetchUser = async () => {
      try {
        const token = localStorage.getItem('access_token');
        if (!token) return;
        
        // Fetch current user info
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

  // If customer somehow lands on admin layout, redirect to customer dashboard
  if (user && user.role === 'customer') {
    return <Navigate to="/customer/dashboard" replace />;
  }

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const handleUpdateUser = (updatedUser) => {
    setUser(updatedUser);
    sessionStorage.setItem('cached_user', JSON.stringify(updatedUser));
  };

  return (
    <div className="main-layout">
      <Sidebar isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} />
      <div className="main-content-wrapper relative">
        <Header toggleSidebar={toggleSidebar} user={user} onUpdateUser={handleUpdateUser} onOpenProfile={() => setIsProfileOpen(true)} />
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

export default MainLayout;

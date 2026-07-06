import './MainLayout.scss';
import React, { useState } from 'react';
import { Outlet, Navigate, useNavigate, useLocation, Link } from 'react-router-dom';
import { AlertOctagon } from 'lucide-react';
import authApi from '@/api/auth';
import http from '@/http/clients/api';
import Sidebar from '@/components/common/Layout/Sidebar';
import Header from '@/components/common/Layout/Header';
import GlobalLoading from '@/components/common/UI/GlobalLoading';


const MainLayout = () => {
  const token = localStorage.getItem('access_token');
  const navigate = useNavigate();
  const location = useLocation();
  const [emergencyAlert, setEmergencyAlert] = useState(null);
  const [quarantineLoading, setQuarantineLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [user, setUser] = useState(() => {
    const cached = sessionStorage.getItem('cached_user');
    return cached ? JSON.parse(cached) : null;
  });

  React.useEffect(() => {
    const fetchUser = async () => {
      try {
        const token = localStorage.getItem('access_token');
        if (!token) return;
        
        const cached = sessionStorage.getItem('cached_user');
        if (cached) {
          // Already have cached user, no need to fetch again
          return;
        }

        // Fetch current user info
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

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  return (
    <div className="main-layout">
      <Sidebar isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} />
      <div className="main-content-wrapper relative">
        <Header toggleSidebar={toggleSidebar} user={user} />
        <main className="main-content">
          <div className="page-container">
            <Outlet />
          </div>
        </main>
      </div>
      <GlobalLoading />
    </div>
  );
};

export default MainLayout;

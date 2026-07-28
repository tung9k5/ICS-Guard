import './MainLayout.scss';
import React, { useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { setUser } from '@/store/slices/authSlice';
import Sidebar from '@/sections/Layout/Sidebar';
import Header from '@/sections/Layout/Header';
import GlobalLoading from '@/components/GlobalLoading';
import Profile from '@/sections/Profile';
import DraggableChatbot from '@/components/DraggableChatbot';

const MainLayout = () => {
  const dispatch = useDispatch();
  const { isInitialized, isAuthenticated, user } = useSelector(state => state.auth);
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  if (!isInitialized) {
    return <GlobalLoading />; // Show loading while App.jsx checks auth
  }

  if (!isAuthenticated) {
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
    dispatch(setUser(updatedUser));
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

export default MainLayout;

import React, { useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { setUser } from '@/store/slices/authSlice';
import CustomerSidebar from '@/sections/Layout/Sidebar';
import CustomerHeader from '@/sections/Layout/Header';
import GlobalLoading from '@/components/GlobalLoading';
import Profile from '@/sections/Profile';
import DraggableChatbot from '@/components/DraggableChatbot';
import './MainLayout.scss';

const CustomerLayout = () => {
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

  const handleUpdateUser = (updatedUser) => {
    dispatch(setUser(updatedUser));
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

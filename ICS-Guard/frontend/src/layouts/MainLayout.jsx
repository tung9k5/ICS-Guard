import React from 'react';
import { Outlet, Navigate, useNavigate, useLocation, Link } from 'react-router-dom';
import { LogOut, Shield, ShieldAlert } from 'lucide-react';
import authApi from '@/api/auth';
import http from '@/http/clients/api';
import { io } from 'socket.io-client';
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

  const handleQuarantine = async () => {
    if (!emergencyAlert) return;
    try {
      setQuarantineLoading(true);
      await http.post(`/devices/${emergencyAlert.device_id}/isolate`);
      alert(`Đã thực thi cô lập thiết bị ${emergencyAlert.device_id} thành công!`);
      setEmergencyAlert(null);
    } catch (err) {
      console.error(err);
      alert('Không thể thực thi cô lập thiết bị. Vui lòng kiểm tra quyền hạn.');
    } finally {
      setQuarantineLoading(false);
    }
  };

  return (
    <div className="main-layout">
      <div className="main-content-wrapper relative">
        <main className="main-content">
          <Outlet />
        </main>
      </div>

      {/* Emergency Cyberpunk Warning Popup Modal */}
      {emergencyAlert && (
        <div className="emergency-modal-overlay">
          <div className="emergency-modal">
            <div className="modal-icon">
              <AlertOctagon size={48} />
            </div>
            <h2>⚠️ PHÁT HIỆN TẤN CÔNG</h2>
            <p>{emergencyAlert.message}</p>
            <div className="modal-actions">
              <button 
                className="quarantine-btn" 
                onClick={handleQuarantine}
                disabled={quarantineLoading}
              >
                {quarantineLoading ? 'ĐANG CÔ LẬP...' : '🛡️ CÔ LẬP THIẾT BỊ NGAY'}
              </button>
              <button 
                className="close-btn" 
                onClick={() => setEmergencyAlert(null)}
                disabled={quarantineLoading}
              >
                ĐÓNG
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MainLayout;

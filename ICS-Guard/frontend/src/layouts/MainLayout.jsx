import React, { useState, useEffect, useRef } from 'react';
import { Outlet, Navigate, useNavigate } from 'react-router-dom';
import { LogOut, AlertOctagon } from 'lucide-react';
import authApi from '@/api/auth';
import http from '@/http/clients/api';
import { io } from 'socket.io-client';
import './MainLayout.scss';

const MainLayout = () => {
  const token = localStorage.getItem('access_token');
  const navigate = useNavigate();
  
  const [emergencyAlert, setEmergencyAlert] = useState(null);
  const [quarantineLoading, setQuarantineLoading] = useState(false);
  const lastAlertIdRef = useRef(null);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // 1. Heartbeat Registry and WebSocket Socket.io client setup
  useEffect(() => {
    // Send initial heartbeat
    const sendHeartbeat = async () => {
      try {
        await http.post('/users/heartbeat');
      } catch (err) {
        // Silently ignore heartbeat errors
      }
    };
    sendHeartbeat();
    const heartbeatInterval = setInterval(sendHeartbeat, 10000); // Heartbeat every 10 seconds

    // Initialize Socket.io connection to backend
    const socketUrl = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api').replace('/api', '');
    console.log('[WebSocket] Connecting to backend at:', socketUrl);
    const socket = io(socketUrl);

    socket.on('connect', () => {
      console.log('[WebSocket] Connected successfully to backend Socket.io. ID:', socket.id);
    });

    // Listen to NEW_ALERT event for emergency modals
    socket.on('NEW_ALERT', (alertData) => {
      console.log('[WebSocket] Received NEW_ALERT:', alertData);
      
      const formattedAlert = {
        id: alertData._id,
        device_id: alertData.device_id,
        message: `Cảnh báo [${alertData.rule_name}]: ${alertData.title} trên thiết bị ${alertData.device_id}! IP nguồn: ${alertData.source_ip || 'unknown'}`
      };
      
      if (formattedAlert.id !== lastAlertIdRef.current) {
        lastAlertIdRef.current = formattedAlert.id;
        setEmergencyAlert(formattedAlert);
      }
    });

    socket.on('disconnect', () => {
      console.log('[WebSocket] Disconnected from backend.');
    });

    return () => {
      clearInterval(heartbeatInterval);
      socket.disconnect();
    };
  }, []);

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

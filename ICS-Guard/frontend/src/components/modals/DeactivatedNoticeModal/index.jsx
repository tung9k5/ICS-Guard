import React, { useState, useEffect } from 'react';
import { ShieldAlert, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './DeactivatedNoticeModal.scss';

const DeactivatedNoticeModal = ({ visible, onLogout }) => {
  const [seconds, setSeconds] = useState(60);
  const navigate = useNavigate();

  useEffect(() => {
    if (!visible) return;

    // Lock navigation strictly to Dashboard '/'
    if (window.location.pathname !== '/') {
      navigate('/', { replace: true });
    }

    const timer = setInterval(() => {
      setSeconds(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          onLogout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [visible, navigate, onLogout]);

  if (!visible) return null;

  return (
    <div className="deactivated-notice-overlay">
      <div className="deactivated-notice-card">
        <div className="notice-icon-box">
          <ShieldAlert size={34} />
        </div>
        <h3>Tài Khoản Đã Bị Vô Hiệu Hóa</h3>
        <p>
          Tài khoản của bạn đã bị tạm thời vô hiệu hóa bởi Quản trị viên. 
          Phiên làm việc sẽ tự động đăng xuất sau 
          <span className="countdown-highlight">{seconds}s</span>.
        </p>
        <span className="lock-badge-subtext">
          🔒 Hệ thống đang khóa quyền thao tác và chỉ hiển thị Tổng quan Dashboard.
        </span>
      </div>
    </div>
  );
};

export default DeactivatedNoticeModal;

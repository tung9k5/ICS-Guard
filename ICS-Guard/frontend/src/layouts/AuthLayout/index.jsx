import './AuthLayout.scss';
import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';




const AuthLayout = () => {
  const location = useLocation();
  const isAttacker = location.pathname.startsWith('/attacker');

  return (
    <div className={`auth-layout ${isAttacker ? 'attacker-theme' : ''}`}>
      <div className="auth-cover">
        <div className="auth-cover-content">
          <h1>{isAttacker ? 'Cổng Mô Phỏng Tấn Công' : 'Chào mừng đến với ICS-Guard'}</h1>
          <p>
            {isAttacker 
              ? 'Công cụ thử nghiệm độ ổn định và mô phỏng các kịch bản xâm nhập hạ tầng công nghiệp.' 
              : 'Nền tảng giám sát an ninh mạng thế hệ mới dành cho hệ thống điều khiển công nghiệp.'}
          </p>
        </div>
      </div>

      <div className="auth-panel">

        
        <Outlet />
      </div>
    </div>
  );
};

export default AuthLayout;

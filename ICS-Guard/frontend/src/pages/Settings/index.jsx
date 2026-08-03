import React from 'react';
import { Settings, Clock, ShieldAlert } from 'lucide-react';
import './Settings.scss';

const SystemSettings = () => {
  return (
    <div className="system-settings-page coming-soon-container">
      <div className="coming-soon-card">
        <div className="icon-wrapper">
          <Settings size={48} className="spin-icon" color="#60a5fa" />
        </div>
        <h1>Setting (Cấu hình hệ thống)</h1>
        <div className="coming-soon-badge">
          <Clock size={16} />
          <span>COMING SOON</span>
        </div>
        <p className="description">
          Tính năng quản trị tham số nâng cao, tùy chỉnh chính sách MQTTS TLS 1.3 và bộ lọc Replay Attack đang trong quá trình nâng cấp và sẽ ra mắt ở phiên bản tiếp theo.
        </p>
      </div>
    </div>
  );
};

export default SystemSettings;

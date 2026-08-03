import React, { useState } from 'react';
import { Copy, Eye, EyeOff, CheckCircle, X, ShieldCheck, AlertTriangle } from 'lucide-react';
import VDialog from '@/components/VDialog';
import VButton from '@/components/VButton';

const CredentialsModal = ({ credentials, onClose }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [copiedField, setCopiedField] = useState('');

  const handleCopy = async (value, field) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => setCopiedField(''), 2000);
    } catch {
      // Fallback for older browsers
      const el = document.createElement('textarea');
      el.value = value;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopiedField(field);
      setTimeout(() => setCopiedField(''), 2000);
    }
  };

  const getRoleLabel = (role) => {
    const map = {
      admin: 'Quản trị viên',
      hr_management: 'Quản lý nhân sự (HR)',
      device_management: 'Quản lý thiết bị',
      analyst: 'Chuyên viên phân tích',
    };
    return map[role] || role;
  };

  return (
    <VDialog
      visible={true}
      onHide={onClose}
      header="Tài Khoản Đã Tạo Thành Công"
      style={{ maxWidth: '480px' }}
    >
      <div className="credentials-modal">
        {/* Success Banner */}
        <div className="credentials-success-banner">
          <ShieldCheck size={22} />
          <div>
            <strong>Tài khoản mới đã được tạo!</strong>
            <p>Vai trò: {getRoleLabel(credentials.role)}</p>
          </div>
        </div>

        {/* Credentials */}
        <div className="credentials-fields">
          {/* Username */}
          <div className="credential-row">
            <label>Tên đăng nhập</label>
            <div className="credential-value-wrap">
              <span className="credential-value">{credentials.username}</span>
              <button
                className={`copy-btn ${copiedField === 'username' ? 'copied' : ''}`}
                onClick={() => handleCopy(credentials.username, 'username')}
                title="Sao chép tên đăng nhập"
              >
                {copiedField === 'username' ? <CheckCircle size={14} /> : <Copy size={14} />}
                {copiedField === 'username' ? 'Đã sao chép' : 'Sao chép'}
              </button>
            </div>
          </div>

          {/* Temp Password */}
          <div className="credential-row">
            <label>Mật khẩu tạm thời</label>
            <div className="credential-value-wrap">
              <span className="credential-value credential-password">
                {showPassword ? credentials.tempPassword : '•'.repeat(credentials.tempPassword.length)}
              </span>
              <button
                className="toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
              <button
                className={`copy-btn ${copiedField === 'password' ? 'copied' : ''}`}
                onClick={() => handleCopy(credentials.tempPassword, 'password')}
                title="Sao chép mật khẩu"
              >
                {copiedField === 'password' ? <CheckCircle size={14} /> : <Copy size={14} />}
                {copiedField === 'password' ? 'Đã sao chép' : 'Sao chép'}
              </button>
            </div>
          </div>
        </div>

        {/* Warning */}
        <div className="credentials-warning">
          <AlertTriangle size={14} />
          <span>
            Đây là mật khẩu <strong>tạm thời</strong>. Nhân viên phải đổi mật khẩu ngay khi đăng nhập lần đầu.
            Vui lòng sao chép và cung cấp thông tin này một cách bảo mật.
          </span>
        </div>

        {/* Action */}
        <div className="credentials-actions">
          <VButton variant="primary" onClick={onClose}>
            <X size={16} />
            Đóng
          </VButton>
        </div>
      </div>
    </VDialog>
  );
};

export default CredentialsModal;

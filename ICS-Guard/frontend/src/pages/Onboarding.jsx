import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import authApi from '@/api/auth';
import http from '@/http/clients/api';
import { Lock, Mail, Send, Eye, EyeOff, CheckCircle, AlertCircle, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';

const Onboarding = () => {
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  
  const [isTesting, setIsTesting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [testError, setTestError] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Lấy tên tài khoản hiện tại từ Token để hiển thị lời chào mừng
  const getUsername = () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return 'Thành viên';
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.username || 'Thành viên';
    } catch (e) {
      return 'Thành viên';
    }
  };

  const handleTestConnection = async () => {
    if (!telegramChatId) {
      setTestError('Vui lòng nhập Telegram Chat ID trước khi kiểm tra.');
      return;
    }
    setTestError('');
    setIsTesting(true);
    setIsConnected(false);

    try {
      const response = await http({
        url: '/telemetry/test-telegram-connection',
        method: 'POST',
        data: { telegramChatId }
      });
      if (response && response.status === 'success') {
        setIsConnected(true);
      } else {
        setTestError('Không thể gửi tin nhắn. Hãy chắc chắn bạn đã nhấn /start với Bot.');
      }
    } catch (err) {
      console.error('Test telegram error:', err);
      setTestError(err.response?.data?.message || 'Không thể gửi tin nhắn. Vui lòng chat /start với Bot trước.');
    } finally {
      setIsTesting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');

    if (newPassword.length < 6) {
      setSubmitError('Mật khẩu mới phải chứa ít nhất 6 ký tự.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setSubmitError('Xác nhận mật khẩu không trùng khớp.');
      return;
    }

    if (!email) {
      setSubmitError('Vui lòng điền Email để nhận thông báo.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await authApi.setupOnboarding({
        newPassword,
        email,
        telegramChatId: telegramChatId || null
      });

      if (response && response.access_token) {
        localStorage.setItem('access_token', response.access_token);
        localStorage.setItem('refresh_token', response.refresh_token);
        
        // Điều hướng về trang Dashboard
        navigate('/');
        window.location.reload();
      }
    } catch (err) {
      console.error('Onboarding submit error:', err);
      setSubmitError(err.response?.data?.message || 'Lỗi thiết lập thông tin. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="onboarding-page-wrapper" style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(circle at 10% 20%, rgba(26, 32, 53, 0.95) 0%, rgba(11, 15, 26, 0.98) 90%)',
      fontFamily: "'Outfit', 'Inter', sans-serif",
      padding: '2rem 1rem',
      boxSizing: 'border-box'
    }}>
      <div className="glass-card" style={{
        width: '100%',
        maxWidth: '560px',
        background: 'rgba(255, 255, 255, 0.02)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        borderRadius: '16px',
        padding: '2.5rem',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5), 0 0 50px rgba(57, 255, 20, 0.02)',
        boxSizing: 'border-box'
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ color: '#fff', fontSize: '24px', fontWeight: 700, margin: '0 0 8px 0' }}>
            Thiết Lập Tài Khoản ICS-Guard
          </h1>
          <p style={{ color: '#8b949e', fontSize: '14px', margin: 0 }}>
            Chào mừng <strong>{getUsername()}</strong>! Vui lòng thay đổi mật khẩu và thiết lập liên hệ nhận cảnh báo để bắt đầu sử dụng.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Mật khẩu mới */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ color: '#e6edf3', fontSize: '13px', fontWeight: 600 }}>MẬT KHẨU MỚI</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#8b949e' }} />
              <input 
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Nhập ít nhất 6 ký tự..."
                required
                style={{
                  width: '100%',
                  padding: '12px 40px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                  outline: 'none',
                  transition: 'all 0.2s'
                }}
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', display: 'flex' }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Xác nhận mật khẩu */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ color: '#e6edf3', fontSize: '13px', fontWeight: 600 }}>XÁC NHẬN MẬT KHẨU</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#8b949e' }} />
              <input 
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Nhập lại mật khẩu..."
                required
                style={{
                  width: '100%',
                  padding: '12px 40px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                  outline: 'none'
                }}
              />
              <button 
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', display: 'flex' }}
              >
                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Email nhận tin */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ color: '#e6edf3', fontSize: '13px', fontWeight: 600 }}>EMAIL NHẬN CẢNH BÁO</label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#8b949e' }} />
              <input 
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@icsguard.local"
                required
                style={{
                  width: '100%',
                  padding: '12px 40px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          {/* Telegram Chat ID & Test Connection */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ color: '#e6edf3', fontSize: '13px', fontWeight: 600 }}>TELEGRAM CHAT ID (KHUYẾN NGHỊ)</label>
              
              <button 
                type="button"
                onClick={() => setShowGuide(!showGuide)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: 'none',
                  border: 'none',
                  color: '#39ff14',
                  fontSize: '12px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  outline: 'none'
                }}
              >
                <HelpCircle size={14} />
                <span>{showGuide ? 'Ẩn hướng dẫn' : 'Hướng dẫn lấy ID'}</span>
                {showGuide ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>

            {/* Accordion Hướng dẫn lấy Chat ID */}
            {showGuide && (
              <div style={{
                background: 'rgba(57, 255, 20, 0.03)',
                border: '1px solid rgba(57, 255, 20, 0.15)',
                borderRadius: '6px',
                padding: '12px 15px',
                color: '#c9d1d9',
                fontSize: '12px',
                lineHeight: '1.5',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ fontWeight: 700, color: '#39ff14' }}>💡 Hướng dẫn lấy Chat ID Telegram cá nhân:</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span><strong>Bước 1:</strong> Mở ứng dụng Telegram, tìm kiếm Bot <strong>`@userinfobot`</strong> hoặc click link: <a href="https://t.me/userinfobot" target="_blank" rel="noreferrer" style={{ color: '#39ff14', textDecoration: 'underline' }}>t.me/userinfobot</a>.</span>
                  <span><strong>Bước 2:</strong> Nhấn nút <strong>/start</strong>. Bot sẽ ngay lập tức gửi về ID của bạn (ví dụ: `123456789`). Copy chuỗi số đó.</span>
                  <span><strong>Bước 3:</strong> Tìm kiếm Bot an ninh của dự án: <strong>`@ics_guard_bot`</strong> (hoặc bot tương ứng) và bấm <strong>/start</strong> để cho phép Bot gửi tin.</span>
                  <span><strong>Bước 4:</strong> Điền chuỗi số ID vừa copy vào ô dưới và bấm nút <strong>Kiểm tra kết nối</strong> để xác thực.</span>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Send size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#8b949e' }} />
                <input 
                  type="text"
                  value={telegramChatId}
                  onChange={(e) => setTelegramChatId(e.target.value)}
                  placeholder="Nhập mã số Chat ID..."
                  style={{
                    width: '100%',
                    padding: '12px 40px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    outline: 'none'
                  }}
                />
              </div>
              <button 
                type="button"
                onClick={handleTestConnection}
                disabled={isTesting || !telegramChatId}
                style={{
                  background: isConnected ? '#39ff14' : 'rgba(255, 255, 255, 0.04)',
                  color: isConnected ? '#000' : '#e6edf3',
                  border: `1px solid ${isConnected ? '#39ff14' : 'rgba(255, 255, 255, 0.1)'}`,
                  padding: '0 16px',
                  borderRadius: '6px',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: (isTesting || !telegramChatId) ? 'not-allowed' : 'pointer',
                  opacity: (!telegramChatId) ? 0.5 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap'
                }}
              >
                {isTesting ? 'Đang gửi...' : isConnected ? 'Kết nối OK' : 'Kiểm tra'}
              </button>
            </div>

            {/* Test Connection Badge Status */}
            {isConnected && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#39ff14', fontSize: '12px', marginTop: '4px' }}>
                <CheckCircle size={14} />
                <span>Kiểm tra kết nối thành công! Vui lòng kiểm tra điện thoại của bạn.</span>
              </div>
            )}
            {testError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ff3b30', fontSize: '12px', marginTop: '4px' }}>
                <AlertCircle size={14} />
                <span>{testError}</span>
              </div>
            )}
          </div>

          {/* Lỗi submit chung */}
          {submitError && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 12px',
              borderRadius: '6px',
              background: 'rgba(255, 59, 48, 0.1)',
              border: '1px solid rgba(255, 59, 48, 0.2)',
              color: '#ff3b30',
              fontSize: '13px'
            }}>
              <AlertCircle size={16} />
              <span>{submitError}</span>
            </div>
          )}

          {/* Nút lưu kích hoạt */}
          <button 
            type="submit"
            disabled={isSubmitting}
            style={{
              background: '#39ff14',
              color: '#000',
              border: 'none',
              padding: '14px',
              borderRadius: '6px',
              fontWeight: 700,
              fontSize: '14px',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              boxShadow: '0 0 15px rgba(57, 255, 20, 0.2)',
              transition: 'all 0.2s',
              marginTop: '1rem'
            }}
          >
            {isSubmitting ? 'Đang kích hoạt...' : 'Kích hoạt tài khoản & Vào Dashboard'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Onboarding;

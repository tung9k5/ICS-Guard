import './Onboarding.scss';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import authApi from '@/api/auth';
import http from '@/http/clients/api';
import { jwtDecode } from 'jwt-decode';
import {
  Lock, Mail, Send, Eye, EyeOff,
  CheckCircle, AlertCircle, HelpCircle,
  ChevronDown, ChevronUp, ShieldAlert, KeyRound, Radio
} from 'lucide-react';

const Onboarding = () => {
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  // OTP flow states
  const [otpSent, setOtpSent] = useState(false);       // Đã gửi mã chưa
  const [otpCode, setOtpCode] = useState('');           // Mã user nhập vào
  const [otpVerified, setOtpVerified] = useState(false);// Đã xác thực thành công
  const [isSending, setIsSending] = useState(false);    // Đang gửi mã
  const [isVerifying, setIsVerifying] = useState(false);// Đang xác minh
  const [otpError, setOtpError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0); // Đếm ngược gửi lại

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const getUsername = () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return 'Thành viên';
      const payload = jwtDecode(token);
      return payload.username || 'Thành viên';
    } catch (e) {
      return 'Thành viên';
    }
  };

  // Khởi động đếm ngược 30s khi gửi mã
  const startResendCooldown = () => {
    setResendCooldown(30);
    const timer = setInterval(() => {
      setResendCooldown(prev => {
        if (prev <= 1) { clearInterval(timer); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSendOtp = async () => {
    if (!telegramChatId.trim()) {
      setOtpError('Vui lòng nhập Telegram Chat ID.');
      return;
    }
    setOtpError('');
    setIsSending(true);
    setOtpSent(false);
    setOtpVerified(false);
    setOtpCode('');

    try {
      const res = await http({
        url: '/v1/auth/send-telegram-otp',
        method: 'POST',
        data: { telegramChatId: telegramChatId.trim() }
      });
      if (res?.status === 'success') {
        setOtpSent(true);
        startResendCooldown();
      }
    } catch (err) {
      setOtpError(err.response?.data?.message || 'Không thể gửi mã. Hãy chắc bạn đã nhấn /start với Bot.');
    } finally {
      setIsSending(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode.trim() || otpCode.length < 6) {
      setOtpError('Vui lòng nhập đủ 6 số.');
      return;
    }
    setOtpError('');
    setIsVerifying(true);

    try {
      const res = await http({
        url: '/v1/auth/verify-telegram-otp',
        method: 'POST',
        data: { telegramChatId: telegramChatId.trim(), code: otpCode.trim() }
      });
      if (res?.status === 'success') {
        setOtpVerified(true);
        setOtpSent(false);
      }
    } catch (err) {
      setOtpError(err.response?.data?.message || 'Mã không đúng hoặc đã hết hạn.');
    } finally {
      setIsVerifying(false);
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
        sessionStorage.removeItem('cached_user');
        navigate('/', { replace: true });
        window.location.reload();
      }
    } catch (err) {
      setSubmitError(err.response?.data?.message || 'Lỗi thiết lập thông tin. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="onboarding-page">
      <div className="onboarding-card">

        {/* Header */}
        <div className="onboarding-header">
          <div className="onboarding-icon">
            <ShieldAlert size={26} />
          </div>
          <h1>Thiết Lập Tài Khoản Bảo Mật</h1>
          <p>
            Xin chào <strong>{getUsername()}</strong>. Hoàn tất các bước dưới
            để kích hoạt vai trò trong hệ thống ICS-Guard.
          </p>
        </div>

        {/* Stepper */}
        <div className="onboarding-stepper">
          <div className="step step--password">
            <KeyRound size={14} />
            <span>Mật khẩu bảo mật</span>
          </div>
          <div className="step-divider" />
          <div className="step step--telegram">
            <Radio size={14} />
            <span>Kênh cảnh báo (Telegram)</span>
          </div>
        </div>

        {/* Form */}
        <form className="onboarding-form" onSubmit={handleSubmit}>

          {/* Mật khẩu mới */}
          <div className="form-group">
            <label>MẬT KHẨU MỚI</label>
            <div className="input-wrapper">
              <span className="input-icon"><Lock size={16} /></span>
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Nhập tối thiểu 6 ký tự..."
                required
              />
              <button
                type="button"
                className="input-toggle"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Xác nhận mật khẩu */}
          <div className="form-group">
            <label>XÁC NHẬN MẬT KHẨU</label>
            <div className="input-wrapper">
              <span className="input-icon"><Lock size={16} /></span>
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Xác thực lại mật khẩu..."
                required
              />
              <button
                type="button"
                className="input-toggle"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Email */}
          <div className="form-group">
            <label>EMAIL NHẬN CẢNH BÁO</label>
            <div className="input-wrapper">
              <span className="input-icon"><Mail size={16} /></span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@icsguard.local"
                required
              />
            </div>
          </div>

          {/* Telegram Chat ID — OTP flow */}
          <div className="form-group">
            <div className="telegram-label-row">
              <label>TELEGRAM CHAT ID (BẮT BUỘC VỚI ADMIN / MANAGER)</label>
              <button
                type="button"
                className="guide-toggle-btn"
                onClick={() => setShowGuide(!showGuide)}
              >
                <HelpCircle size={14} />
                <span>{showGuide ? 'Ẩn' : 'Cách lấy ID'}</span>
                {showGuide ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
            </div>

            {/* Terminal accordion */}
            {showGuide && (
              <div className="terminal-guide">
                <div className="terminal-header">
                  <span className="terminal-title">console_guide.sh</span>
                  <span className="terminal-dot" />
                </div>
                <div className="terminal-lines">
                  <div className="terminal-line">
                    <span className="prompt">$ </span>
                    step_1: Truy cập Telegram Bot{' '}
                    <a href="https://t.me/userinfobot" target="_blank" rel="noreferrer">
                      @userinfobot
                    </a>
                  </div>
                  <div className="terminal-line">
                    <span className="prompt">$ </span>
                    step_2: Nhấn <span className="highlight">/start</span> → Bot gửi về ID của bạn
                    (vd: <span className="value">8908531668</span>) → Copy số đó.
                  </div>
                  <div className="terminal-line">
                    <span className="prompt">$ </span>
                    step_3: Mở{' '}
                    <a href="https://t.me/ics_guard_bot" target="_blank" rel="noreferrer">
                      @ics_guard_bot
                    </a>{' '}
                    và nhấn <span className="highlight">/start</span> để đăng ký nhận tin.
                  </div>
                  <div className="terminal-line">
                    <span className="prompt">$ </span>
                    step_4: Dán ID vào ô bên dưới → nhấn{' '}
                    <span className="highlight">Gửi mã xác nhận</span>.
                  </div>
                </div>
              </div>
            )}

            {/* Bước 1: Nhập Chat ID + nút Gửi mã */}
            {!otpVerified && (
              <div className="telegram-input-row">
                <div className="input-wrapper" style={{ flex: 1 }}>
                  <span className="input-icon"><Send size={16} /></span>
                  <input
                    type="text"
                    value={telegramChatId}
                    onChange={(e) => {
                      setTelegramChatId(e.target.value);
                      setOtpSent(false);
                      setOtpVerified(false);
                      setOtpCode('');
                      setOtpError('');
                    }}
                    placeholder="Nhập mã số Chat ID..."
                    disabled={otpVerified}
                  />
                </div>
                <button
                  type="button"
                  className={`test-btn${otpSent ? ' test-btn--sent' : ''}`}
                  onClick={handleSendOtp}
                  disabled={isSending || !telegramChatId.trim() || resendCooldown > 0 || otpVerified}
                >
                  {isSending ? (
                    <><span className="btn-spinner" /> Đang gửi...</>
                  ) : resendCooldown > 0 ? (
                    `Gửi lại (${resendCooldown}s)`
                  ) : otpSent ? (
                    'Gửi lại'
                  ) : (
                    'Gửi mã'
                  )}
                </button>
              </div>
            )}

            {/* Bước 2: Nhập OTP + nút Xác nhận — hiện sau khi gửi mã */}
            {otpSent && !otpVerified && (
              <div className="otp-input-row">
                <div className="otp-hint">
                  <span>📱 Kiểm tra Telegram, nhập mã 6 số bên dưới:</span>
                </div>
                <div className="telegram-input-row">
                  <div className="input-wrapper" style={{ flex: 1 }}>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => {
                        setOtpCode(e.target.value.replace(/\D/g, ''));
                        setOtpError('');
                      }}
                      placeholder="_ _ _ _ _ _"
                      style={{ textAlign: 'center', letterSpacing: '0.35em', fontSize: '18px', fontWeight: '700', paddingLeft: '12px' }}
                      autoFocus
                    />
                  </div>
                  <button
                    type="button"
                    className="test-btn"
                    onClick={handleVerifyOtp}
                    disabled={isVerifying || otpCode.length < 6}
                  >
                    {isVerifying ? (
                      <><span className="btn-spinner" /> Đang kiểm tra...</>
                    ) : (
                      'Xác nhận'
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Trạng thái thành công */}
            {otpVerified && (
              <div className="status-ok">
                <CheckCircle size={14} />
                <span>Telegram đã được xác thực! Chat ID: <strong>{telegramChatId}</strong> đã được liên kết.</span>
              </div>
            )}

            {/* Thông báo gửi mã thành công */}
            {otpSent && !otpVerified && !otpError && (
              <div className="status-info">
                <AlertCircle size={13} />
                <span>Mã đã được gửi. Hiệu lực trong 5 phút.</span>
              </div>
            )}

            {otpError && (
              <div className="status-error">
                <AlertCircle size={14} />
                <span>{otpError}</span>
              </div>
            )}
          </div>

          {/* Lỗi submit */}
          {submitError && (
            <div className="submit-error">
              <AlertCircle size={16} />
              <span>{submitError}</span>
            </div>
          )}

          {/* Nút hành động */}
          <div className="action-group">
            <button
              type="submit"
              className="btn-activate"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Đang cập nhật hệ thống...' : 'Kích hoạt tài khoản & Vào Dashboard'}
            </button>
            <button
              type="button"
              className="btn-cancel"
              onClick={async () => {
                try {
                  const refreshToken = localStorage.getItem('refresh_token');
                  if (refreshToken) await authApi.logout({ refresh_token: refreshToken });
                } catch (_) {
                } finally {
                  localStorage.removeItem('access_token');
                  localStorage.removeItem('refresh_token');
                  sessionStorage.removeItem('cached_user');
                  navigate('/login');
                  window.location.reload();
                }
              }}
            >
              Hủy bỏ (Đăng xuất)
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};

export default Onboarding;

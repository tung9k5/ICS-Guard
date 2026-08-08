import './Onboarding.scss';
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import authApi from '@/api/auth';
import http from '@/api/httpClient';
import { jwtDecode } from 'jwt-decode';
import {
  Lock, Mail, Send, Eye, EyeOff, User,
  CheckCircle, AlertCircle, HelpCircle,
  ChevronDown, ChevronUp, ShieldAlert, KeyRound, Radio, Check, X
} from 'lucide-react';

// ---- Password Strength Helper ----
const getPasswordStrength = (pwd) => {
  let score = 0;
  if (pwd.length >= 8) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^a-zA-Z0-9]/.test(pwd)) score++;
  return score; // 0-4
};

const STRENGTH_LABELS = ['', 'Yếu', 'Trung bình', 'Khá mạnh', 'Mạnh'];
const STRENGTH_CLASSES = ['', 'strength-weak', 'strength-fair', 'strength-good', 'strength-strong'];

// ---- Username-Email Similarity Check ----
const isUsernameTooSimilarToEmail = (uname, userEmail) => {
  if (!uname || !userEmail) return false;
  const emailPrefix = userEmail.split('@')[0].toLowerCase();
  const cleaned = uname.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (cleaned === emailPrefix) return true;
  if (emailPrefix.length > 3 && cleaned.includes(emailPrefix)) return true;
  return false;
};

const Onboarding = () => {
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  // OTP flow states
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpVerified, setOtpVerified] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    const loadInitialUserInfo = async () => {
      try {
        const res = await authApi.me();
        const currentUser = res?.user || res?.data?.user;
        if (currentUser) {
          if (currentUser.username) setUsername(currentUser.username);
          if (currentUser.email) setEmail(currentUser.email);
          if (currentUser.contactInfo?.telegramChatId) {
            setTelegramChatId(currentUser.contactInfo.telegramChatId);
          }
          return;
        }
      } catch (e) {
        console.warn('Could not fetch /auth/me for onboarding prefill:', e);
      }

      // Fallback from JWT token payload
      try {
        const token = localStorage.getItem('access_token');
        if (token) {
          const payload = jwtDecode(token);
          if (payload.username) setUsername(payload.username);
          if (payload.email) setEmail(payload.email);
          if (payload.telegramChatId) setTelegramChatId(payload.telegramChatId);
        }
      } catch (e) {}
    };

    loadInitialUserInfo();
  }, []);

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

  const getCurrentEmail = () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return '';
      const payload = jwtDecode(token);
      return payload.email || '';
    } catch (e) {
      return '';
    }
  };

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
        url: '/auth/send-telegram-otp',
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
        url: '/auth/verify-telegram-otp',
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

    // Validate password
    if (newPassword.length < 8) {
      setSubmitError('Mật khẩu mới phải chứa ít nhất 8 ký tự.');
      return;
    }
    if (getPasswordStrength(newPassword) < 3) {
      setSubmitError('Mật khẩu chưa đủ mạnh. Vui lòng đáp ứng ít nhất 3/4 tiêu chí bảo mật.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setSubmitError('Xác nhận mật khẩu không trùng khớp.');
      return;
    }

    // Validate username similarity
    const emailToCheck = email.trim() || getCurrentEmail();
    if (username.trim() && isUsernameTooSimilarToEmail(username.trim(), emailToCheck)) {
      setSubmitError('Tên đăng nhập không nên quá giống với địa chỉ email của bạn.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        newPassword,
        telegramChatId: telegramChatId || null,
        ...(username.trim() ? { username: username.trim() } : {}),
        ...(email.trim() ? { email: email.trim() } : {})
      };

      const response = await authApi.setupOnboarding(payload);

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

  const strength = getPasswordStrength(newPassword);

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

          {/* Username — Tùy chọn */}
          <div className="form-group">
            <label>
              TÊN ĐĂNG NHẬP
              <span className="optional-tag"> (Có thể đổi hoặc giữ nguyên)</span>
            </label>
            <div className="input-wrapper">
              <span className="input-icon"><User size={16} /></span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Nhập tên đăng nhập mới..."
                autoComplete="username"
              />
            </div>
            {username.trim() && isUsernameTooSimilarToEmail(username.trim(), email.trim() || getCurrentEmail()) && (
              <div className="status-error" style={{ marginTop: '6px' }}>
                <AlertCircle size={13} />
                <span>Tên đăng nhập không nên quá giống địa chỉ email của bạn.</span>
              </div>
            )}
          </div>

          {/* Mật khẩu mới */}
          <div className="form-group">
            <label>MẬT KHẨU MỚI <span style={{ color: 'var(--red-500)' }}>*</span></label>
            <div className="input-wrapper">
              <span className="input-icon"><Lock size={16} /></span>
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Tối thiểu 8 ký tự..."
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

            {/* Password Strength Indicator */}
            {newPassword && (
              <div className="password-strength-meter">
                <div className="strength-bars">
                  {[1, 2, 3, 4].map(i => (
                    <div
                      key={i}
                      className={`strength-bar ${strength >= i ? STRENGTH_CLASSES[strength] : ''}`}
                    />
                  ))}
                </div>
                <span className={`strength-label ${STRENGTH_CLASSES[strength]}`}>
                  {STRENGTH_LABELS[strength]}
                </span>
                <ul className="strength-checklist">
                  <li className={newPassword.length >= 8 ? 'rule-pass' : 'rule-fail'}>
                    {newPassword.length >= 8 ? <Check size={11} /> : <X size={11} />}
                    Tối thiểu 8 ký tự
                  </li>
                  <li className={/[A-Z]/.test(newPassword) ? 'rule-pass' : 'rule-fail'}>
                    {/[A-Z]/.test(newPassword) ? <Check size={11} /> : <X size={11} />}
                    Ít nhất 1 chữ hoa (A–Z)
                  </li>
                  <li className={/[0-9]/.test(newPassword) ? 'rule-pass' : 'rule-fail'}>
                    {/[0-9]/.test(newPassword) ? <Check size={11} /> : <X size={11} />}
                    Ít nhất 1 chữ số (0–9)
                  </li>
                  <li className={/[^a-zA-Z0-9]/.test(newPassword) ? 'rule-pass' : 'rule-fail'}>
                    {/[^a-zA-Z0-9]/.test(newPassword) ? <Check size={11} /> : <X size={11} />}
                    Ít nhất 1 ký tự đặc biệt (!@#$...)
                  </li>
                </ul>
              </div>
            )}
          </div>

          {/* Xác nhận mật khẩu */}
          <div className="form-group">
            <label>XÁC NHẬN MẬT KHẨU <span style={{ color: 'var(--red-500)' }}>*</span></label>
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
            {confirmPassword && newPassword !== confirmPassword && (
              <div className="status-error" style={{ marginTop: '6px' }}>
                <AlertCircle size={13} />
                <span>Mật khẩu xác nhận chưa trùng khớp.</span>
              </div>
            )}
          </div>

          {/* Email — Tùy chọn */}
          <div className="form-group">
            <label>
              EMAIL NHẬN CẢNH BÁO
              <span className="optional-tag"> (Tùy chọn)</span>
            </label>
            <div className="input-wrapper">
              <span className="input-icon"><Mail size={16} /></span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Để trống nếu không muốn thay đổi"
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
                    <a href="https://t.me/ics_guard_alert_bot" target="_blank" rel="noreferrer">
                      @ics_guard_alert_bot
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

            {/* Bước 2: Nhập OTP + nút Xác nhận */}
            {otpSent && !otpVerified && (
              <div className="otp-input-row">
                <div className="otp-hint">
                  <span>Kiểm tra Telegram, nhập mã 6 số bên dưới:</span>
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

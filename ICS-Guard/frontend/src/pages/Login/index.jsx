import './Login.scss';
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import authApi from '@/api/auth';
import { Lock, User } from 'lucide-react';
import VInput from '@/components/common/VInput/VInput';
import VButton from '@/components/common/VButton/VButton';
import { toast } from '@/utils/toast';

const Login = ({ isAttacker = false }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ username_or_email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  useEffect(() => {
    const savedData = localStorage.getItem('remembered_account');
    if (savedData) {
      try {
        const { username, expires } = JSON.parse(savedData);
        if (Date.now() < expires) {
          setFormData(prev => ({ ...prev, username_or_email: username }));
          setRememberMe(true);
        } else {
          localStorage.removeItem('remembered_account');
        }
      } catch (e) {
        localStorage.removeItem('remembered_account');
      }
    }

    if (!isAttacker) {
      const hasGoogleConfig = !!import.meta.env.VITE_GOOGLE_CLIENT_ID && !!import.meta.env.VITE_GOOGLE_GSI_CLIENT_URL;
      
      if (!hasGoogleConfig) return;

      const renderGoogleButton = () => {
        if (window.google) {
          window.google.accounts.id.initialize({
            client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
            callback: handleGoogleCallback
          });
          const container = document.getElementById('googleSignInDiv');
          if (container) {
            const width = container.offsetWidth || 384;
            window.google.accounts.id.renderButton(
              container,
              { theme: 'outline', size: 'large', width: width, logo_alignment: 'center' }
            );
          }
        }
      };

      const loadGsiScript = () => {
        if (document.getElementById('google-jssdk')) {
          renderGoogleButton();
          return;
        }
        const script = document.createElement('script');
        script.id = 'google-jssdk';
        script.src = import.meta.env.VITE_GOOGLE_GSI_CLIENT_URL;
        script.async = true;
        script.defer = true;
        script.onload = renderGoogleButton;
        document.body.appendChild(script);
      };
      loadGsiScript();
    }
  }, [isAttacker]);

  const handleGoogleCallback = async (response) => {
    try {
      setLoading(true);
      const res = await authApi.loginGoogle({ idToken: response.credential });
      if (res && res.access_token) {
        localStorage.setItem('access_token', res.access_token);
        localStorage.setItem('refresh_token', res.refresh_token);
        toast.success('Đăng nhập thành công');
        navigate('/', { replace: true });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Đăng nhập Google thất bại');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await authApi.login(formData);
      if (response && response.access_token) {
        if (rememberMe) {
          const expires = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days in ms
          localStorage.setItem('remembered_account', JSON.stringify({
            username: formData.username_or_email,
            expires
          }));
        } else {
          localStorage.removeItem('remembered_account');
        }

        toast.success('Đăng nhập thành công');
        if (isAttacker) {
          localStorage.setItem('attacker_access_token', response.access_token);
          localStorage.setItem('attacker_refresh_token', response.refresh_token);
          navigate('/attacker', { replace: true });
        } else {
          localStorage.setItem('access_token', response.access_token);
          localStorage.setItem('refresh_token', response.refresh_token);
          navigate('/', { replace: true });
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-form-card">
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '8px' }}>Chào mừng</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Điền thông tin để đăng nhập tài khoản</p>
      </div>

      <form onSubmit={handleSubmit}>
        <VInput
          id="username"
          name="username_or_email"
          label="Tên đăng nhập hoặc Email"
          placeholder="Nhập tên đăng nhập hoặc email"
          icon={User}
          value={formData.username_or_email}
          onChange={(e) => setFormData({...formData, username_or_email: e.target.value})}
          required
        />

        <VInput
          id="password"
          name="password"
          type="password"
          label="Mật khẩu"
          placeholder="Nhập mật khẩu"
          icon={Lock}
          value={formData.password}
          onChange={(e) => setFormData({...formData, password: e.target.value})}
          required
        />

        <div className="auth-form-options">
          <label className="checkbox-container">
            <input 
              type="checkbox" 
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            <span>Ghi nhớ tài khoản</span>
          </label>
        </div>

        <div className="auth-form-actions">
          <VButton 
            type="submit" 
            variant="primary" 
            fullWidth 
            loading={loading}
          >
            Đăng Nhập
          </VButton>
        </div>
      </form>

      {!isAttacker && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0' }}>
            <hr style={{ flex: 1, borderTop: '1px solid #e0e0e0' }} />
            <span style={{ padding: '0 10px', color: '#888', fontSize: '14px' }}>Hoặc</span>
            <hr style={{ flex: 1, borderTop: '1px solid #e0e0e0' }} />
          </div>
          {!!import.meta.env.VITE_GOOGLE_CLIENT_ID && !!import.meta.env.VITE_GOOGLE_GSI_CLIENT_URL ? (
            <div id="googleSignInDiv" style={{ width: '100%', marginBottom: '20px' }}></div>
          ) : (
            <div style={{ marginBottom: '20px' }}>
              <VButton 
                type="button" 
                variant="outline" 
                fullWidth 
                onClick={() => toast.info('Vui lòng thêm VITE_GOOGLE_CLIENT_ID và VITE_GOOGLE_GSI_CLIENT_URL vào file .env')}
                style={{ 
                  backgroundColor: 'white', 
                  color: '#3c4043', 
                  border: '1px solid #dadce0',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px'
                }}
              >
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" style={{ width: '18px', height: '18px' }} />
                Đăng nhập bằng Google
              </VButton>
            </div>
          )}
          <div className="auth-form-footer">
            Chưa có tài khoản?{' '}
            <Link to="/register" className="auth-link">
              Đăng ký ngay
            </Link>
          </div>
        </>
      )}
    </div>
  );
};

export default Login;

import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import authApi from '@/api/auth';
import { Lock, User } from 'lucide-react';
import VInput from '@/components/common/VInput/VInput';
import VButton from '@/components/common/VButton/VButton';
import './AuthForms.scss';

const Login = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ username_or_email: '', password: '' });
  const [error, setError] = useState('');
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
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
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

        localStorage.setItem('access_token', response.access_token);
        localStorage.setItem('refresh_token', response.refresh_token);
        navigate('/', { replace: true });
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-form-card">
      {error && (
        <div className="auth-error-alert">
          {error}
        </div>
      )}

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

      <div className="auth-form-footer">
        Chưa có tài khoản?{' '}
        <Link to="/register" className="auth-link">
          Đăng ký ngay
        </Link>
      </div>
    </div>
  );
};

export default Login;

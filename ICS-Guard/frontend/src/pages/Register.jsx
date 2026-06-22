import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import authApi from '@/api/auth';
import { Lock, User, Mail } from 'lucide-react';
import VInput from '@/components/common/VInput/VInput';
import VButton from '@/components/common/VButton/VButton';
import './AuthForms.scss';

const Register = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ 
    username: '', 
    email: '', 
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Mật khẩu không khớp');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        username: formData.username,
        email: formData.email,
        password: formData.password
      };
      
      await authApi.register(payload);
      // Automatically navigate to login page after successful registration
      navigate('/login', { state: { message: 'Đăng ký thành công! Vui lòng đăng nhập.' } });
    } catch (err) {
      setError(err.response?.data?.message || 'Đăng ký thất bại. Vui lòng thử lại.');
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
          name="username"
          label="Tên đăng nhập"
          placeholder="admin123"
          icon={User}
          value={formData.username}
          onChange={(e) => setFormData({...formData, username: e.target.value})}
          required
        />

        <VInput
          id="email"
          name="email"
          type="email"
          label="Địa chỉ Email"
          placeholder="admin@example.com"
          icon={Mail}
          value={formData.email}
          onChange={(e) => setFormData({...formData, email: e.target.value})}
          required
        />

        <VInput
          id="password"
          name="password"
          type="password"
          label="Mật khẩu"
          placeholder="••••••••"
          icon={Lock}
          value={formData.password}
          onChange={(e) => setFormData({...formData, password: e.target.value})}
          required
        />

        <VInput
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          label="Xác nhận mật khẩu"
          placeholder="••••••••"
          icon={Lock}
          value={formData.confirmPassword}
          onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
          error={formData.confirmPassword && formData.password !== formData.confirmPassword ? "Mật khẩu không khớp" : ""}
          required
        />

        <div className="auth-form-actions">
          <VButton 
            type="submit" 
            variant="primary" 
            fullWidth 
            loading={loading}
          >
            Đăng Ký
          </VButton>
        </div>
      </form>

      <div className="auth-form-footer">
        Đã có tài khoản?{' '}
        <Link to="/login" className="auth-link">
          Đăng Nhập
        </Link>
      </div>
    </div>
  );
};

export default Register;

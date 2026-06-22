import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import './VInput.scss';

const VInput = ({
  id,
  name,
  type = 'text',
  label,
  value,
  onChange,
  placeholder,
  error,
  icon: Icon,
  disabled = false,
  required = false,
  className = '',
  ...rest
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className={`v-input-wrapper ${className}`}>
      {label && (
        <label htmlFor={id || name} className="v-input-label">
          {label}
        </label>
      )}
      <div className="v-input-container">
        {Icon && (
          <div className="v-input-icon">
            <Icon className="icon-svg" />
          </div>
        )}
        <input
          id={id || name}
          name={name}
          type={inputType}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          className={`v-input-field ${Icon ? 'has-icon' : ''} ${isPassword ? 'has-password-toggle' : ''} ${error ? 'has-error' : ''}`}
          {...rest}
        />
        {isPassword && (
          <button
            type="button"
            className="v-input-toggle-password"
            onClick={togglePasswordVisibility}
            tabIndex="-1"
            title={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
          >
            {showPassword ? <EyeOff className="icon-svg" /> : <Eye className="icon-svg" />}
          </button>
        )}
      </div>
      {error && <span className="v-input-error-msg">{error}</span>}
    </div>
  );
};

export default VInput;

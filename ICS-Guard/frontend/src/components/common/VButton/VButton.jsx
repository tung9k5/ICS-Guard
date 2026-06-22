import React from 'react';
import './VButton.scss';

const VButton = ({
  children,
  type = 'button',
  variant = 'primary', // primary, secondary, danger, outline
  size = 'md', // sm, md, lg
  disabled = false,
  loading = false,
  fullWidth = false,
  icon: Icon,
  onClick,
  className = '',
  ...rest
}) => {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={`v-btn btn-${variant} v-btn--${size} ${fullWidth ? 'v-btn--full' : ''} ${loading ? 'v-btn--loading' : ''} ${className}`}
      {...rest}
    >
      {loading && (
        <svg className="v-btn-spinner" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="spinner-track" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="spinner-head" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      )}
      {!loading && Icon && <Icon className="v-btn-icon" />}
      <span className="v-btn-content">{children}</span>
    </button>
  );
};

export default VButton;

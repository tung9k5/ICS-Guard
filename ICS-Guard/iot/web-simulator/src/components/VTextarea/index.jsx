import React from 'react';
import './VTextarea.scss';

const VTextarea = ({
  id,
  name,
  label,
  value,
  onChange,
  placeholder,
  error,
  disabled = false,
  required = false,
  className = '',
  rows = 4,
  ...rest
}) => {
  return (
    <div className={`v-textarea-wrapper ${className}`}>
      {label && (
        <label htmlFor={id || name} className="v-textarea-label">
          {label}
        </label>
      )}
      <div className="v-textarea-container">
        <textarea
          id={id || name}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          rows={rows}
          className={`v-textarea-field ${error ? 'has-error' : ''}`}
          {...rest}
        />
      </div>
      {error && <span className="v-textarea-error-msg">{error}</span>}
    </div>
  );
};

export default VTextarea;

import React from 'react';
import './VStatus.scss';

const VStatus = ({ status, label, className = '', showDot = false, style = {} }) => {
  let variantClass = 'v-status-neutral';
  let dotClass = 'dot-neutral';

  // If a custom inline style is provided that overrides background/color, we might not need the variant class
  // but we still apply it for base styling.
  switch (status?.toLowerCase()) {
    case 'active':
    case 'success':
    case 'hoạt động':
      variantClass = 'v-status-success';
      dotClass = 'dot-success';
      break;
    case 'inactive':
    case 'danger':
    case 'vô hiệu hóa':
    case 'error':
      variantClass = 'v-status-danger';
      dotClass = 'dot-danger';
      break;
    case 'warning':
    case 'pending':
      variantClass = 'v-status-warning';
      dotClass = 'dot-warning';
      break;
    default:
      variantClass = 'v-status-neutral';
      dotClass = 'dot-neutral';
      break;
  }

  return (
    <span className={`v-status ${variantClass} ${className}`} style={style}>
      {showDot && <span className={`status-dot ${dotClass}`}></span>}
      {label || status}
    </span>
  );
};

export default VStatus;

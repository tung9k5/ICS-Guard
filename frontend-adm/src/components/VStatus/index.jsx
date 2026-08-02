import React from 'react';
import { useTranslation } from 'react-i18next';
import { getStatusConfig, getSeverityConfig, getGenericConfig } from '@/utils/statusMapper';
import './VStatus.scss';
import * as LucideIcons from 'lucide-react';

const VStatus = ({ status, label, type = 'status', className = '', showDot = false, showIcon = false, style = {} }) => {
  const { t } = useTranslation();
  
  let config = {};
  if (type === 'severity') {
    config = getSeverityConfig(status);
  } else if (type === 'status') {
    config = getStatusConfig(status);
  } else {
    config = getGenericConfig(status, type);
  }

  const labelText = label || t(config.label, config.labelFallback || status);
  const IconComponent = showIcon && config.icon ? LucideIcons[config.icon] : null;

  return (
    <span 
      className={`v-status v-status-${config.variant} ${className}`} 
      style={{
        ...style,
        backgroundColor: config.background,
        color: config.textColor,
        borderColor: config.color
      }}
    >
      {showIcon && IconComponent && <IconComponent size={14} style={{ marginRight: '0.2857rem' }} />}
      {showDot && <span className={`status-dot dot-${config.variant}`} style={{ backgroundColor: config.color }}></span>}
      {labelText}
    </span>
  );
};

export default VStatus;

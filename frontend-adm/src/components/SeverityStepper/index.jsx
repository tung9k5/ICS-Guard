import React from 'react';
import { Eye, TrendingUp, AlertTriangle, ShieldAlert } from 'lucide-react';

const SeverityStepper = ({ severity, t, compact = false }) => {
  const levels = ['low', 'medium', 'high', 'critical'];
  const labels = [
    t('severity.stepper.low', 'Thấp'),
    t('severity.stepper.medium', 'Trung bình'),
    t('severity.stepper.high', 'Cao'),
    t('severity.stepper.critical', 'Nghiêm trọng')
  ];
  const icons = [Eye, TrendingUp, AlertTriangle, ShieldAlert];
  
  const currentIdx = levels.indexOf(severity?.toLowerCase());
  
  // Sizes based on compact mode
  const circleSize = compact ? '24px' : '36px';
  const iconSize = compact ? 12 : 18;
  const fontSize = compact ? '0.65rem' : '0.75rem';
  const minWidth = compact ? '45px' : '70px';
  const margin = compact ? '0 1rem' : '1rem 0';
  const gap = compact ? '0.25rem' : '0.5rem';
  const marginTop = compact ? '-16px' : '-22px';
  
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: margin, width: compact ? 'auto' : '100%', padding: compact ? '0' : '0 10px', flex: compact ? 1 : 'unset' }}>
      {levels.map((lvl, idx) => {
        const isActive = idx <= currentIdx;
        const color = isActive ? 'var(--danger-color, #ef4444)' : '#cbd5e1'; // Active Red vs Inactive Grey
        const Icon = icons[idx];
        return (
          <React.Fragment key={lvl}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: gap, zIndex: 1, minWidth: minWidth }}>
              <div style={{
                width: circleSize, height: circleSize, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: `1.5px solid ${color}`,
                backgroundColor: isActive ? '#fef2f2' : '#f8fafc',
                color: color
              }}>
                <Icon size={iconSize} />
              </div>
              <span style={{ fontSize: fontSize, fontWeight: isActive ? 600 : 500, color: color, textAlign: 'center', whiteSpace: 'nowrap' }}>
                {labels[idx]}
              </span>
            </div>
            {idx < levels.length - 1 && (
              <div style={{ 
                flex: 1, 
                height: '1px', 
                borderTop: `1.5px dashed ${idx < currentIdx ? 'var(--danger-color, #ef4444)' : '#cbd5e1'}`, 
                marginTop: marginTop,
                minWidth: compact ? '15px' : '20px'
              }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default SeverityStepper;

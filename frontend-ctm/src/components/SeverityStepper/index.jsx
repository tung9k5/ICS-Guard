import React from 'react';

const SeverityStepper = ({ severity, t, compact = false }) => {
  const levels = ['low', 'medium', 'high', 'critical'];
  const labels = [
    t('severity.stepper.low', 'Thấp'),
    t('severity.stepper.medium', 'Trung bình'),
    t('severity.stepper.high', 'Cao'),
    t('severity.stepper.critical', 'Nghiêm trọng')
  ];
  
  const currentIdx = levels.indexOf(severity?.toLowerCase());
  const activeLabel = currentIdx >= 0 ? labels[currentIdx] : labels[0];
  
  // Sizes based on compact mode
  const containerWidth = compact ? '160px' : '100%';
  const barHeight = compact ? '8px' : '12px';
  const fontSize = compact ? '0.85rem' : '1.05rem';
  const margin = compact ? '0' : '1rem 0';
  
  // Use system primary color to maintain UI consistency
  const activeColor = 'var(--blue-500, #3b82f6)';
  
  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: '12px', 
      width: containerWidth, 
      margin: margin,
      flex: compact ? 1 : 'unset',
      justifyContent: compact ? 'flex-start' : 'center'
    }}>
      <span style={{ 
        fontSize: fontSize, 
        fontWeight: 600, 
        color: activeColor, 
        width: compact ? '85px' : '110px',
        flexShrink: 0,
        textAlign: 'left'
      }}>
        {activeLabel}
      </span>
      <div style={{ display: 'flex', gap: '4px', flex: 1, maxWidth: compact ? 'unset' : '300px', alignItems: 'center' }}>
        {levels.map((lvl, idx) => {
          const isActive = idx <= currentIdx;
          const bg = isActive ? activeColor : '#e2e8f0';
          return (
            <div 
              key={lvl} 
              style={{ 
                flex: 1, 
                height: barHeight, 
                backgroundColor: bg, 
                borderRadius: '4px',
                transition: 'background-color 0.3s ease',
                boxShadow: isActive ? `0 0 6px rgba(59, 130, 246, 0.4)` : 'none',
                opacity: isActive ? 1 : 0.8
              }} 
            />
          );
        })}
        <span style={{ 
          fontSize: compact ? '0.75rem' : '0.85rem', 
          color: activeColor,
          fontWeight: 700,
          marginLeft: '8px',
          minWidth: '35px'
        }}>
          {(currentIdx + 1) * 25}%
        </span>
      </div>
    </div>
  );
};

export default SeverityStepper;

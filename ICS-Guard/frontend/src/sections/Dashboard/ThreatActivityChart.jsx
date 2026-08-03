import React from 'react';
import { useTranslation } from 'react-i18next';

const ThreatActivityChart = ({ rawData = [] }) => {
  const { t } = useTranslation();

  if (!Array.isArray(rawData) || rawData.length === 0) {
    return <div className="chart-empty-state">Không có sự cố trong 7 ngày qua</div>;
  }

  const hours = Array.from({length: 24}, (_, i) => i);
  // Rearrange days to start from Monday to Sunday for better UX, but let's stick to Sun-Sat (0-6)
  const days = [0, 1, 2, 3, 4, 5, 6];
  const maxCount = Math.max(...rawData.map(d => d.count), 1);
  
  const getColor = (count) => {
    if (count === 0) return 'var(--gray-800)';
    const intensity = count / maxCount;
    if (intensity < 0.2) return '#7f1d1d'; // dark red
    if (intensity < 0.5) return '#b91c1c'; // medium red
    if (intensity < 0.8) return '#ef4444'; // red
    return '#f87171'; // bright red
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', minHeight: '300px', overflowX: 'auto', paddingBottom: '10px' }}>
      <div style={{ display: 'flex', marginBottom: '8px' }}>
        <div style={{ width: '40px' }}></div>
        {hours.map(h => (
          <div key={h} style={{ flex: 1, textAlign: 'center', fontSize: '11px', color: 'var(--gray-400)' }}>{h}h</div>
        ))}
      </div>
      {days.map(d => {
        const dayLabel = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d];
        return (
          <div key={d} style={{ display: 'flex', marginBottom: '6px' }}>
            <div style={{ width: '40px', fontSize: '12px', color: 'var(--gray-400)', display: 'flex', alignItems: 'center' }}>{dayLabel}</div>
            {hours.map(h => {
              const cellData = rawData.find(x => x.dayIndex === d && x.hour === h) || { count: 0 };
              return (
                <div 
                  key={h} 
                  title={`${dayLabel} ${h}:00 - ${cellData.count} incidents`}
                  style={{ 
                    flex: 1, 
                    margin: '0 2px', 
                    backgroundColor: getColor(cellData.count), 
                    borderRadius: '4px', 
                    height: '32px',
                    transition: 'all 0.2s ease',
                    cursor: 'pointer',
                    boxShadow: cellData.count > 0 ? '0 0 5px rgba(239, 68, 68, 0.2)' : 'none'
                  }}
                  onMouseOver={(e) => e.target.style.transform = 'scale(1.15)'}
                  onMouseOut={(e) => e.target.style.transform = 'scale(1)'}
                />
              )
            })}
          </div>
        );
      })}
      
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px', fontSize: '11px', color: 'var(--gray-400)', alignItems: 'center', gap: '8px' }}>
        <span>Ít tấn công</span>
        <div style={{ width: '12px', height: '12px', background: 'var(--gray-800)', borderRadius: '2px' }}></div>
        <div style={{ width: '12px', height: '12px', background: '#7f1d1d', borderRadius: '2px' }}></div>
        <div style={{ width: '12px', height: '12px', background: '#b91c1c', borderRadius: '2px' }}></div>
        <div style={{ width: '12px', height: '12px', background: '#ef4444', borderRadius: '2px' }}></div>
        <div style={{ width: '12px', height: '12px', background: '#f87171', borderRadius: '2px' }}></div>
        <span>Nhiều tấn công</span>
      </div>
    </div>
  );
};

export default ThreatActivityChart;

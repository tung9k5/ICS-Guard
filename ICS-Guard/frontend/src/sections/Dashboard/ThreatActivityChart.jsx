import React from 'react';
import { useTranslation } from 'react-i18next';

const ThreatActivityChart = ({ rawData = [] }) => {
  const { t } = useTranslation();

  if (!Array.isArray(rawData) || rawData.length === 0) {
    return <div className="chart-empty-state">Không có sự cố trong 7 ngày qua</div>;
  }

  const hours = Array.from({length: 24}, (_, i) => i);
  const days = [0, 1, 2, 3, 4, 5, 6];
  const maxCount = Math.max(...rawData.map(d => d.count), 1);
  
  const getColor = (count) => {
    if (count === 0) return 'var(--surface-secondary, #131d33)';
    const intensity = count / maxCount;
    if (intensity < 0.25) return 'rgba(239, 68, 68, 0.25)';
    if (intensity < 0.5) return 'rgba(239, 68, 68, 0.5)';
    if (intensity < 0.75) return 'rgba(239, 68, 68, 0.75)';
    return 'var(--severity-critical, #ef4444)';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', minHeight: '220px', overflowX: 'auto', paddingBottom: '6px' }}>
      <div style={{ display: 'flex', marginBottom: '6px' }}>
        <div style={{ width: '36px' }}></div>
        {hours.map(h => (
          <div key={h} style={{ flex: 1, textAlign: 'center', fontSize: '10px', color: 'var(--text-muted, #94a3b8)', fontFamily: "'JetBrains Mono', monospace" }}>{h}</div>
        ))}
      </div>
      {days.map(d => {
        const dayLabel = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d];
        return (
          <div key={d} style={{ display: 'flex', marginBottom: '4px' }}>
            <div style={{ width: '36px', fontSize: '11px', color: 'var(--text-muted, #94a3b8)', display: 'flex', alignItems: 'center', fontWeight: 600 }}>{dayLabel}</div>
            {hours.map(h => {
              const cellData = rawData.find(x => x.dayIndex === d && x.hour === h) || { count: 0 };
              return (
                <div 
                  key={h} 
                  title={`${dayLabel} ${h}:00 — ${cellData.count} incidents`}
                  style={{ 
                    flex: 1, 
                    margin: '0 1px', 
                    backgroundColor: getColor(cellData.count), 
                    borderRadius: '3px', 
                    height: '24px',
                    transition: 'all 0.15s ease-out',
                    cursor: 'pointer',
                    border: '1px solid var(--border-subtle, #1e293b)'
                  }}
                />
              );
            })}
          </div>
        );
      })}
      
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px', fontSize: '11px', color: 'var(--text-muted, #94a3b8)', alignItems: 'center', gap: '6px' }}>
        <span>Thấp</span>
        <div style={{ width: '10px', height: '10px', background: 'var(--surface-secondary, #131d33)', borderRadius: '2px', border: '1px solid var(--border-subtle)' }}></div>
        <div style={{ width: '10px', height: '10px', background: 'rgba(239, 68, 68, 0.25)', borderRadius: '2px' }}></div>
        <div style={{ width: '10px', height: '10px', background: 'rgba(239, 68, 68, 0.5)', borderRadius: '2px' }}></div>
        <div style={{ width: '10px', height: '10px', background: 'var(--severity-critical, #ef4444)', borderRadius: '2px' }}></div>
        <span>Cao</span>
      </div>
    </div>
  );
};

export default ThreatActivityChart;

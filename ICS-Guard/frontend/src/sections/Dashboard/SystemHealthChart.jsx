import React from 'react';
import { useTranslation } from 'react-i18next';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const SYSTEM_HEALTH_COLORS = ['#10b981', '#38bdf8', '#f59e0b'];

const SystemHealthChart = ({ rawData = [] }) => {
  const { t } = useTranslation();

  const total = Array.isArray(rawData) ? rawData.reduce((sum, item) => sum + Number(item.value || 0), 0) : 0;
  if (!Array.isArray(rawData) || rawData.length === 0 || total === 0) {
    return <div className="chart-empty-state">Chưa có dữ liệu tình trạng hệ thống</div>;
  }

  const data = rawData.map(item => ({
    ...item,
    name: t(`dashboard.health.${item.key}`, item.key)
  }));

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '220px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={3}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={SYSTEM_HEALTH_COLORS[index % SYSTEM_HEALTH_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'var(--surface-elevated, #1e293b)', 
              border: '1px solid var(--border-strong, #3b4d6b)', 
              borderRadius: '6px', 
              color: 'var(--text-primary, #f8fafc)',
              fontSize: '12px',
              fontFamily: "'JetBrains Mono', monospace"
            }}
            itemStyle={{ color: 'var(--text-primary, #f8fafc)' }}
          />
          <Legend verticalAlign="bottom" height={32} wrapperStyle={{ fontSize: '12px', color: 'var(--text-muted, #94a3b8)' }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SystemHealthChart;

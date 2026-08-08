import React from 'react';
import { useTranslation } from 'react-i18next';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const SYSTEM_HEALTH_COLORS = ['#22c55e', '#f97316', '#8b5cf6'];

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
    <div style={{ width: '100%', height: '100%', minHeight: '300px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={80}
            outerRadius={100}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={SYSTEM_HEALTH_COLORS[index % SYSTEM_HEALTH_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{ backgroundColor: 'var(--gray-800)', border: 'none', borderRadius: '8px', color: 'var(--white-short)' }}
            itemStyle={{ color: 'var(--white-short)' }}
          />
          <Legend verticalAlign="bottom" height={36} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SystemHealthChart;

import React from 'react';
import { useTranslation } from 'react-i18next';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const COLORS = ['var(--green-500)', 'var(--amber-500)', 'var(--red-500)'];

const SystemHealthChart = ({ rawData = [] }) => {
  const { t } = useTranslation();

  const data = rawData.map(item => ({
    ...item,
    name: t(`dashboard.health.${item.key}`, item.key)
  }));

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '21.4286rem' }}>
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
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{ backgroundColor: 'var(--gray-800)', border: 'none', borderRadius: '0.5714rem', color: 'var(--white-short)' }}
            itemStyle={{ color: 'var(--white-short)' }}
          />
          <Legend verticalAlign="bottom" height={36} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SystemHealthChart;

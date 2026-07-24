import React from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const ThreatActivityChart = ({ rawData = [] }) => {
  const { t } = useTranslation();

  const data = rawData.map(item => ({
    ...item,
    name: t(`dashboard.days.${item.key}`, item.key)
  }));

  const maxVal = data.reduce((max, item) => Math.max(max, (item.low || 0) + (item.medium || 0) + (item.high || 0)), 0);

  const roundedMax = Math.max(Math.ceil(maxVal / 500) * 500, 1000);
  const tickCount = 6;

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '21.4286rem' }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--gray-700)" />
          <XAxis dataKey="name" stroke="var(--gray-400)" tickLine={false} />
          <YAxis 
            stroke="var(--gray-400)" 
            tickLine={false} 
            axisLine={false} 
            domain={[0, roundedMax]}
            tickCount={tickCount}
          />
          <Tooltip 
            cursor={{ fill: 'var(--gray-700)', opacity: 0.4 }}
            contentStyle={{ backgroundColor: 'var(--gray-800)', border: 'none', borderRadius: '0.5714rem', color: 'var(--white-short)' }}
          />
          <Legend wrapperStyle={{ paddingTop: '1.4286rem' }} />
          <Bar dataKey="low" name={t('dashboard.threat_level.low', 'Thấp')} stackId="a" fill="var(--green-500)" radius={[0, 0, 4, 4]} />
          <Bar dataKey="medium" name={t('dashboard.threat_level.medium', 'Trung bình')} stackId="a" fill="var(--amber-500)" />
          <Bar dataKey="high" name={t('dashboard.threat_level.high', 'Cao')} stackId="a" fill="var(--red-500)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ThreatActivityChart;

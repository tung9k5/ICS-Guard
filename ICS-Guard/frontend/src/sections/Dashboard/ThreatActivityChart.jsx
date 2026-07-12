import React from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const rawData = [
  { key: 'mon', high: 4, medium: 12, low: 24 },
  { key: 'tue', high: 3, medium: 8, low: 30 },
  { key: 'wed', high: 7, medium: 15, low: 18 },
  { key: 'thu', high: 2, medium: 10, low: 35 },
  { key: 'fri', high: 5, medium: 20, low: 22 },
  { key: 'sat', high: 1, medium: 5, low: 12 },
  { key: 'sun', high: 2, medium: 7, low: 15 },
];

const ThreatActivityChart = () => {
  const { t } = useTranslation();

  const data = rawData.map(item => ({
    ...item,
    name: t(`dashboard.days.${item.key}`, item.key)
  }));

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '300px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--gray-700)" />
          <XAxis dataKey="name" stroke="var(--gray-400)" tickLine={false} />
          <YAxis stroke="var(--gray-400)" tickLine={false} axisLine={false} />
          <Tooltip 
            cursor={{ fill: 'var(--gray-700)', opacity: 0.4 }}
            contentStyle={{ backgroundColor: 'var(--gray-800)', border: 'none', borderRadius: '8px', color: 'var(--white-short)' }}
          />
          <Legend wrapperStyle={{ paddingTop: '20px' }} />
          <Bar dataKey="low" name="Low" stackId="a" fill="var(--green-500)" radius={[0, 0, 4, 4]} />
          <Bar dataKey="medium" name="Medium" stackId="a" fill="var(--amber-500)" />
          <Bar dataKey="high" name="High" stackId="a" fill="var(--red-500)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ThreatActivityChart;

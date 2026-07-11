import React from 'react';
import { useTranslation } from 'react-i18next';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const data = [
  { time: '00:00', incoming: 4000, outgoing: 2400 },
  { time: '04:00', incoming: 3000, outgoing: 1398 },
  { time: '08:00', incoming: 2000, outgoing: 9800 },
  { time: '12:00', incoming: 2780, outgoing: 3908 },
  { time: '16:00', incoming: 1890, outgoing: 4800 },
  { time: '20:00', incoming: 2390, outgoing: 3800 },
  { time: '24:00', incoming: 3490, outgoing: 4300 },
];

const NetworkTrafficChart = () => {
  const { t } = useTranslation();

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '300px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorIncoming" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--blue-500)" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="var(--blue-500)" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorOutgoing" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--green-500)" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="var(--green-500)" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--gray-700)" />
          <XAxis dataKey="time" stroke="var(--gray-400)" tickLine={false} />
          <YAxis stroke="var(--gray-400)" tickLine={false} axisLine={false} />
          <Tooltip 
            contentStyle={{ backgroundColor: 'var(--gray-800)', border: 'none', borderRadius: '8px', color: 'var(--white-short)' }}
            itemStyle={{ color: 'var(--white-short)' }}
          />
          <Area type="monotone" name={t('dashboard.traffic.incoming', 'Incoming')} dataKey="incoming" stroke="var(--blue-500)" fillOpacity={1} fill="url(#colorIncoming)" />
          <Area type="monotone" name={t('dashboard.traffic.outgoing', 'Outgoing')} dataKey="outgoing" stroke="var(--green-500)" fillOpacity={1} fill="url(#colorOutgoing)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default NetworkTrafficChart;

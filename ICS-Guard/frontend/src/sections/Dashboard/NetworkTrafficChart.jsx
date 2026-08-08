import React from 'react';
import { useTranslation } from 'react-i18next';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const NETWORK_TRAFFIC_COLORS = {
  incoming: '#38bdf8',
  outgoing: '#f97316',
};

const NetworkTrafficChart = ({ data = [] }) => {
  const { t } = useTranslation();

  if (!Array.isArray(data) || data.length === 0) {
    return <div className="chart-empty-state">Chưa có dữ liệu lưu lượng mạng</div>;
  }

  const maxVal = data.reduce((max, item) => Math.max(max, item.incoming || 0, item.outgoing || 0), 0);
  const interval = maxVal >= 10000 ? 2000 : 1000;
  const roundedMax = Math.max(Math.ceil(maxVal / interval) * interval, interval);
  const tickCount = (roundedMax / interval) + 1;

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '300px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorIncoming" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={NETWORK_TRAFFIC_COLORS.incoming} stopOpacity={0.8}/>
              <stop offset="95%" stopColor={NETWORK_TRAFFIC_COLORS.incoming} stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorOutgoing" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={NETWORK_TRAFFIC_COLORS.outgoing} stopOpacity={0.8}/>
              <stop offset="95%" stopColor={NETWORK_TRAFFIC_COLORS.outgoing} stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--gray-700)" />
          <XAxis dataKey="time" stroke="var(--gray-400)" tickLine={false} />
          <YAxis 
            stroke="var(--gray-400)" 
            tickLine={false} 
            axisLine={false} 
            domain={[0, roundedMax]}
            tickCount={tickCount}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: 'var(--gray-800)', border: 'none', borderRadius: '8px', color: 'var(--white-short)' }}
            itemStyle={{ color: 'var(--white-short)' }}
          />
          <Area type="monotone" name={t('dashboard.traffic.incoming', 'Incoming')} dataKey="incoming" stroke={NETWORK_TRAFFIC_COLORS.incoming} fillOpacity={1} fill="url(#colorIncoming)" />
          <Area type="monotone" name={t('dashboard.traffic.outgoing', 'Outgoing')} dataKey="outgoing" stroke={NETWORK_TRAFFIC_COLORS.outgoing} fillOpacity={1} fill="url(#colorOutgoing)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default NetworkTrafficChart;

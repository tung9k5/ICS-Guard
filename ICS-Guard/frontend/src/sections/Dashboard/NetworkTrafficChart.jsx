import React from 'react';
import { useTranslation } from 'react-i18next';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const NETWORK_TRAFFIC_COLORS = {
  incoming: '#38bdf8', // Accent Sky Blue
  outgoing: '#f97316', // High Orange
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
    <div style={{ width: '100%', height: '100%', minHeight: '260px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 10, right: 20, left: -10, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorIncoming" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={NETWORK_TRAFFIC_COLORS.incoming} stopOpacity={0.4}/>
              <stop offset="95%" stopColor={NETWORK_TRAFFIC_COLORS.incoming} stopOpacity={0.02}/>
            </linearGradient>
            <linearGradient id="colorOutgoing" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={NETWORK_TRAFFIC_COLORS.outgoing} stopOpacity={0.4}/>
              <stop offset="95%" stopColor={NETWORK_TRAFFIC_COLORS.outgoing} stopOpacity={0.02}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle, #1e293b)" />
          <XAxis dataKey="time" stroke="var(--text-muted, #94a3b8)" tickLine={false} fontSize={11} />
          <YAxis 
            stroke="var(--text-muted, #94a3b8)" 
            tickLine={false} 
            axisLine={false} 
            fontSize={11}
            domain={[0, roundedMax]}
            tickCount={tickCount}
          />
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
          <Area type="monotone" name={t('dashboard.traffic.incoming', 'Incoming')} dataKey="incoming" stroke={NETWORK_TRAFFIC_COLORS.incoming} strokeWidth={2} fillOpacity={1} fill="url(#colorIncoming)" />
          <Area type="monotone" name={t('dashboard.traffic.outgoing', 'Outgoing')} dataKey="outgoing" stroke={NETWORK_TRAFFIC_COLORS.outgoing} strokeWidth={2} fillOpacity={1} fill="url(#colorOutgoing)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default NetworkTrafficChart;

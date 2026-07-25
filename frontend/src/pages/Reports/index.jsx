import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import VHeaderPage from '@/components/VHeaderPage';
import { toast } from '@/utils/toast';
import ApiReports from '@/api/reports';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell
} from 'recharts';
import { Activity, ShieldAlert, Server } from 'lucide-react';
import './Reports.scss';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

const Reports = () => {
  const { t } = useTranslation();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReport();
  }, []);

  const fetchReport = async () => {
    try {
      setLoading(true);
      const res = await ApiReports.getSummary();
      setSummary(res.data);
    } catch (error) {
      toast.error(t('reports.toasts.load_failed', 'Failed to load report summary'));
    } finally {
      setLoading(false);
    }
  };

  const formatPieData = (dataObj, prefix = '') => {
    if (!dataObj) return [];
    return Object.keys(dataObj).map(key => ({ 
      name: prefix ? t(`${prefix}.${key.toLowerCase()}`, key.charAt(0).toUpperCase() + key.slice(1).toLowerCase()) : key, 
      value: dataObj[key] 
    }));
  };

  return (
    <div className="reports-page">
      <VHeaderPage title={t('reports.page_title', 'System Reports & Analytics')} />
      
      <div className="reports-content">
        {loading ? (
          <div className="loading-state">{t('reports.loading', 'Loading analytics data...')}</div>
        ) : summary ? (
          <div className="dashboard-grid">
            
            {/* Overview Cards */}
            <div className="summary-cards">
              <div className="card stat-card">
                <div className="stat-icon server"><Server size={24} /></div>
                <div className="stat-details">
                  <span className="stat-label">{t('reports.total_devices', 'Total Devices')}</span>
                  <span className="stat-value">{summary.totalDevices || 0}</span>
                </div>
              </div>
              <div className="card stat-card">
                <div className="stat-icon alert"><Activity size={24} /></div>
                <div className="stat-details">
                  <span className="stat-label">{t('reports.total_alerts', 'Total Alerts')}</span>
                  <span className="stat-value">{summary.totalAlerts || 0}</span>
                </div>
              </div>
              <div className="card stat-card">
                <div className="stat-icon incident"><ShieldAlert size={24} /></div>
                <div className="stat-details">
                  <span className="stat-label">{t('reports.total_incidents', 'Total Incidents')}</span>
                  <span className="stat-value">{summary.totalIncidents || 0}</span>
                </div>
              </div>
            </div>

            {/* Trends Chart */}
            <div className="card trend-chart-container">
              <h3>{t('reports.trends_title', 'Alert & Incident Trends (Last 7 Days)')}</h3>
              <div className="chart-wrapper">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={summary.alertsTrend || []} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--slate-200)" />
                    <XAxis dataKey="date" stroke="var(--slate-500)" fontSize={12} />
                    <YAxis stroke="var(--slate-500)" fontSize={12} />
                    <RechartsTooltip 
                      contentStyle={{ 
                        backgroundColor: 'rgba(15, 23, 42, 0.9)', 
                        border: 'none', 
                        borderRadius: '8px',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                        color: '#f8fafc'
                      }}
                      itemStyle={{ color: '#e2e8f0', fontWeight: 500 }}
                      labelStyle={{ color: '#94a3b8', fontWeight: 600, marginBottom: '4px' }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="alerts" name={t('reports.alerts', 'Alerts')} stroke="#f59e0b" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="charts-row">
              {/* Severity Distribution */}
              <div className="card pie-chart-container">
                <h3>{t('reports.severity_distribution', 'Alert Severity Distribution')}</h3>
                <div className="chart-wrapper">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={formatPieData(summary.alertsBySeverity, 'reports.severity')}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={5}
                        dataKey="value"
                        label={false}
                      >
                        {formatPieData(summary.alertsBySeverity, 'reports.severity').map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip 
                        contentStyle={{ 
                          backgroundColor: 'rgba(15, 23, 42, 0.9)', 
                          border: 'none', 
                          borderRadius: '8px',
                          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                          color: '#f8fafc'
                        }}
                        itemStyle={{ color: '#e2e8f0', fontWeight: 500 }}
                      />
                      <Legend verticalAlign="bottom" height={36} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Status Distribution */}
              <div className="card bar-chart-container">
                <h3>{t('reports.incident_status', 'Incident Status')}</h3>
                <div className="chart-wrapper">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={formatPieData(summary.incidentsByStatus, 'reports.status')} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--slate-200)" />
                      <XAxis dataKey="name" stroke="var(--slate-500)" fontSize={12} />
                      <YAxis stroke="var(--slate-500)" fontSize={12} />
                      <RechartsTooltip 
                        cursor={{ fill: 'rgba(59, 130, 246, 0.08)' }}
                        contentStyle={{ 
                          backgroundColor: 'rgba(15, 23, 42, 0.9)', 
                          border: 'none', 
                          borderRadius: '8px',
                          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                          color: '#f8fafc'
                        }}
                        itemStyle={{ color: '#e2e8f0', fontWeight: 500 }}
                        labelStyle={{ color: '#94a3b8', fontWeight: 600, marginBottom: '4px' }}
                      />
                      <Bar dataKey="value" name={t('reports.incidents', 'Incidents')} radius={[4, 4, 0, 0]}>
                        {formatPieData(summary.incidentsByStatus, 'reports.status').map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

          </div>
        ) : (
          <div className="error-state">{t('reports.no_data', 'No data available to display reports.')}</div>
        )}
      </div>
    </div>
  );
};

export default Reports;

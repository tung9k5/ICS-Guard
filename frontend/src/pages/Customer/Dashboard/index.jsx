import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Server, Bell, ShieldAlert, TrendingUp, Activity, AlertTriangle, ArrowRight } from 'lucide-react';
import deviceApi from '@/api/device';
import alertsApi from '@/api/alerts';
import incidentsApi from '@/api/incidents';
import VHeaderPage from '@/components/VHeaderPage';
import VNodata from '@/components/VNodata';
import VButton from '@/components/VButton';
import Viewlogo from '@/components/Viewlogo';
import { formatDate } from '@/utils/formatDate';
import { useLoader } from '@/hooks/useLoader';
import '../../../pages/Dashboard/Dashboard.scss';

const StatCard = ({ icon: Icon, label, value, color = 'var(--blue-400)', loading }) => (
  <div className="stat-card-premium">
    <div className="icon-wrapper" style={{ color: color, borderColor: color ? `${color}40` : undefined }}>
      <Icon size={24} />
    </div>
    <div className="content-wrapper">
      <p className="label">{label}</p>
      <p className="value">
        {loading ? '...' : value}
      </p>
    </div>
  </div>
);

const CustomerDashboard = () => {
  const { t } = useTranslation();
  const [stats, setStats] = useState({ devices: 0, alerts: 0, incidents: 0, activeAlerts: 0 });
  const { isLoading: loading, hideLoading } = useLoader(true);
  const [recentAlerts, setRecentAlerts] = useState([]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [devRes, alertRes, incRes] = await Promise.allSettled([
          deviceApi.getAll({ limit: 1 }),
          alertsApi.getAllAlerts({ limit: 5 }),
          incidentsApi.getAll({ limit: 1 }),
        ]);

        const devices = devRes.status === 'fulfilled' ? (devRes.value?.total || devRes.value?.data?.length || 0) : 0;
        const alertData = alertRes.status === 'fulfilled' ? alertRes.value : null;
        const incidents = incRes.status === 'fulfilled' ? (incRes.value?.total || incRes.value?.data?.length || 0) : 0;

        setStats({
          devices,
          alerts: alertData?.total || alertData?.data?.length || 0,
          incidents,
          activeAlerts: (alertData?.data || []).filter(a => a.status === 'new' || a.status === 'acknowledged').length,
        });
        setRecentAlerts((alertData?.data || []).slice(0, 5));
      } catch (e) {
        console.error(e);
      } finally {
        hideLoading();
      }
    };
    fetchStats();
  }, []);

  const severityColor = { critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e' };

  return (
    <div className="assets-page">
      
      <div className="dashboard-container" style={{ minHeight: 'auto' }}>
        <div className="promo-banner" style={{ margin: 0, marginBottom: '32px' }}>
          <div className="promo-content">
            <div className="promo-text">
              <h2>{t('dashboard.banner.title', 'Bảo vệ hệ thống tối đa!')}</h2>
              <p>{t('dashboard.banner.subtitle', 'Giám sát liên tục 24/7, phát hiện sớm mọi rủi ro và ngăn chặn tấn công vào hạ tầng công nghiệp của bạn.')}</p>
            </div>
            <div className="promo-actions">
              <VButton variant="primary" className="btn-primary">
                {t('dashboard.banner.btn_upgrade', 'KÍCH HOẠT BẢO VỆ NÂNG CAO')}
              </VButton>
              <VButton variant="secondary" className="btn-secondary">
                {t('dashboard.banner.btn_report', 'KẾT NỐI HỆ THỐNG MỚI')}
                <ArrowRight size={16} />
              </VButton>
            </div>
          </div>

          <div className="promo-illustration">
            <div className="glow-effect"></div>
            <Viewlogo animate="spin" className="shield-icon" style={{ width: 'auto', maxHeight: '100%' }} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '16px' }}>
          <StatCard icon={Server} label={t('customer.dashboard.devices', 'Thiết bị')} value={stats.devices} color="var(--primary)" loading={loading} />
          <StatCard icon={Bell} label={t('customer.dashboard.total_alerts', 'Tổng Cảnh báo')} value={stats.alerts} color="#f97316" loading={loading} />
          <StatCard icon={AlertTriangle} label={t('customer.dashboard.active_alerts', 'Cảnh báo đang mở')} value={stats.activeAlerts} color="#ef4444" loading={loading} />
          <StatCard icon={ShieldAlert} label={t('customer.dashboard.incidents', 'Sự cố')} value={stats.incidents} color="#8b5cf6" loading={loading} />
        </div>

        <div style={{
          background: 'var(--white)', borderRadius: '12px',
          border: '1px solid var(--slate-200)', overflow: 'hidden',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
        }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--slate-200)', display: 'flex', alignItems: 'center', gap: '8px' }}>

            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: 'var(--slate-900)' }}>{t('customer.dashboard.recent_alerts', 'Cảnh báo gần đây')}</h3>
          </div>
          <div style={{ padding: '0' }}>
            {loading ? (
              <p style={{ padding: '20px 24px', color: 'var(--slate-500)', fontSize: '14px', textAlign: 'center' }}>{t('customer.common.loading', 'Đang tải...')}</p>
            ) : recentAlerts.length === 0 ? (
              <VNodata title={t('customer.alerts.no_data', 'Không có cảnh báo nào')} />
            ) : recentAlerts.map((alert, i) => (
              <div key={alert._id || i} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '16px 24px', borderBottom: i < recentAlerts.length - 1 ? '1px solid var(--slate-100)' : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '8px', height: '8px', borderRadius: '50%',
                    background: severityColor[alert.severity] || '#6b7280',
                  }} />
                  <div>
                    <p style={{ margin: 0, fontSize: '14px', color: 'var(--slate-900)', fontWeight: '500' }}>{alert.title || alert.rule_name || t('customer.alerts.default_alert', 'Alert')}</p>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <p style={{ margin: 0, fontSize: '12px', color: 'var(--slate-500)' }}>{alert.device_name || alert.source_ip || ''}</p>
                      {alert.createdAt && <span style={{ fontSize: '11px', color: 'var(--slate-400)' }}>{formatDate(alert.createdAt)}</span>}
                    </div>
                  </div>
                </div>
                <span style={{
                  padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600',
                  background: `${severityColor[alert.severity] || '#6b7280'}22`,
                  color: severityColor[alert.severity] || '#6b7280',
                  textTransform: 'uppercase',
                }}>
                  {alert.severity || t('customer.common.unknown', 'unknown')}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerDashboard;

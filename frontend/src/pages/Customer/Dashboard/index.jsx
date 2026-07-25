import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Server, Bell, ShieldAlert, TrendingUp, Activity, AlertTriangle, ArrowRight } from 'lucide-react';
import deviceApi from '@/api/device';
import alertsApi from '@/api/alerts';
import incidentsApi from '@/api/incidents';
import VHeaderPage from '@/components/VHeaderPage';
import VNoData from '@/components/VNoData';
import VButton from '@/components/VButton';
import Viewlogo from '@/components/Viewlogo';
import { formatDate } from '@/utils/formatDate';
import { useLoader } from '@/hooks/useLoader';
import '../../../pages/Dashboard/Dashboard.scss';
import '../Customer.scss';

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

  const severityColor = { critical: 'var(--red-500)', high: 'var(--orange-500)', medium: 'var(--yellow-500)', low: 'var(--green-500)' };

  return (
    <div className="customer-page-wrapper">
      
      <div className="dashboard-container" style={{ minHeight: 'auto' }}>
        <div className="promo-banner" style={{ margin: 0, marginBottom: '2.2857rem' }}>
          <div className="promo-content">
            <div className="promo-text">
              <h2>{t('dashboard.banner.title')}</h2>
              <p>{t('dashboard.banner.subtitle')}</p>
            </div>
            <div className="promo-actions">
              <VButton variant="primary" className="btn-primary">
                {t('dashboard.banner.btn_upgrade')}
              </VButton>
              <VButton variant="secondary" className="btn-secondary">
                {t('dashboard.banner.btn_report')}
                <ArrowRight size={16} />
              </VButton>
            </div>
          </div>

          <div className="promo-illustration">
            <div className="glow-effect"></div>
            <Viewlogo animate="spin" className="shield-icon" style={{ width: 'auto', maxHeight: '100%' }} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(15.7143rem, 1fr))', gap: '1.1429rem', marginBottom: '1.1429rem' }}>
          <StatCard icon={Server} label={t('customer.dashboard.devices')} value={stats.devices} color="var(--primary)" loading={loading} />
          <StatCard icon={Bell} label={t('customer.dashboard.total_alerts')} value={stats.alerts} color="var(--orange-500)" loading={loading} />
          <StatCard icon={AlertTriangle} label={t('customer.dashboard.active_alerts')} value={stats.activeAlerts} color="var(--red-500)" loading={loading} />
          <StatCard icon={ShieldAlert} label={t('customer.dashboard.incidents')} value={stats.incidents} color="var(--purple-500)" loading={loading} />
        </div>

        <div style={{
          background: 'var(--white)', borderRadius: '0.8571rem',
          border: '0.0714rem solid var(--slate-200)', overflow: 'hidden',
          boxShadow: '0 0.2857rem 0.4286rem -0.0714rem rgba(0, 0, 0, 0.05)',
        }}>
          <div style={{ padding: '1.1429rem 1.7143rem', borderBottom: '0.0714rem solid var(--slate-200)', display: 'flex', alignItems: 'center', gap: '0.5714rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.1429rem', fontWeight: '600', color: 'var(--slate-900)' }}>{t('customer.dashboard.recent_alerts')}</h3>
          </div>
          <div style={{ padding: '0' }}>
            {loading ? (
              <p style={{ padding: '1.4286rem 1.7143rem', color: 'var(--slate-500)', fontSize: '1rem', textAlign: 'center' }}>{t('customer.common.loading')}</p>
            ) : recentAlerts.length === 0 ? (
              <VNoData title={t('customer.alerts.no_data')} />
            ) : recentAlerts.map((alert, i) => (
              <div key={alert._id || i} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '1.1429rem 1.7143rem', borderBottom: i < recentAlerts.length - 1 ? '0.0714rem solid var(--slate-100)' : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8571rem' }}>
                  <div style={{
                    width: '0.5714rem', height: '0.5714rem', borderRadius: '50%',
                    background: severityColor[alert.severity] || 'var(--custom-color-14)',
                  }} />
                  <div>
                    <p style={{ margin: 0, fontSize: '1rem', color: 'var(--slate-900)', fontWeight: '500' }}>{alert.title || alert.rule_name || t('customer.alerts.default_alert')}</p>
                    <div style={{ display: 'flex', gap: '0.7143rem', alignItems: 'center' }}>
                      <p style={{ margin: 0, fontSize: '0.8571rem', color: 'var(--slate-500)' }}>{alert.device_name || alert.source_ip || ''}</p>
                      {alert.createdAt && <span style={{ fontSize: '0.7857rem', color: 'var(--slate-400)' }}>{formatDate(alert.createdAt)}</span>}
                    </div>
                  </div>
                </div>
                <span style={{
                  padding: '0.2143rem 0.7143rem', borderRadius: '1.4286rem', fontSize: '0.7857rem', fontWeight: '600',
                  background: `${severityColor[alert.severity] || 'var(--custom-color-14)'}22`,
                  color: severityColor[alert.severity] || 'var(--custom-color-14)',
                  textTransform: 'uppercase',
                }}>
                  {alert.severity || t('customer.common.unknown')}
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

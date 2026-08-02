import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Server, Bell, ShieldAlert, AlertTriangle, ArrowRight, ChevronDown, ChevronUp } from 'lucide-react';
import dashboardApi from '@/api/dashboard';
import VNoData from '@/components/VNoData';
import VButton from '@/components/VButton';
import Viewlogo from '@/components/Viewlogo';
import VStatus from '@/components/VStatus';
import { getSeverityProps, getScenarioProps, getSeverityColor } from '@/utils/statusMapper';
import { getAlertIconAndStyle, getAlertScenarioBadge } from '@/utils/alertMapper';
import { formatDate, getTimeAgo } from '@/utils/formatDate';
import { useLoader } from '@/hooks/useLoader';
import { useExpandable } from '@/hooks/useExpandable';
import SeverityStepper from '@/components/SeverityStepper';
import './Dashboard.scss';
import '../index.scss';

const StatCard = ({ icon: Icon, label, value, color = 'var(--blue-400)', loading, onClick }) => (
  <div className="stat-card-premium" onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
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
  const navigate = useNavigate();
  const [stats, setStats] = useState({ devices: 0, alerts: 0, incidents: 0, activeAlerts: 0 });
  const { isLoading: loading, hideLoading } = useLoader(true);
  const [recentAlerts, setRecentAlerts] = useState([]);
  const { expandedId, toggleExpand } = useExpandable();

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await dashboardApi.getCustomerSummary();
        const data = res.data || res;

        setStats({
          devices: data.devices || 0,
          alerts: data.alerts || 0,
          incidents: data.incidents || 0,
          activeAlerts: data.activeAlerts || 0,
        });
        setRecentAlerts(data.recentAlerts || []);
      } catch (e) {
        console.error(e);
      } finally {
        hideLoading();
      }
    };
    fetchStats();
  }, []);

  return (
    <div className="customer-page-wrapper">
      
      <div className="dashboard-container" style={{ minHeight: 'auto' }}>
        <div className="promo-banner" style={{ margin: 0, marginBottom: '2.2857rem' }}>
          <div className="promo-content">
            <div className="promo-text">
              <h2>{t('customer.dashboard.banner_title')}</h2>
              <p>{t('customer.dashboard.banner_subtitle')}</p>
            </div>
            <div className="promo-actions">
              <VButton variant="primary" className="btn-primary" onClick={() => navigate('/coming-soon')}>
                {t('customer.dashboard.btn_upgrade')}
              </VButton>
              <VButton variant="secondary" className="btn-secondary" onClick={() => navigate('/coming-soon')}>
                {t('customer.dashboard.btn_report')}
                <ArrowRight size={16} />
              </VButton>
            </div>
          </div>

          <div className="promo-illustration">
            <div className="glow-effect"></div>
            <Viewlogo animate="spin" className="shield-icon" style={{ width: 'auto', maxHeight: '100%' }} />
          </div>
        </div>

        <div className="stat-cards-container">
          <StatCard icon={Server} label={t('customer.dashboard.devices')} value={stats.devices} color="var(--primary)" loading={loading} onClick={() => navigate('/devices')} />
          <StatCard icon={Bell} label={t('customer.dashboard.total_alerts')} value={stats.alerts} color="var(--orange-500)" loading={loading} onClick={() => navigate('/alerts')} />
          <StatCard icon={AlertTriangle} label={t('customer.dashboard.active_alerts')} value={stats.activeAlerts} color="var(--red-500)" loading={loading} onClick={() => navigate('/alerts?status=open')} />
          <StatCard icon={ShieldAlert} label={t('customer.dashboard.incidents')} value={stats.incidents} color="var(--purple-500)" loading={loading} onClick={() => navigate('/incidents')} />
        </div>

        <div className="recent-alerts-card-premium">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>{t('customer.dashboard.recent_alerts')}</h3>
            <a 
              href="#" 
              onClick={(e) => { e.preventDefault(); navigate('/alerts'); }}
              style={{ color: 'var(--custom-color-15)', textDecoration: 'none', fontWeight: '600', fontSize: '0.9rem' }}
              className="view-all-link"
            >
              {t('notifications.viewAll')}
            </a>
          </div>
          <div style={{ padding: '0' }}>
            {loading ? (
              <p style={{ padding: '1.4286rem 1.7143rem', color: 'var(--slate-500)', fontSize: '1rem', textAlign: 'center' }}>{t('customer.common.loading')}</p>
            ) : recentAlerts.length === 0 ? (
              <VNoData message={t('customer.alerts.no_data')} />
            ) : recentAlerts.map((alert, i) => {
              const id = alert._id || i;
              const isExpanded = expandedId === id;
              const iconAndStyle = getAlertIconAndStyle(alert.rule_name);
              const AlertIcon = iconAndStyle.icon;
              const scenarioBadge = getAlertScenarioBadge(alert.rule_name, t);
              
              return (
                <div key={id} className={`recent-alert-item`}>
                  <div className="recent-alert-header">
                    <div className="alert-info desktop-fixed-width">
                      <div className="alert-icon-container" style={iconAndStyle.style}>
                        <AlertIcon size={24} />
                      </div>
                      <div className="alert-details">
                        <div className="alert-title-row">
                          <span className="alert-title" title={t(`alerts.rules.${alert.rule_name}.title`, { device: alert.device_id?.name || alert.device_id || 'Unknown', defaultValue: alert.title || alert.rule_name || t('customer.alerts.default_alert') })}>
                            {t(`alerts.rules.${alert.rule_name}.title`, { device: alert.device_id?.name || alert.device_id || 'Unknown', defaultValue: alert.title || alert.rule_name || t('customer.alerts.default_alert') })}
                          </span>
                        </div>
                        <div className="alert-meta-row">
                          <p className="alert-source" title={alert.device_id?.name || alert.device_name || alert.source_ip || ''}>
                            {alert.device_id?.name || alert.device_name || alert.source_ip || ''}
                          </p>
                          {alert.createdAt && (
                            <>
                              <span className="alert-separator">•</span>
                              <span className="alert-time" style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                {formatDate(alert.createdAt)}
                                <span style={{ color: 'var(--primary-color, var(--blue-500))', fontWeight: 500 }}>
                                  ({getTimeAgo(alert.createdAt, t)})
                                </span>
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="severity-stepper-container">
                      <SeverityStepper severity={alert.severity} t={t} compact={true} />
                    </div>

                    <div className="alert-status-col" style={{ width: '120px', justifyContent: 'flex-end' }}>
                      <div className="alert-badges" style={{ display: 'flex', gap: '0.8571rem', alignItems: 'center' }}>
                        {scenarioBadge && (
                          <VStatus label={scenarioBadge.label} style={scenarioBadge.style} />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerDashboard;

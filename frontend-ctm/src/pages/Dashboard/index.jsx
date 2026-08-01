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
import { formatDate } from '@/utils/formatDate';
import { useLoader } from '@/hooks/useLoader';
import { useExpandable } from '@/hooks/useExpandable';
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
              <VButton variant="primary" className="btn-primary">
                {t('customer.dashboard.btn_upgrade')}
              </VButton>
              <VButton variant="secondary" className="btn-secondary">
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
            ) : recentAlerts.map((alert, i) => {
              const id = alert._id || i;
              const isExpanded = expandedId === id;
              
              return (
                <div key={id} className={`recent-alert-item ${isExpanded ? 'expanded' : ''}`}>
                  <div className="recent-alert-header" onClick={() => { if (window.innerWidth <= 877) toggleExpand(id); }}>
                    <div className="alert-info">
                      <div className="alert-indicator" style={{ background: getSeverityColor(alert.severity) }} />
                      <div className="alert-details">
                        <div className="alert-title-row">
                          <span className="alert-title" title={alert.title || alert.rule_name || t('customer.alerts.default_alert')}>
                            {alert.title || alert.rule_name || t('customer.alerts.default_alert')}
                          </span>
                          {alert.device_id?.current_scenario && alert.device_id.current_scenario !== 'NORMAL' && (
                            <VStatus {...getScenarioProps(alert.device_id.current_scenario, t)} />
                          )}
                        </div>
                        <div className="alert-meta-row">
                          <p className="alert-source" title={alert.device_id?.name || alert.device_name || alert.source_ip || ''}>
                            {alert.device_id?.name || alert.device_name || alert.source_ip || ''}
                          </p>
                          {alert.createdAt && (
                            <>
                              <span className="alert-separator">•</span>
                              <span className="alert-time">{formatDate(alert.createdAt)}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="alert-status-col">
                      <VStatus {...getSeverityProps(alert.severity, t)} className="uppercase" />
                    </div>
                    <div className="expand-btn">
                      {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>
                  </div>
                  
                  {isExpanded && (
                    <div className="recent-alert-body">
                      <div className="detail-row">
                        <span className="detail-label">{t('customer.alerts.col_severity', 'Mức độ')}</span>
                        <VStatus {...getSeverityProps(alert.severity, t)} className="uppercase" />
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">{t('customer.alerts.col_status', 'Trạng thái')}</span>
                        <span className="detail-value" style={{ textTransform: 'capitalize' }}>{alert.status || '-'}</span>
                      </div>
                    </div>
                  )}
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

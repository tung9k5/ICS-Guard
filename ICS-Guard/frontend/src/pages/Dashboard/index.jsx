import React from 'react';
import { useTranslation } from 'react-i18next';
import { Activity, ShieldAlert, HeartPulse, Shield, ArrowRight } from 'lucide-react';
import { NetworkTrafficChart, ThreatActivityChart, SystemHealthChart } from '../../components/common/Charts';
import VButton from '@/components/common/VButton/VButton';
import './Dashboard.scss';

const Dashboard = () => {
  const { t } = useTranslation();

  return (
    <div className="dashboard-container">
      <div className="promo-banner">
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
          <img src="/image-logo.png" alt="Logo" className="shield-icon" style={{ width: 'auto', maxHeight: '100%', objectFit: 'contain' }} />
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-item full-width">
          <div className="item-header">
            <div className="icon-wrapper">
              <Activity size={20} />
            </div>
            <h3>{t('dashboard.network_traffic', 'Network Traffic Activity')}</h3>
          </div>
          <div className="dashboard-card">
            <div className="card-content">
              <NetworkTrafficChart />
            </div>
          </div>
        </div>

        <div className="dashboard-item">
          <div className="item-header">
            <div className="icon-wrapper" style={{ backgroundColor: '#fef2f2', color: '#ef4444' }}>
              <ShieldAlert size={20} />
            </div>
            <h3>{t('dashboard.threat_activity', 'Threat Activity Level')}</h3>
          </div>
          <div className="dashboard-card">
            <div className="card-content">
              <ThreatActivityChart />
            </div>
          </div>
        </div>

        <div className="dashboard-item">
          <div className="item-header">
            <div className="icon-wrapper" style={{ backgroundColor: '#ecfdf5', color: '#10b981' }}>
              <HeartPulse size={20} />
            </div>
            <h3>{t('dashboard.system_health', 'System Health Status')}</h3>
          </div>
          <div className="dashboard-card">
            <div className="card-content">
              <SystemHealthChart />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Activity, ShieldAlert, HeartPulse, Shield, ArrowRight } from 'lucide-react';
import { NetworkTrafficChart, ThreatActivityChart, SystemHealthChart } from '@/sections/Dashboard';
import VButton from '@/components/VButton';
import Viewlogo from '@/components/Viewlogo';
import dashboardApi from '@/api/dashboard';
import './Dashboard.scss';

const Dashboard = () => {
  const { t } = useTranslation();
  
  const [networkData, setNetworkData] = useState([]);
  const [threatData, setThreatData] = useState([]);
  const [healthData, setHealthData] = useState([]);

  useEffect(() => {
    const fetchDashboardStats = async () => {
      try {
        const [network, threat, health] = await Promise.all([
          dashboardApi.getNetworkTraffic(),
          dashboardApi.getThreatActivity(),
          dashboardApi.getSystemHealth()
        ]);
        
        if (network && network.status === 'success') {
          // If the wrapper is { status, data }
          setNetworkData(network.data || network);
        } else {
          setNetworkData(network || []);
        }

        if (threat && threat.status === 'success') {
          setThreatData(threat.data || threat);
        } else {
          setThreatData(threat || []);
        }

        if (health && health.status === 'success') {
          setHealthData(health.data || health);
        } else {
          setHealthData(health || []);
        }
      } catch (error) {
        console.error('Failed to fetch dashboard stats', error);
      }
    };

    fetchDashboardStats();
    
    // Optional: Auto-refresh every 60 seconds
    const interval = setInterval(fetchDashboardStats, 60000);
    return () => clearInterval(interval);
  }, []);

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
          <Viewlogo animate="spin" className="shield-icon" style={{ width: 'auto', maxHeight: '100%' }} />
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
              <NetworkTrafficChart data={networkData} />
            </div>
          </div>
        </div>

        <div className="dashboard-item">
          <div className="item-header">
            <div className="icon-wrapper" style={{ backgroundColor: 'var(--red-50)', color: 'var(--red-500)' }}>
              <ShieldAlert size={20} />
            </div>
            <h3>{t('dashboard.threat_activity', 'Threat Activity Level')}</h3>
          </div>
          <div className="dashboard-card">
            <div className="card-content">
              <ThreatActivityChart rawData={threatData} />
            </div>
          </div>
        </div>

        <div className="dashboard-item">
          <div className="item-header">
            <div className="icon-wrapper" style={{ backgroundColor: 'var(--green-50)', color: 'var(--green-500)' }}>
              <HeartPulse size={20} />
            </div>
            <h3>{t('dashboard.system_health', 'System Health Status')}</h3>
          </div>
          <div className="dashboard-card">
            <div className="card-content">
              <SystemHealthChart rawData={healthData} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

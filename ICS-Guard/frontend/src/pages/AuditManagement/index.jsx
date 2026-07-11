import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Shield, Clock } from 'lucide-react';
import AuditLogsList from '@/sections/AuditManagement/AuditLogsList';
import BlockedIpsList from '@/sections/AuditManagement/BlockedIpsList';
import VHeaderPage from '@/components/VHeaderPage';
import VButton from '@/components/VButton';
import './AuditManagement.scss';

const AuditManagement = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('logs');

  return (
    <div className="assets-page">
      <VHeaderPage 
        title={t('audit.page_title')}
        action={
          <div style={{ display: 'flex', gap: '12px' }}>
            <VButton 
              variant={activeTab === 'logs' ? 'primary' : 'outline'} 
              onClick={() => setActiveTab('logs')}
            >
              <Clock size={18} />
              {t('audit.tab_logs')}
            </VButton>
            <VButton 
              variant={activeTab === 'blocked-ips' ? 'primary' : 'outline'} 
              onClick={() => setActiveTab('blocked-ips')}
            >
              <Shield size={18} />
              {t('audit.tab_blocked')}
            </VButton>
          </div>
        }
      />

      <div className="assets-content">
        {activeTab === 'logs' && <AuditLogsList />}
        {activeTab === 'blocked-ips' && <BlockedIpsList />}
      </div>
    </div>
  );
};

export default AuditManagement;

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Shield, Clock, Trash2 } from 'lucide-react';
import AuditLogsList from '@/sections/AuditManagement/AuditLogsList';
import BlockedIpsList from '@/sections/AuditManagement/BlockedIpsList';
import VHeaderPage from '@/components/VHeaderPage';
import VButton from '@/components/VButton';
import './AuditManagement.scss';

const AuditManagement = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('logs');
  const [selectedLogIds, setSelectedLogIds] = useState([]);
  const [triggerBulkDelete, setTriggerBulkDelete] = useState(0);

  return (
    <div className="assets-page">
      <VHeaderPage 
        title={t('audit.page_title')}
        action={
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {selectedLogIds.length > 0 && activeTab === 'logs' && (
              <VButton variant="danger" onClick={() => setTriggerBulkDelete(prev => prev + 1)} style={{ flex: '1 1 auto', whiteSpace: 'nowrap' }}>
                <Trash2 size={18} />
                {t('audit.delete_selected', { count: selectedLogIds.length, defaultValue: `Xóa đã chọn (${selectedLogIds.length})` })}
              </VButton>
            )}
            <div style={{ display: 'flex', gap: '12px', flex: '1 1 auto', justifyContent: 'flex-end' }}>
              <VButton 
                variant={activeTab === 'logs' ? 'primary' : 'outline'} 
                onClick={() => setActiveTab('logs')}
                style={{ flex: '1 1 auto', whiteSpace: 'nowrap' }}
              >
                <Clock size={18} />
                {t('audit.tab_logs')}
              </VButton>
              <VButton 
                variant={activeTab === 'blocked-ips' ? 'primary' : 'outline'} 
                onClick={() => setActiveTab('blocked-ips')}
                style={{ flex: '1 1 auto', whiteSpace: 'nowrap' }}
              >
                <Shield size={18} />
                {t('audit.tab_blocked')}
              </VButton>
            </div>
          </div>
        }
      />

      <div className="assets-content">
        {activeTab === 'logs' && (
          <AuditLogsList 
            selectedIds={selectedLogIds} 
            setSelectedIds={setSelectedLogIds} 
            triggerBulkDelete={triggerBulkDelete} 
          />
        )}
        {activeTab === 'blocked-ips' && <BlockedIpsList />}
      </div>
    </div>
  );
};

export default AuditManagement;

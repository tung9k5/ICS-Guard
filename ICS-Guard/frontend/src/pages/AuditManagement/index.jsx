import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Shield, Clock, Trash2, Download } from 'lucide-react';
import AuditLogsList from '@/sections/AuditManagement/AuditLogsList';
import BlockedIpsList from '@/sections/AuditManagement/BlockedIpsList';
import VHeaderPage from '@/components/VHeaderPage';
import VButton from '@/components/VButton';
import auditApi from '@/api/audit';
import { toast } from '@/utils/toast';
import './AuditManagement.scss';

const AuditManagement = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('logs');
  const [selectedLogIds, setSelectedLogIds] = useState([]);
  const [triggerBulkDelete, setTriggerBulkDelete] = useState(0);

  const handleExportCSV = async () => {
    try {
      const res = await auditApi.getLogs({ page: 1, per_page: 1000 });
      const logs = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
      if (logs.length === 0) {
        toast.info('Không có dữ liệu nhật ký kiểm toán để xuất.');
        return;
      }

      const headers = ['ID', 'Thời Gian', 'Người Dùng', 'Hành Động', 'Tài Sản Mục Tiêu', 'Trạng Thái', 'Địa Chỉ IP'];
      const rows = logs.map(l => [
        l._id || l.id,
        new Date(l.createdAt || l.event_time || Date.now()).toISOString(),
        l.username || 'System',
        l.action || 'LOG',
        l.target_resource || 'N/A',
        l.status || 'SUCCESS',
        l.ipAddress || '127.0.0.1'
      ]);

      const csvContent = 'data:text/csv;charset=utf-8,\uFEFF'
        + [headers.join(','), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `ICS_Guard_Audit_Logs_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success('Đã xuất file báo cáo CSV thành công!');
    } catch (e) {
      toast.error('Lỗi khi xuất file CSV');
    }
  };

  return (
    <div className="assets-page">
      <VHeaderPage 
        title={t('audit.page_title')}
        action={
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {activeTab === 'logs' && (
              <VButton variant="secondary" onClick={handleExportCSV} style={{ flex: '1 1 auto', whiteSpace: 'nowrap' }}>
                <Download size={18} />
                Xuất Báo Cáo CSV
              </VButton>
            )}
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

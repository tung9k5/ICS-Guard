import React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, MapPin, Tag, Info, Calendar } from 'lucide-react';
import VDialog from '@/components/VDialog';
import VButton from '@/components/VButton';
import VStatus from '@/components/VStatus';
import { formatDate } from '@/utils/formatDate';
import { getSeverityVariant } from '@/utils/statusHelpers';

const getAlertStatusVariant = (status) => {
  switch (status) {
    case 'new': return 'danger';
    case 'acknowledged': return 'warning';
    case 'resolved': return 'success';
    case 'false_positive': return 'neutral';
    default: return 'neutral';
  }
};

const getScenarioVariant = (scenario) => {
  if (scenario === 'NORMAL') return 'success';
  if (scenario === 'OFFLINE') return 'neutral';
  return 'danger';
};

const AlertDetailModal = ({ alert: alertData, onClose }) => {
  const { t } = useTranslation();

  if (!alertData) return null;
  const alert = alertData.alert || alertData;
  const history = alertData.history || [];

  const header = (
    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <AlertTriangle size={20} className="text-warning" />
      {t('alerts.detail.title', 'Chi tiết cảnh báo')}
    </span>
  );

  const footer = (
    <VButton variant="outline" onClick={onClose}>
      {t('common.btn_cancel', 'Đóng')}
    </VButton>
  );

  return (
    <VDialog
      visible={!!alert}
      onHide={onClose}
      header={header}
      footer={footer}
      style={{ width: '650px', maxWidth: '100%' }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* Basic Info Card */}
        <div style={{ backgroundColor: 'var(--slate-50)', padding: '1.25rem', borderRadius: '0.5rem', border: '1px solid var(--slate-200)' }}>
          <h4 style={{ margin: '0 0 1rem 0', color: 'var(--slate-800)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem' }}>
            <Info size={18} className="text-primary" />
            {t('alerts.detail.basic_info', 'Thông tin cơ bản')}
          </h4>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)', fontWeight: 600, marginBottom: '0.25rem' }}>ID</div>
              <div style={{ color: 'var(--slate-800)', fontWeight: 500, fontFamily: 'monospace' }}>{alert.alert_code || alert._id}</div>
            </div>
            
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)', fontWeight: 600, marginBottom: '0.25rem' }}>{t('alerts.col_time', 'Thời gian')}</div>
              <div style={{ color: 'var(--slate-800)', display: 'flex', alignItems: 'center', gap: '0.375rem', fontWeight: 500 }}>
                <Calendar size={14} className="text-slate-500" />
                {alert.createdAt ? formatDate(alert.createdAt) : '—'}
              </div>
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)', fontWeight: 600, marginBottom: '0.25rem' }}>{t('alerts.col_title', 'Tiêu đề')}</div>
              <div style={{ color: 'var(--slate-800)', fontWeight: 600 }}>{alert.title || alert.rule_name}</div>
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)', fontWeight: 600, marginBottom: '0.25rem' }}>{t('alerts.detail.description', 'Mô tả chi tiết')}</div>
              <div style={{ color: 'var(--slate-700)', backgroundColor: 'white', padding: '1rem', borderRadius: '0.375rem', border: '1px solid var(--slate-200)', lineHeight: '1.6' }}>
                {alert.description || '—'}
              </div>
            </div>
          </div>
        </div>

        {/* Status and Severity */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div style={{ backgroundColor: 'var(--slate-50)', padding: '1.25rem', borderRadius: '0.5rem', border: '1px solid var(--slate-200)' }}>
            <h4 style={{ margin: '0 0 1rem 0', color: 'var(--slate-800)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem' }}>
              <Tag size={18} className="text-primary" />
              {t('alerts.detail.classification', 'Phân loại')}
            </h4>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)', fontWeight: 600, marginBottom: '0.375rem' }}>{t('alerts.col_severity', 'Mức độ')}</div>
                <VStatus label={t(`severity.${alert.severity?.toLowerCase()}`, alert.severity)}
                  status={getSeverityVariant(alert.severity)} type="severity" 
                  className="uppercase badge-outline" 
                />
              </div>
              
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)', fontWeight: 600, marginBottom: '0.375rem' }}>{t('alerts.col_status', 'Trạng thái')}</div>
                <VStatus label={t(`status.${alert.status?.toLowerCase()}`, alert.status)}
                  status={getAlertStatusVariant(alert.status)} type="status"
                />
              </div>
            </div>
          </div>

          {/* Source Device */}
          <div style={{ backgroundColor: 'var(--slate-50)', padding: '1.25rem', borderRadius: '0.5rem', border: '1px solid var(--slate-200)' }}>
            <h4 style={{ margin: '0 0 1rem 0', color: 'var(--slate-800)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem' }}>
              <MapPin size={18} className="text-primary" />
              {t('alerts.detail.source', 'Nguồn phát sinh')}
            </h4>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)', fontWeight: 600, marginBottom: '0.375rem' }}>{t('alerts.col_source', 'Thiết bị')}</div>
                <div style={{ color: 'var(--slate-800)', fontWeight: 600, fontFamily: 'monospace' }}>
                  {alert.device_id?.name || alert.device_name || alert.source_ip || '—'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)', fontWeight: 600, marginBottom: '0.375rem' }}>{t('alerts.col_simulation', 'Mô phỏng')}</div>
                <VStatus label={alert.device_id?.current_scenario || 'NORMAL'}
                  status={getScenarioVariant(alert.device_id?.current_scenario)} type="simulator" 
                />
              </div>
            </div>
          </div>
        </div>

        {/* Alert History */}
        {history.length > 0 && (
          <div style={{ backgroundColor: 'var(--slate-50)', padding: '1.25rem', borderRadius: '0.5rem', border: '1px solid var(--slate-200)' }}>
            <h4 style={{ margin: '0 0 1rem 0', color: 'var(--slate-800)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem' }}>
              <Tag size={18} className="text-primary" />
              Lịch sử các lần mô phỏng
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {history.map((h, index) => (
                <div key={h._id || index} style={{ padding: '1rem', backgroundColor: 'white', border: '1px solid var(--slate-200)', borderRadius: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontWeight: 600, color: 'var(--slate-800)' }}>
                      Mô phỏng lần {history.length - index}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>{formatDate(h.detected_at)}</span>
                  </div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--slate-700)', backgroundColor: 'var(--slate-50)', padding: '0.75rem', borderRadius: '0.375rem', border: '1px solid var(--slate-200)' }}>
                    <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Log cảnh báo:</div>
                    <div style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{h.description}</div>
                  </div>
                  {/* Note: AI Analysis can be added here if fetched from IncidentTimeline */}
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </VDialog>
  );
};

export default AlertDetailModal;

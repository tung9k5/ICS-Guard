import React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, MapPin, Tag, Info, Calendar } from 'lucide-react';
import VDialog from '@/components/VDialog';
import VButton from '@/components/VButton';
import VStatus from '@/components/VStatus';
import { formatDate } from '@/utils/formatDate';
import { getSeverityProps, getAlertStatusProps, getScenarioProps } from '@/utils/statusMapper';

const AlertDetailModal = ({ alert, onClose }) => {
  const { t } = useTranslation();

  if (!alert) return null;

  const header = (
    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <AlertTriangle size={20} className="text-warning" />
      {t('customer.alerts.detail.title', 'Chi tiết cảnh báo')}
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
            {t('customer.alerts.detail.basic_info', 'Thông tin cơ bản')}
          </h4>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)', fontWeight: 600, marginBottom: '0.25rem' }}>ID</div>
              <div style={{ color: 'var(--slate-800)', fontWeight: 500, fontFamily: 'monospace' }}>{alert.alert_code || alert._id}</div>
            </div>
            
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)', fontWeight: 600, marginBottom: '0.25rem' }}>{t('customer.alerts.col_time', 'Thời gian')}</div>
              <div style={{ color: 'var(--slate-800)', display: 'flex', alignItems: 'center', gap: '0.375rem', fontWeight: 500 }}>
                <Calendar size={14} className="text-slate-500" />
                {alert.createdAt ? formatDate(alert.createdAt) : '—'}
              </div>
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)', fontWeight: 600, marginBottom: '0.25rem' }}>{t('customer.alerts.col_title', 'Tiêu đề')}</div>
              <div style={{ color: 'var(--slate-800)', fontWeight: 600 }}>{alert.title || alert.rule_name}</div>
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)', fontWeight: 600, marginBottom: '0.25rem' }}>{t('customer.alerts.detail.description', 'Mô tả chi tiết')}</div>
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
              {t('customer.alerts.detail.classification', 'Phân loại')}
            </h4>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)', fontWeight: 600, marginBottom: '0.375rem' }}>{t('customer.alerts.col_severity', 'Mức độ')}</div>
                <VStatus {...getSeverityProps(alert.severity, t)} className="uppercase badge-outline" />
              </div>
              
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)', fontWeight: 600, marginBottom: '0.375rem' }}>{t('customer.alerts.col_status', 'Trạng thái')}</div>
                <VStatus {...getAlertStatusProps(alert.status, t)} />
              </div>
            </div>
          </div>

          {/* Source Device */}
          <div style={{ backgroundColor: 'var(--slate-50)', padding: '1.25rem', borderRadius: '0.5rem', border: '1px solid var(--slate-200)' }}>
            <h4 style={{ margin: '0 0 1rem 0', color: 'var(--slate-800)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem' }}>
              <MapPin size={18} className="text-primary" />
              {t('customer.alerts.detail.source', 'Nguồn phát sinh')}
            </h4>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)', fontWeight: 600, marginBottom: '0.375rem' }}>{t('customer.alerts.col_source', 'Thiết bị')}</div>
                <div style={{ color: 'var(--slate-800)', fontWeight: 600, fontFamily: 'monospace' }}>
                  {alert.device_id?.name || alert.device_name || alert.source_ip || '—'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)', fontWeight: 600, marginBottom: '0.375rem' }}>{t('customer.alerts.col_simulation', 'Mô phỏng')}</div>
                <VStatus {...getScenarioProps(alert.device_id?.current_scenario, t)} />
              </div>
            </div>
          </div>
        </div>

      </div>
    </VDialog>
  );
};

export default AlertDetailModal;

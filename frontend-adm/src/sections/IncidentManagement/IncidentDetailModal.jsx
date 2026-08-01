import React from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldAlert, Info, Tag, Calendar, Target, Activity } from 'lucide-react';
import VDialog from '@/components/VDialog';
import VButton from '@/components/VButton';
import VStatus from '@/components/VStatus';
import { formatDate } from '@/utils/formatDate';
import { INCIDENT_STATUS, getIncidentSeverityStyle, getIncidentStatusLabel } from '@/constants/incidentConstants';
import SeverityStepper from '@/components/SeverityStepper';

const IncidentDetailModal = ({ incident, onClose }) => {
  const { t } = useTranslation();

  if (!incident) return null;

  const header = (
    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <ShieldAlert size={20} className="text-danger" />
      {t('incidents.detail.title', 'Chi tiết sự cố')}
    </span>
  );

  const footer = (
    <VButton variant="outline" onClick={onClose}>
      {t('common.btn_cancel', 'Đóng')}
    </VButton>
  );

  return (
    <VDialog
      visible={!!incident}
      onHide={onClose}
      header={header}
      footer={footer}
      style={{ width: '650px', maxWidth: '100%' }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* Severity Stepper */}
        <SeverityStepper severity={incident.severity} t={t} />

        {/* Basic Info Card */}
        <div style={{ backgroundColor: 'var(--slate-50)', padding: '1.25rem', borderRadius: '0.5rem', border: '1px solid var(--slate-200)' }}>
          <h4 style={{ margin: '0 0 1rem 0', color: 'var(--slate-800)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem' }}>
            <Info size={18} className="text-primary" />
            {t('incidents.detail.basic_info', 'Thông tin cơ bản')}
          </h4>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)', fontWeight: 600, marginBottom: '0.25rem' }}>ID</div>
              <div style={{ color: 'var(--slate-800)', fontWeight: 500, fontFamily: 'monospace' }}>{incident.incident_code || incident._id}</div>
            </div>
            
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)', fontWeight: 600, marginBottom: '0.25rem' }}>{t('incidents.col_time', 'Thời gian phát hiện')}</div>
              <div style={{ color: 'var(--slate-800)', display: 'flex', alignItems: 'center', gap: '0.375rem', fontWeight: 500 }}>
                <Calendar size={14} className="text-slate-500" />
                {incident.createdAt ? formatDate(incident.createdAt) : '—'}
              </div>
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)', fontWeight: 600, marginBottom: '0.25rem' }}>{t('incidents.col_title', 'Tiêu đề sự cố')}</div>
              <div style={{ color: 'var(--slate-800)', fontWeight: 600 }}>{incident.title}</div>
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)', fontWeight: 600, marginBottom: '0.25rem' }}>{t('incidents.detail.description', 'Mô tả chi tiết')}</div>
              <div style={{ color: 'var(--slate-700)', backgroundColor: 'white', padding: '1rem', borderRadius: '0.375rem', border: '1px solid var(--slate-200)', lineHeight: '1.6' }}>
                {incident.description || '—'}
              </div>
            </div>
          </div>
        </div>

        {/* Classification and Impact */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div style={{ backgroundColor: 'var(--slate-50)', padding: '1.25rem', borderRadius: '0.5rem', border: '1px solid var(--slate-200)' }}>
            <h4 style={{ margin: '0 0 1rem 0', color: 'var(--slate-800)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem' }}>
              <Tag size={18} className="text-primary" />
              {t('incidents.detail.classification', 'Phân loại')}
            </h4>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)', fontWeight: 600, marginBottom: '0.375rem' }}>{t('incidents.col_severity', 'Mức độ ảnh hưởng')}</div>
                <VStatus 
                  label={t(`severity.${incident.severity?.toLowerCase()}`, incident.severity)}
                  style={getIncidentSeverityStyle(incident.severity)} 
                  className="uppercase badge-outline" 
                />
              </div>
              
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)', fontWeight: 600, marginBottom: '0.375rem' }}>{t('incidents.col_status', 'Trạng thái xử lý')}</div>
                <VStatus 
                  label={getIncidentStatusLabel(incident.status, t)}
                  status={incident.status === INCIDENT_STATUS.OPEN ? 'inactive' : incident.status === INCIDENT_STATUS.CLOSED ? 'active' : 'default'}
                />
              </div>
            </div>
          </div>

          <div style={{ backgroundColor: 'var(--slate-50)', padding: '1.25rem', borderRadius: '0.5rem', border: '1px solid var(--slate-200)' }}>
            <h4 style={{ margin: '0 0 1rem 0', color: 'var(--slate-800)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem' }}>
              <Target size={18} className="text-primary" />
              {t('incidents.detail.related_info', 'Thông tin liên quan')}
            </h4>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)', fontWeight: 600, marginBottom: '0.375rem' }}>{t('incidents.detail.alerts_count', 'Số cảnh báo liên kết')}</div>
                <div style={{ color: 'var(--slate-800)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <Activity size={16} className="text-warning" />
                  {incident.alert_ids?.length || 0} {t('incidents.detail.alerts', 'cảnh báo')}
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </VDialog>
  );
};

export default IncidentDetailModal;

import React from 'react';
import VDialog from '@/components/VDialog';
import VStatus from '@/components/VStatus';
import { getDeviceTypeLabel, getDeviceTypeStyle } from '@/constants/deviceConstants';
import { getScenarioProps } from '@/utils/statusMapper';
import { useTranslation } from 'react-i18next';
import { formatDate } from '@/utils/formatDate';
import { Hash, Monitor, Server, Globe, Network, Activity, MapPin, AlignLeft, Calendar, Clock } from 'lucide-react';

const DeviceDetailModal = ({ device, onClose }) => {
  const { t } = useTranslation();
  if (!device) return null;

  return (
    <VDialog
      visible={true}
      onHide={onClose}
      header={t('assets.view_details_title', 'Chi tiết thiết bị')}
      style={{ maxWidth: '50rem' }}
    >
      <div className="device-detail-content" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '0.5rem' }}>
        
        {/* Row 1: General Info & Network */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
          
          {/* Card: Thông tin cơ bản */}
          <div style={{ background: 'var(--white)', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid var(--slate-200)', boxShadow: '0 1px 3px var(--custom-color-32)' }}>
            <h4 style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: 'var(--slate-800)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Monitor size={18} className="text-primary" />
              {t('assets.detail.basic_info', 'Thông tin cơ bản')}
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <div style={{ padding: '0.4rem', background: 'var(--slate-100)', borderRadius: '0.375rem', color: 'var(--slate-500)' }}><Hash size={16} /></div>
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)', fontWeight: 600 }}>{t('assets.detail.id', 'ID')}</div>
                  <div style={{ fontSize: '0.95rem', color: 'var(--slate-800)', marginTop: '0.125rem' }}>{device.id || device._id}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <div style={{ padding: '0.4rem', background: 'var(--slate-100)', borderRadius: '0.375rem', color: 'var(--slate-500)' }}><Server size={16} /></div>
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)', fontWeight: 600 }}>{t('assets.list.table_name', 'Tên thiết bị')}</div>
                  <div style={{ fontSize: '0.95rem', color: 'var(--slate-800)', fontWeight: 600, marginTop: '0.125rem' }}>{device.name}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <div style={{ padding: '0.4rem', background: 'var(--slate-100)', borderRadius: '0.375rem', color: 'var(--slate-500)' }}><Activity size={16} /></div>
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)', fontWeight: 600, marginBottom: '0.25rem' }}>{t('assets.list.table_type', 'Loại')}</div>
                  <VStatus label={getDeviceTypeLabel(device.type) || 'N/A'} style={getDeviceTypeStyle(device.type)} className="badge-outline" />
                </div>
              </div>
            </div>
          </div>

          {/* Card: Mạng & Vị trí */}
          <div style={{ background: 'var(--white)', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid var(--slate-200)', boxShadow: '0 1px 3px var(--custom-color-32)' }}>
            <h4 style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: 'var(--slate-800)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Globe size={18} className="text-primary" />
              {t('assets.detail.network_location', 'Mạng & Vị trí')}
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <div style={{ padding: '0.4rem', background: 'var(--slate-100)', borderRadius: '0.375rem', color: 'var(--slate-500)' }}><Globe size={16} /></div>
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)', fontWeight: 600 }}>{t('assets.list.table_ip', 'IP Address')}</div>
                  <div style={{ fontSize: '0.95rem', color: 'var(--slate-800)', marginTop: '0.125rem', fontFamily: 'monospace' }}>{device.ip_address || device.ipAddress || 'N/A'}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <div style={{ padding: '0.4rem', background: 'var(--slate-100)', borderRadius: '0.375rem', color: 'var(--slate-500)' }}><Network size={16} /></div>
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)', fontWeight: 600 }}>{t('assets.detail.mac_address', 'MAC Address')}</div>
                  <div style={{ fontSize: '0.95rem', color: 'var(--slate-800)', marginTop: '0.125rem', fontFamily: 'monospace' }}>{device.mac_address || device.macAddress || 'N/A'}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <div style={{ padding: '0.4rem', background: 'var(--slate-100)', borderRadius: '0.375rem', color: 'var(--slate-500)' }}><MapPin size={16} /></div>
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)', fontWeight: 600 }}>{t('assets.detail.zone', 'Khu vực (Zone)')}</div>
                  <div style={{ fontSize: '0.95rem', color: 'var(--slate-800)', marginTop: '0.125rem' }}>{device.zone || 'N/A'}</div>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Row 2: Status & Description */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ background: 'var(--white)', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid var(--slate-200)', boxShadow: '0 1px 3px var(--custom-color-32)' }}>
              <h4 style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: 'var(--slate-800)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Activity size={18} className="text-primary" />
                {t('assets.detail.operation_status', 'Trạng thái hoạt động')}
              </h4>
              <div style={{ display: 'flex', gap: '2rem' }}>
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)', fontWeight: 600, marginBottom: '0.5rem' }}>{t('assets.list.table_status', 'Trạng thái')}</div>
                  <VStatus status={device.status} label={device.status === 'active' ? t('assets.filter_status_active') : t('assets.filter_status_inactive')} />
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)', fontWeight: 600, marginBottom: '0.5rem' }}>{t('customer.alerts.col_simulation', 'Mô phỏng')}</div>
                  <VStatus {...getScenarioProps(device.current_scenario, t)} />
                </div>
              </div>
            </div>

            <div style={{ background: 'var(--white)', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid var(--slate-200)', boxShadow: '0 1px 3px var(--custom-color-32)' }}>
              <h4 style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: 'var(--slate-800)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Clock size={18} className="text-primary" />
                {t('assets.detail.time_info', 'Thời gian')}
              </h4>
              <div style={{ display: 'flex', gap: '2rem' }}>
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)', fontWeight: 600, marginBottom: '0.25rem' }}>{t('common.created_at', 'Ngày tạo')}</div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--slate-700)' }}>{formatDate(device.createdAt)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)', fontWeight: 600, marginBottom: '0.25rem' }}>{t('common.updated_at', 'Cập nhật')}</div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--slate-700)' }}>{formatDate(device.updatedAt)}</div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ background: 'var(--white)', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid var(--slate-200)', boxShadow: '0 1px 3px var(--custom-color-32)', display: 'flex', flexDirection: 'column' }}>
            <h4 style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: 'var(--slate-800)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlignLeft size={18} className="text-primary" />
              {t('assets.list.table_desc', 'Mô tả')}
            </h4>
            <div style={{ background: 'var(--slate-50)', padding: '1rem', borderRadius: '0.5rem', color: 'var(--slate-700)', fontSize: '0.95rem', lineHeight: '1.6', flex: 1, whiteSpace: 'pre-wrap', border: '1px solid var(--slate-200)' }}>
              {device.description || <span style={{ color: 'var(--slate-400)', fontStyle: 'italic' }}>{t('assets.list.no_description', 'Không có mô tả')}</span>}
            </div>
          </div>

        </div>

      </div>
    </VDialog>
  );
};

export default DeviceDetailModal;

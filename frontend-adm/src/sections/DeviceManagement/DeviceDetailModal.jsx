import React from 'react';
import VDialog from '@/components/VDialog';
import VStatus from '@/components/VStatus';
import { getScenarioConfig } from '@/utils/statusMapper';
import { useTranslation } from 'react-i18next';
import { formatDate } from '@/utils/formatDate';
import { Hash, Monitor, Server, Globe, Network, Activity, MapPin, AlignLeft, Calendar, Clock } from 'lucide-react';

const DeviceDetailModal = ({ device: deviceData, onClose }) => {
  const { t } = useTranslation();
  if (!deviceData) return null;

  const device = deviceData.device || deviceData;
  const history = deviceData.history || [];

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
          <div style={{ background: 'var(--white)', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid var(--slate-200)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
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
                  <VStatus status={device.type} type="device_type" className="badge-outline" />
                </div>
              </div>
            </div>
          </div>

          {/* Card: Mạng & Vị trí */}
          <div style={{ background: 'var(--white)', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid var(--slate-200)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
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
            <div style={{ background: 'var(--white)', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid var(--slate-200)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <h4 style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: 'var(--slate-800)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Activity size={18} className="text-primary" />
                {t('assets.detail.operation_status', 'Trạng thái hoạt động')}
              </h4>
              <div style={{ display: 'flex', gap: '2rem' }}>
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)', fontWeight: 600, marginBottom: '0.5rem' }}>{t('assets.list.table_status', 'Trạng thái')}</div>
                  <VStatus status={device.status} type="status" />
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)', fontWeight: 600, marginBottom: '0.5rem' }}>{t('customer.alerts.col_simulation', 'Mô phỏng')}</div>
                  <VStatus status={device.current_scenario} type="simulator" />
                </div>
              </div>
            </div>

            <div style={{ background: 'var(--white)', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid var(--slate-200)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
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

          <div style={{ background: 'var(--white)', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid var(--slate-200)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column' }}>
            <h4 style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: 'var(--slate-800)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlignLeft size={18} className="text-primary" />
              {t('assets.list.table_desc', 'Mô tả')}
            </h4>
            <div style={{ background: 'var(--slate-50)', padding: '1rem', borderRadius: '0.5rem', color: 'var(--slate-700)', fontSize: '0.95rem', lineHeight: '1.6', flex: 1, whiteSpace: 'pre-wrap', border: '1px solid var(--slate-200)' }}>
              {device.description || <span style={{ color: 'var(--slate-400)', fontStyle: 'italic' }}>{t('assets.list.no_description', 'Không có mô tả')}</span>}
            </div>
          </div>

        </div>

        {/* Row 3: Simulation History */}
        {history.length > 0 && (
          <div style={{ background: 'var(--white)', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid var(--slate-200)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <h4 style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: 'var(--slate-800)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Activity size={18} className="text-primary" />
              Lịch sử Mô phỏng (Simulation History)
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {history.map((sim, index) => (
                <div key={sim._id || index} style={{ padding: '1rem', backgroundColor: 'var(--slate-50)', border: '1px solid var(--slate-200)', borderRadius: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <div>
                      <strong style={{ color: 'var(--slate-800)', display: 'block' }}>{sim.title}</strong>
                      <span style={{ fontSize: '0.8rem', color: 'var(--slate-500)' }}>{sim.rule_name} • Mô phỏng lần {history.length - index}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <VStatus status={sim.severity} type="severity" className="badge-outline uppercase" />
                      <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)', marginTop: '0.25rem' }}>{formatDate(sim.detected_at)}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--slate-700)', backgroundColor: 'white', padding: '0.75rem', borderRadius: '0.375rem', border: '1px solid var(--slate-200)' }}>
                    <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Log cảnh báo:</div>
                    <div style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{sim.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </VDialog>
  );
};

export default DeviceDetailModal;

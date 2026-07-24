import React, { useState, useEffect } from 'react';
import { Server, Plus, Pencil, Trash2, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import deviceApi from '@/api/device';
import { toast } from '@/utils/toast';
import VHeaderPage from '@/components/VHeaderPage';
import VNoData from '@/components/VNoData';
import VPagination from '@/components/VPagination';
import VButton from '@/components/VButton';
import VStatus from '@/components/VStatus';
import { formatDate } from '@/utils/formatDate';

const StatusBadge = ({ status }) => {
  const { t } = useTranslation();
  
  const getVariant = () => {
    switch(status) {
      case 'online': return 'success';
      case 'offline': return 'neutral';
      case 'quarantined': return 'danger';
      default: return 'neutral';
    }
  };
  
  const getLabel = () => {
    switch(status) {
      case 'online': return t('customer.status.online', 'Online');
      case 'offline': return t('customer.status.offline', 'Offline');
      case 'quarantined': return t('customer.status.quarantined', 'Quarantined');
      default: return status;
    }
  };

  return <VStatus status={getVariant()} label={getLabel()} showDot />;
};

const CustomerDevices = () => {
  const { t } = useTranslation();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [total, setTotal] = useState(0);

  const fetchDevices = async () => {
    setLoading(true);
    try {
      const res = await deviceApi.getAll({ page, limit: perPage });
      setDevices(res.data || res.devices || []);
      setTotal(res.total || 0);
    } catch (e) {
      toast.error(t('customer.devices.fetch_error', 'Không thể tải danh sách thiết bị'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDevices(); }, [page, perPage]);

  return (
    <div className="assets-page">
      <VHeaderPage 
        title={t('customer.devices.title', 'Thiết bị của tôi')}
        action={
          <VButton onClick={fetchDevices} variant="outline" style={{ display: 'flex', alignItems: 'center', gap: '0.4286rem' }}>
            <RefreshCw size={15} /> {t('customer.common.refresh', 'Làm mới')}
          </VButton>
        }
      />

      <div style={{ background: 'var(--white)', borderRadius: '0.8571rem', border: '0.0714rem solid var(--slate-200)', overflow: 'hidden', boxShadow: '0 0.2857rem 0.4286rem -0.0714rem rgba(0, 0, 0, 0.05)' }}>
        {loading ? (
          <div style={{ padding: '2.8571rem', textAlign: 'center', color: 'var(--slate-500)' }}>{t('customer.common.loading', 'Đang tải...')}</div>
        ) : devices.length === 0 ? (
          <VNoData title={t('customer.devices.no_data', 'Chưa có thiết bị nào')} />
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--slate-50)' }}>
                {[
                  t('customer.devices.col_name', 'Tên thiết bị'), 
                  t('customer.devices.col_ip', 'IP'), 
                  t('customer.devices.col_mac', 'MAC'), 
                  t('customer.devices.col_zone', 'Zone'), 
                  t('customer.devices.col_status', 'Trạng thái'), 
                  t('customer.devices.col_risk_score', 'Risk Score'),
                  t('common.created_at', 'Ngày tạo')
                ].map((h, index) => (
                  <th key={index} style={{ padding: '0.8571rem 1.1429rem', textAlign: 'left', fontSize: '0.9286rem', color: 'var(--slate-800)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.0357rem', borderBottom: '0.0714rem solid var(--slate-200)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {devices.map((device, i) => (
                <tr key={device._id} style={{ borderBottom: i < devices.length - 1 ? '0.0714rem solid var(--slate-200)' : 'none', background: 'var(--white)', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--slate-50)'} onMouseLeave={e => e.currentTarget.style.background = 'var(--white)'}>
                  <td style={{ padding: '1rem 1.1429rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5714rem' }}>
                      {device.status === 'online' ? <Wifi size={15} color="var(--green-500)" /> : <WifiOff size={15} color="var(--custom-color-14)" />}
                      <span style={{ fontSize: '1rem', fontWeight: '500', color: 'var(--slate-900)' }}>{device.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: '1rem 1.1429rem', fontSize: '0.9286rem', color: 'var(--slate-500)', fontFamily: 'monospace' }}>{device.ip}</td>
                  <td style={{ padding: '1rem 1.1429rem', fontSize: '0.9286rem', color: 'var(--slate-500)', fontFamily: 'monospace' }}>{device.mac || '—'}</td>
                  <td style={{ padding: '1rem 1.1429rem', fontSize: '0.9286rem', color: 'var(--slate-500)' }}>{device.zone || '—'}</td>
                  <td style={{ padding: '1rem 1.1429rem' }}><StatusBadge status={device.status} /></td>
                  <td style={{ padding: '1rem 1.1429rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5714rem' }}>
                      <div style={{ flex: 1, height: '0.4286rem', background: 'var(--slate-100)', borderRadius: '0.2143rem', overflow: 'hidden', maxWidth: '5.7143rem' }}>
                        <div style={{ height: '100%', width: `${device.risk_score || 0}%`, background: device.risk_score > 70 ? 'var(--red-500)' : device.risk_score > 40 ? 'var(--orange-500)' : 'var(--green-500)', borderRadius: '0.2143rem' }} />
                      </div>
                      <span style={{ fontSize: '0.8571rem', color: 'var(--slate-500)' }}>{device.risk_score || 0}%</span>
                    </div>
                  </td>
                  <td style={{ padding: '1rem 1.1429rem', fontSize: '0.8571rem', color: 'var(--slate-500)' }}>
                    {device.createdAt ? formatDate(device.createdAt) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {total > 0 && devices.length > 0 && (
          <div style={{ borderTop: '0.0714rem solid var(--slate-200)', background: 'var(--slate-50)' }}>
            <VPagination 
              page={page}
              perPage={perPage}
              total={total}
              dataLength={devices.length}
              itemName={t('customer.devices.item_name', 'thiết bị')}
              onPageChange={(newPage) => setPage(newPage)}
              onPerPageChange={(newPerPage) => {
                setPerPage(newPerPage);
                setPage(1);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerDevices;

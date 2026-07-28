import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import deviceApi from '@/api/device';
import { toast } from '@/utils/toast';
import VHeaderPage from '@/components/VHeaderPage';
import VNoData from '@/components/VNoData';
import VPagination from '@/components/VPagination';
import VButton from '@/components/VButton';
import VStatus from '@/components/VStatus';
import { formatDate } from '@/utils/formatDate';
import '../Customer.scss';

const StatusBadge = ({ status }) => {
  const { t } = useTranslation();

  const getVariant = () => {
    switch (status) {
      case 'online': return 'success';
      case 'offline': return 'neutral';
      case 'quarantined': return 'danger';
      default: return 'neutral';
    }
  };

  const getLabel = () => {
    switch (status) {
      case 'online': return t('customer.status.online');
      case 'offline': return t('customer.status.offline');
      case 'quarantined': return t('customer.status.quarantined');
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
    } catch {
      toast.error(t('customer.devices.fetch_error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDevices(); }, [page, perPage]);

  return (
    <div className="customer-page-wrapper">
      <VHeaderPage
        title={t('customer.devices.title')}
        action={
          <VButton onClick={fetchDevices} variant="outline" icon={RefreshCw}>
            {t('customer.common.refresh')}
          </VButton>
        }
      />

      <div style={{ background: 'var(--white)', borderRadius: '0.8571rem', border: '0.0714rem solid var(--slate-200)', overflow: 'hidden', boxShadow: '0 0.2857rem 0.4286rem -0.0714rem rgba(0, 0, 0, 0.05)' }}>
        {loading ? (
          <div className="device-loading">
            <span>{t('customer.common.loading')}</span>
          </div>
        ) : devices.length === 0 ? (
          <VNoData title={t('customer.devices.no_data')} />
        ) : (
          <div className="device-list-container">
            <div className="device-table-wrapper">
              <table className="device-table">
                <thead>
                  <tr>
                    {[
                      t('customer.devices.col_name'),
                      t('customer.devices.col_ip'),
                      t('customer.devices.col_mac'),
                      t('customer.devices.col_zone'),
                      t('customer.devices.col_status'),
                      t('customer.devices.col_risk_score'),
                      t('common.created_at'),
                    ].map((h, i) => (
                      <th key={i}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {devices.map((device) => (
                    <tr key={device._id}>
                      <td style={{ maxWidth: '14.2857rem' }}>
                        <div className="device-name" style={{ display: 'flex', alignItems: 'center', gap: '0.5714rem', minWidth: 0 }}>
                          {device.status === 'online'
                            ? <Wifi size={15} color="var(--green-500)" style={{ flexShrink: 0 }} />
                            : <WifiOff size={15} color="var(--custom-color-14)" style={{ flexShrink: 0 }} />}
                          <span className="truncate-text" title={device.name} style={{ flex: 1, minWidth: 0 }}>{device.name}</span>
                        </div>
                      </td>
                      <td className="text-muted" style={{ fontFamily: 'monospace', maxWidth: '10.7143rem' }}>
                        <div className="truncate-text" title={device.ip}>{device.ip}</div>
                      </td>
                      <td className="text-muted" style={{ fontFamily: 'monospace', maxWidth: '12.8571rem' }}>
                        <div className="truncate-text" title={device.mac || '—'}>{device.mac || '—'}</div>
                      </td>
                      <td className="text-muted" style={{ maxWidth: '10.7143rem' }}>
                        <div className="truncate-text" title={device.zone || '—'}>{device.zone || '—'}</div>
                      </td>
                      <td><StatusBadge status={device.status} /></td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5714rem' }}>
                          <div style={{ flex: 1, height: '0.4286rem', background: 'var(--slate-100)', borderRadius: '0.2143rem', overflow: 'hidden', maxWidth: '5.7143rem' }}>
                            <div style={{
                              height: '100%',
                              width: `${device.risk_score || 0}%`,
                              background: device.risk_score > 70
                                ? 'var(--red-500)'
                                : device.risk_score > 40
                                  ? 'var(--orange-500)'
                                  : 'var(--green-500)',
                              borderRadius: '0.2143rem',
                            }} />
                          </div>
                          <span style={{ fontSize: '0.8571rem', color: 'var(--slate-500)' }}>{device.risk_score || 0}%</span>
                        </div>
                      </td>
                      <td className="text-muted" style={{ fontSize: '0.8571rem' }}>
                        {device.createdAt ? formatDate(device.createdAt) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {total > 0 && devices.length > 0 && (
          <div className="pagination-wrapper">
            <VPagination
              page={page}
              perPage={perPage}
              total={total}
              dataLength={devices.length}
              itemName={t('customer.devices.item_name')}
              onPageChange={(newPage) => setPage(newPage)}
              onPerPageChange={(newPerPage) => { setPerPage(newPerPage); setPage(1); }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerDevices;

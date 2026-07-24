import React, { useState, useEffect } from 'react';
import { Bell, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import alertsApi from '@/api/alerts';
import { toast } from '@/utils/toast';
import VHeaderPage from '@/components/VHeaderPage';
import VNoData from '@/components/VNoData';
import VPagination from '@/components/VPagination';
import VButton from '@/components/VButton';
import { formatDate } from '@/utils/formatDate';

const severityColor = { critical: 'var(--red-500)', high: 'var(--orange-500)', medium: 'var(--yellow-500)', low: 'var(--green-500)', info: 'var(--blue-500)' };
const statusColor = { new: 'var(--red-500)', acknowledged: 'var(--orange-500)', resolved: 'var(--green-500)', false_positive: 'var(--custom-color-14)' };

const CustomerAlerts = () => {
  const { t } = useTranslation();
  const statusLabel = { new: t('customer.status.new', 'Mới'), acknowledged: t('customer.status.acknowledged', 'Đã xem'), resolved: t('customer.status.resolved', 'Đã xử lý'), false_positive: t('customer.status.false_positive', 'Sai') };

  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(15);
  const [total, setTotal] = useState(0);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const res = await alertsApi.getAllAlerts({ page, limit: perPage });
      setAlerts(res.data || res.alerts || []);
      setTotal(res.total || 0);
    } catch {
      toast.error(t('customer.alerts.fetch_error', 'Không thể tải danh sách cảnh báo'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAlerts(); }, [page, perPage]);

  const handleUpdateStatus = async (id, status) => {
    setUpdating(id);
    try {
      await alertsApi.updateAlertStatus(id, status);
      toast.success(t('customer.alerts.update_success', 'Cập nhật trạng thái thành công'));
      fetchAlerts();
    } catch (e) {
      toast.error(e?.response?.data?.message || t('customer.alerts.update_error', 'Lỗi cập nhật trạng thái'));
    } finally {
      setUpdating(null);
    }
  };

  return (
    <div className="assets-page">
      <VHeaderPage 
        title={t('customer.alerts.title', 'Cảnh báo')}
        action={
          <VButton onClick={fetchAlerts} variant="outline" style={{ display: 'flex', alignItems: 'center', gap: '0.4286rem' }}>
            <RefreshCw size={15} /> {t('customer.common.refresh', 'Làm mới')}
          </VButton>
        }
      />

      <div style={{ background: 'var(--white)', borderRadius: '0.8571rem', border: '0.0714rem solid var(--slate-200)', overflow: 'hidden', boxShadow: '0 0.2857rem 0.4286rem -0.0714rem rgba(0, 0, 0, 0.05)' }}>
        {loading ? (
          <div style={{ padding: '2.8571rem', textAlign: 'center', color: 'var(--slate-500)' }}>{t('customer.common.loading', 'Đang tải...')}</div>
        ) : alerts.length === 0 ? (
          <VNoData title={t('customer.alerts.no_data', 'Không có cảnh báo nào')} />
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--slate-50)' }}>
                {[
                  t('customer.alerts.col_title', 'Tiêu đề'),
                  t('customer.alerts.col_source', 'Nguồn'),
                  t('customer.alerts.col_severity', 'Severity'),
                  t('customer.alerts.col_status', 'Trạng thái'),
                  t('customer.alerts.col_time', 'Thời gian'),
                  t('customer.alerts.col_action', 'Hành động')
                ].map((h, index) => (
                  <th key={index} style={{ padding: '0.8571rem 1.1429rem', textAlign: 'left', fontSize: '0.9286rem', color: 'var(--slate-800)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.0357rem', borderBottom: '0.0714rem solid var(--slate-200)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {alerts.map((alert, i) => (
                <tr key={alert._id} style={{ borderBottom: i < alerts.length - 1 ? '0.0714rem solid var(--slate-200)' : 'none', background: 'var(--white)', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--slate-50)'} onMouseLeave={e => e.currentTarget.style.background = 'var(--white)'}>
                  <td style={{ padding: '1rem 1.1429rem' }}>
                    <span style={{ fontSize: '1rem', fontWeight: '500', color: 'var(--slate-900)' }}>{alert.title || alert.rule_name || t('customer.alerts.default_alert', 'Alert')}</span>
                  </td>
                  <td style={{ padding: '1rem 1.1429rem', fontSize: '0.9286rem', color: 'var(--slate-500)', fontFamily: 'monospace' }}>{alert.source_ip || alert.device_name || '—'}</td>
                  <td style={{ padding: '1rem 1.1429rem' }}>
                    <span style={{ padding: '0.2143rem 0.7143rem', borderRadius: '1.4286rem', fontSize: '0.7857rem', fontWeight: '600', background: `${severityColor[alert.severity] || 'var(--custom-color-14)'}22`, color: severityColor[alert.severity] || 'var(--custom-color-14)', textTransform: 'uppercase' }}>{alert.severity}</span>
                  </td>
                  <td style={{ padding: '1rem 1.1429rem' }}>
                    <span style={{ padding: '0.2143rem 0.7143rem', borderRadius: '1.4286rem', fontSize: '0.7857rem', fontWeight: '600', background: `${statusColor[alert.status] || 'var(--custom-color-14)'}22`, color: statusColor[alert.status] || 'var(--custom-color-14)' }}>{statusLabel[alert.status] || alert.status}</span>
                  </td>
                  <td style={{ padding: '1rem 1.1429rem', fontSize: '0.8571rem', color: 'var(--slate-500)' }}>
                    {alert.createdAt ? formatDate(alert.createdAt) : '—'}
                  </td>
                  <td style={{ padding: '1rem 1.1429rem' }}>
                    <div style={{ display: 'flex', gap: '0.4286rem' }}>
                      {alert.status === 'new' && (
                        <button
                          onClick={() => handleUpdateStatus(alert._id, 'acknowledged')}
                          disabled={updating === alert._id}
                          title={t('customer.alerts.btn_ack_title', 'Acknowledge')}
                          style={{ padding: '0.3571rem 0.7143rem', borderRadius: '0.4286rem', border: 'none', background: 'rgba(249,115,22,0.15)', color: 'var(--orange-500)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2857rem', fontSize: '0.8571rem' }}
                        >
                          <CheckCircle size={13} /> {t('customer.alerts.btn_ack', 'ACK')}
                        </button>
                      )}
                      {(alert.status === 'new' || alert.status === 'acknowledged') && (
                        <button
                          onClick={() => handleUpdateStatus(alert._id, 'resolved')}
                          disabled={updating === alert._id}
                          title={t('customer.alerts.btn_resolve_title', 'Resolve')}
                          style={{ padding: '0.3571rem 0.7143rem', borderRadius: '0.4286rem', border: 'none', background: 'rgba(34,197,94,0.15)', color: 'var(--green-500)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2857rem', fontSize: '0.8571rem' }}
                        >
                          <XCircle size={13} /> {t('customer.alerts.btn_resolve', 'Resolve')}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {total > 0 && alerts.length > 0 && (
          <div style={{ borderTop: '0.0714rem solid var(--slate-200)', background: 'var(--slate-50)' }}>
            <VPagination 
              page={page}
              perPage={perPage}
              total={total}
              dataLength={alerts.length}
              itemName={t('customer.alerts.item_name', 'cảnh báo')}
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

export default CustomerAlerts;

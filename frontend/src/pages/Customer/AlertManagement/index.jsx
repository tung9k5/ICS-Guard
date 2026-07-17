import React, { useState, useEffect } from 'react';
import { Bell, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import alertsApi from '@/api/alerts';
import { toast } from '@/utils/toast';
import VHeaderPage from '@/components/VHeaderPage';
import VNodata from '@/components/VNodata';
import VPagination from '@/components/VPagination';
import VButton from '@/components/VButton';
import { formatDate } from '@/utils/formatDate';

const severityColor = { critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e', info: '#3b82f6' };
const statusColor = { new: '#ef4444', acknowledged: '#f97316', resolved: '#22c55e', false_positive: '#6b7280' };

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
          <VButton onClick={fetchAlerts} variant="outline" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={15} /> {t('customer.common.refresh', 'Làm mới')}
          </VButton>
        }
      />

      <div style={{ background: 'var(--white)', borderRadius: '12px', border: '1px solid var(--slate-200)', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--slate-500)' }}>{t('customer.common.loading', 'Đang tải...')}</div>
        ) : alerts.length === 0 ? (
          <VNodata title={t('customer.alerts.no_data', 'Không có cảnh báo nào')} />
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
                  <th key={index} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '13px', color: 'var(--slate-800)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid var(--slate-200)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {alerts.map((alert, i) => (
                <tr key={alert._id} style={{ borderBottom: i < alerts.length - 1 ? '1px solid var(--slate-200)' : 'none', background: 'var(--white)', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--slate-50)'} onMouseLeave={e => e.currentTarget.style.background = 'var(--white)'}>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ fontSize: '14px', fontWeight: '500', color: 'var(--slate-900)' }}>{alert.title || alert.rule_name || t('customer.alerts.default_alert', 'Alert')}</span>
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--slate-500)', fontFamily: 'monospace' }}>{alert.source_ip || alert.device_name || '—'}</td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', background: `${severityColor[alert.severity] || '#6b7280'}22`, color: severityColor[alert.severity] || '#6b7280', textTransform: 'uppercase' }}>{alert.severity}</span>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', background: `${statusColor[alert.status] || '#6b7280'}22`, color: statusColor[alert.status] || '#6b7280' }}>{statusLabel[alert.status] || alert.status}</span>
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: '12px', color: 'var(--slate-500)' }}>
                    {alert.createdAt ? formatDate(alert.createdAt) : '—'}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {alert.status === 'new' && (
                        <button
                          onClick={() => handleUpdateStatus(alert._id, 'acknowledged')}
                          disabled={updating === alert._id}
                          title={t('customer.alerts.btn_ack_title', 'Acknowledge')}
                          style={{ padding: '5px 10px', borderRadius: '6px', border: 'none', background: 'rgba(249,115,22,0.15)', color: '#f97316', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}
                        >
                          <CheckCircle size={13} /> {t('customer.alerts.btn_ack', 'ACK')}
                        </button>
                      )}
                      {(alert.status === 'new' || alert.status === 'acknowledged') && (
                        <button
                          onClick={() => handleUpdateStatus(alert._id, 'resolved')}
                          disabled={updating === alert._id}
                          title={t('customer.alerts.btn_resolve_title', 'Resolve')}
                          style={{ padding: '5px 10px', borderRadius: '6px', border: 'none', background: 'rgba(34,197,94,0.15)', color: '#22c55e', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}
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
          <div style={{ borderTop: '1px solid var(--slate-200)', background: 'var(--slate-50)' }}>
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

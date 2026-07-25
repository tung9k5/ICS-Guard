import React, { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import alertsApi from '@/api/alerts';
import { toast } from '@/utils/toast';
import VHeaderPage from '@/components/VHeaderPage';
import VNoData from '@/components/VNoData';
import VPagination from '@/components/VPagination';
import VButton from '@/components/VButton';
import { formatDate } from '@/utils/formatDate';
import '../Customer.scss';

const severityColor = {
  critical: 'var(--red-500)',
  high: 'var(--orange-500)',
  medium: 'var(--yellow-500)',
  low: 'var(--green-500)',
  info: 'var(--blue-500)',
};
const statusColor = {
  new: 'var(--red-500)',
  acknowledged: 'var(--orange-500)',
  resolved: 'var(--green-500)',
  false_positive: 'var(--custom-color-14)',
};

const CustomerAlerts = () => {
  const { t } = useTranslation();

  const statusLabel = {
    new: t('customer.status.new'),
    acknowledged: t('customer.status.acknowledged'),
    resolved: t('customer.status.resolved'),
    false_positive: t('customer.status.false_positive'),
  };

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
      toast.error(t('customer.alerts.fetch_error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAlerts(); }, [page, perPage]);

  const handleUpdateStatus = async (id, status) => {
    setUpdating(id);
    try {
      await alertsApi.updateAlertStatus(id, status);
      toast.success(t('customer.alerts.update_success'));
      fetchAlerts();
    } catch (e) {
      toast.error(e?.response?.data?.message || t('customer.alerts.update_error'));
    } finally {
      setUpdating(null);
    }
  };

  return (
    <div className="customer-page-wrapper">
      <VHeaderPage
        title={t('customer.alerts.title')}
        action={
          <VButton onClick={fetchAlerts} variant="outline" icon={RefreshCw}>
            {t('customer.common.refresh')}
          </VButton>
        }
      />

      <div style={{ background: 'var(--white)', borderRadius: '0.8571rem', border: '0.0714rem solid var(--slate-200)', overflow: 'hidden', boxShadow: '0 0.2857rem 0.4286rem -0.0714rem rgba(0, 0, 0, 0.05)' }}>
        {loading ? (
          <div className="device-loading">
            <span>{t('customer.common.loading')}</span>
          </div>
        ) : alerts.length === 0 ? (
          <VNoData title={t('customer.alerts.no_data')} />
        ) : (
          <div className="device-list-container">
            <div className="device-table-wrapper">
              <table className="device-table">
                <thead>
              <tr style={{ background: 'var(--slate-50)' }}>
                    {[
                      t('customer.alerts.col_title'),
                      t('customer.alerts.col_source'),
                      t('customer.alerts.col_severity'),
                      t('customer.alerts.col_status'),
                      t('customer.alerts.col_time'),
                      t('customer.alerts.col_action'),
                    ].map((h, i) => <th key={i}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {alerts.map((alert) => (
                    <tr key={alert._id}>
                      <td>
                        <span style={{ fontWeight: 500, color: 'var(--slate-900)' }}>
                          {alert.title || alert.rule_name || t('customer.alerts.default_alert')}
                        </span>
                      </td>
                      <td className="text-muted" style={{ fontFamily: 'monospace' }}>
                        {alert.source_ip || alert.device_name || '—'}
                      </td>
                      <td>
                        <span style={{
                          padding: '0.2143rem 0.7143rem',
                          borderRadius: '1.4286rem',
                          fontSize: '0.7857rem',
                          fontWeight: 600,
                          background: `${severityColor[alert.severity] || 'var(--custom-color-14)'}22`,
                          color: severityColor[alert.severity] || 'var(--custom-color-14)',
                          textTransform: 'uppercase',
                        }}>
                          {alert.severity}
                        </span>
                      </td>
                      <td>
                        <span style={{
                          padding: '0.2143rem 0.7143rem',
                          borderRadius: '1.4286rem',
                          fontSize: '0.7857rem',
                          fontWeight: 600,
                          background: `${statusColor[alert.status] || 'var(--custom-color-14)'}22`,
                          color: statusColor[alert.status] || 'var(--custom-color-14)',
                        }}>
                          {statusLabel[alert.status] || alert.status}
                        </span>
                      </td>
                      <td className="text-muted" style={{ fontSize: '0.8571rem' }}>
                        {alert.createdAt ? formatDate(alert.createdAt) : '—'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.4286rem' }}>
                          {alert.status === 'new' && (
                            <VButton
                              variant="ghost"
                              size="sm"
                              icon={CheckCircle}
                              onClick={() => handleUpdateStatus(alert._id, 'acknowledged')}
                              disabled={updating === alert._id}
                              title={t('customer.alerts.btn_ack_title')}
                            >
                              {t('customer.alerts.btn_ack')}
                            </VButton>
                          )}
                          {(alert.status === 'new' || alert.status === 'acknowledged') && (
                            <VButton
                              variant="ghost"
                              size="sm"
                              icon={XCircle}
                              onClick={() => handleUpdateStatus(alert._id, 'resolved')}
                              disabled={updating === alert._id}
                              title={t('customer.alerts.btn_resolve_title')}
                            >
                              {t('customer.alerts.btn_resolve')}
                            </VButton>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {total > 0 && alerts.length > 0 && (
          <div className="pagination-wrapper">
            <VPagination
              page={page}
              perPage={perPage}
              total={total}
              dataLength={alerts.length}
              itemName={t('customer.alerts.item_name')}
              onPageChange={(newPage) => setPage(newPage)}
              onPerPageChange={(newPerPage) => { setPerPage(newPerPage); setPage(1); }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerAlerts;

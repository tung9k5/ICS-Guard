import React, { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import alertsApi from '@/api/alerts';
import { toast } from '@/utils/toast';
import VHeaderPage from '@/components/VHeaderPage';
import VNoData from '@/components/VNoData';
import { getScenarioLabel } from '@/constants/deviceConstants';
import VPagination from '@/components/VPagination';
import VButton from '@/components/VButton';
import ActionMenu from '@/components/ActionMenu';
import VStatus from '@/components/VStatus';
import { getSeverityProps, getAlertStatusProps, getScenarioProps } from '@/utils/statusMapper';
import { formatDate } from '@/utils/formatDate';
import { useExpandable } from '@/hooks/useExpandable';
import '../index.scss';
import '../DeviceManagement/DeviceManagement.scss';

const CustomerAlerts = () => {
  const { t } = useTranslation();

  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(15);
  const [total, setTotal] = useState(0);
  const { expandedId, toggleExpand } = useExpandable();

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const res = await alertsApi.getAllAlerts({ page, limit: perPage });
      setAlerts(res.data || res.alerts || []);
      setTotal(res.pagination?.total || res.total || 0);
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
    <div className="assets-page">
      <VHeaderPage
        title={t('customer.alerts.title')}
        action={
          <VButton onClick={fetchAlerts} variant="outline" icon={RefreshCw}>
            {t('customer.common.refresh')}
          </VButton>
        }
      />

      <div className="assets-content">
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
                  <tr>
                    {[
                      t('customer.alerts.col_id', 'ID'),
                      t('customer.alerts.col_title'),
                      t('customer.alerts.col_source'),
                      t('customer.alerts.col_severity'),
                      t('customer.alerts.col_simulation', 'Mô phỏng'),
                      t('customer.alerts.col_status'),
                      t('customer.alerts.col_time'),
                      t('customer.alerts.col_action'),
                    ].map((h, i) => <th key={i}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {alerts.map((alert) => (
                    <tr key={alert._id}>
                      <td><strong>{alert.alert_code || `${alert._id.substring(0, 8)}...`}</strong></td>
                      <td style={{ maxWidth: '14.2857rem' }}>
                        <div className="truncate-text" style={{ fontWeight: 500, color: 'var(--slate-900)' }} title={alert.title || alert.rule_name || t('customer.alerts.default_alert')}>
                          {alert.title || alert.rule_name || t('customer.alerts.default_alert')}
                        </div>
                      </td>
                      <td className="text-muted" style={{ fontFamily: 'monospace', maxWidth: '10.7143rem' }}>
                        <div className="truncate-text" title={alert.device_id?.name || alert.device_name || alert.source_ip || '—'}>
                          {alert.device_id?.name || alert.device_name || alert.source_ip || '—'}
                        </div>
                      </td>
                      <td>
                        <VStatus {...getSeverityProps(alert.severity, t)} className="uppercase" />
                      </td>
                      <td>
                        <VStatus {...getScenarioProps(alert.device_id?.current_scenario, t)} />
                      </td>
                      <td>
                        <VStatus {...getAlertStatusProps(alert.status, t)} />
                      </td>
                      <td className="text-muted" style={{ fontSize: '0.8571rem' }}>
                        {alert.createdAt ? formatDate(alert.createdAt) : '—'}
                      </td>
                      <td>
                        {(() => {
                          const actions = [
                            {
                              label: t('customer.alerts.btn_ack'),
                              icon: CheckCircle,
                              onClick: () => handleUpdateStatus(alert._id, 'acknowledged'),
                              disabled: alert.status !== 'new',
                              style: alert.status === 'new' ? { color: 'var(--blue-600)' } : {}
                            },
                            {
                              label: t('customer.alerts.btn_resolve'),
                              icon: XCircle,
                              onClick: () => handleUpdateStatus(alert._id, 'resolved'),
                              disabled: !(alert.status === 'new' || alert.status === 'acknowledged'),
                              style: (alert.status === 'new' || alert.status === 'acknowledged') ? { color: 'var(--green-600)' } : {}
                            }
                          ];
                          return <ActionMenu actions={actions} direction="down" />;
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* --- MOBILE LIST VIEW --- */}
            <div className="mobile-device-list">
              <div className="mobile-list-header" style={{ display: 'flex', alignItems: 'center' }}>
                <div className="col-id">{t('customer.alerts.col_id', 'ID')}</div>
                <div className="col-title">{t('customer.alerts.col_title')}</div>
                <div className="col-action"></div>
              </div>
              
              {alerts.map((alert) => {
                const id = alert._id;
                const isExpanded = expandedId === id;

                return (
                  <div className={`mobile-card ${isExpanded ? 'expanded' : ''}`} key={id}>
                    {/* Card Header */}
                    <div className="mobile-card-header" style={{ display: 'flex', alignItems: 'center', paddingLeft: '1rem' }}>
                      <div className="col-id" onClick={() => toggleExpand(id)}><strong>{alert.alert_code || `${id.substring(0, 8)}...`}</strong></div>
                      <div className="col-title truncate-text" onClick={() => toggleExpand(id)}>{alert.title || alert.rule_name || t('customer.alerts.default_alert')}</div>
                      <div className="col-action" onClick={() => toggleExpand(id)}>
                        {isExpanded ? <ChevronUp size={20} className="expand-icon" /> : <ChevronDown size={20} className="expand-icon" />}
                      </div>
                    </div>
                    
                    {/* Card Body */}
                    {isExpanded && (
                      <div className="mobile-card-body">
                        <div className="detail-row">
                          <span className="detail-label">{t('customer.alerts.col_source')}</span>
                          <span className="detail-value">{alert.device_id?.name || alert.device_name || alert.source_ip || '—'}</span>
                        </div>
                        <div className="detail-row">
                          <span className="detail-label">{t('customer.alerts.col_severity')}</span>
                          <span className="detail-value">
                            <VStatus {...getSeverityProps(alert.severity, t)} className="uppercase" />
                          </span>
                        </div>
                        <div className="detail-row">
                          <span className="detail-label">{t('customer.alerts.col_simulation', 'Mô phỏng')}</span>
                          <span className="detail-value">
                            <VStatus {...getScenarioProps(alert.device_id?.current_scenario, t)} />
                          </span>
                        </div>
                        <div className="detail-row">
                          <span className="detail-label">{t('customer.alerts.col_status')}</span>
                          <span className="detail-value">
                            <VStatus {...getAlertStatusProps(alert.status, t)} />
                          </span>
                        </div>
                        <div className="detail-row">
                          <span className="detail-label">{t('customer.alerts.col_time')}</span>
                          <span className="detail-value">{alert.createdAt ? formatDate(alert.createdAt) : '—'}</span>
                        </div>
                        <div className="detail-row" style={{ marginTop: '1rem', justifyContent: 'flex-end', gap: '0.5rem', display: 'flex' }}>
                          {(() => {
                            const actions = [
                              {
                                label: t('customer.alerts.btn_ack'),
                                icon: CheckCircle,
                                onClick: () => handleUpdateStatus(alert._id, 'acknowledged'),
                                disabled: alert.status !== 'new',
                                style: alert.status === 'new' ? { color: 'var(--blue-600)' } : {}
                              },
                              {
                                label: t('customer.alerts.btn_resolve'),
                                icon: XCircle,
                                onClick: () => handleUpdateStatus(alert._id, 'resolved'),
                                disabled: !(alert.status === 'new' || alert.status === 'acknowledged'),
                                style: (alert.status === 'new' || alert.status === 'acknowledged') ? { color: 'var(--green-600)' } : {}
                              }
                            ];
                            return <ActionMenu actions={actions} direction="up" />;
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {total > 0 && alerts.length > 0 && (
          <VPagination
            page={page}
            perPage={perPage}
            total={total}
            dataLength={alerts.length}
            itemName={t('customer.alerts.item_name')}
            onPageChange={(newPage) => setPage(newPage)}
            onPerPageChange={(newPerPage) => { setPerPage(newPerPage); setPage(1); }}
          />
        )}
      </div>
    </div>
  );
};

export default CustomerAlerts;

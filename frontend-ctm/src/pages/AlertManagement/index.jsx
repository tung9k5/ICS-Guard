import React, { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle, XCircle, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import alertsApi from '@/api/alerts';
import { toast } from '@/utils/toast';
import VHeaderPage from '@/components/VHeaderPage';
import VFilterPage from '@/components/VFilterPage';
import VNoData from '@/components/VNoData';
import { getScenarioLabel } from '@/constants/deviceConstants';
import VPagination from '@/components/VPagination';
import VButton from '@/components/VButton';
import ActionMenu from '@/components/ActionMenu';
import VStatus from '@/components/VStatus';
import { getSeverityProps, getAlertStatusProps, getScenarioProps, getScenarioFromRule } from '@/utils/statusMapper';
import { formatDate } from '@/utils/formatDate';
import { Trash2, X } from 'lucide-react';
import { useSelection } from '@/hooks/useSelection';
import { useFetchList } from '@/hooks/useFetchList';
import { useExpandable } from '@/hooks/useExpandable';
import DeleteConfirmModal from '@/components/DeleteConfirmModal';
import VCheckbox from '@/components/VCheckbox';
import { SEVERITY_OPTIONS, ALERT_STATUS_OPTIONS, SIMULATOR_OPTIONS, SORT_OPTIONS } from '@/constants/filterConstants';
import AlertDetailModal from './components/AlertDetailModal';
import '../index.scss';
import '../DeviceManagement/DeviceManagement.scss';

const CustomerAlerts = () => {
  const { t } = useTranslation();

  const {
    data: alerts,
    total,
    isLoading: loading,
    search,
    handleSearchChange,
    order,
    setOrder,
    page,
    setPage,
    perPage,
    setPerPage,
    filters,
    handleFilterChange,
    fetchData: fetchAlerts
  } = useFetchList({
    fetchFn: alertsApi.getAllAlerts,
    initialFilters: { severity: '', status: '', rule_name: '' },
    errorMessageKey: 'customer.alerts.fetch_error'
  });

  const [updating, setUpdating] = useState(null);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const { expandedId, toggleExpand } = useExpandable();
  const { selectedIds, handleSelect, handleSelectAll, clearSelection } = useSelection(alerts, '_id');

  useEffect(() => {
    clearSelection();
  }, [alerts, clearSelection]);

  const [deleteModalState, setDeleteModalState] = useState({
    isOpen: false,
    items: [],
    loading: false
  });

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

  const handleDelete = (alert) => {
    setDeleteModalState({
      isOpen: true,
      items: [alert],
      loading: false
    });
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    const itemsToDelete = alerts.filter(a => selectedIds.includes(a._id));
    setDeleteModalState({
      isOpen: true,
      items: itemsToDelete.length > 0 ? itemsToDelete : selectedIds.map(_id => ({ _id })),
      loading: false
    });
  };

  const handleConfirmDelete = async () => {
    const { items } = deleteModalState;
    if (!items || items.length === 0) return;

    setDeleteModalState(prev => ({ ...prev, loading: true }));
    try {
      if (items.length === 1) {
        await alertsApi.deleteAlert(items[0]._id);
        toast.success(t('customer.alerts.delete_success', 'Đã xoá cảnh báo'));
      } else {
        await alertsApi.deleteMultipleAlerts(items.map(i => i._id));
        toast.success(t('customer.alerts.bulk_delete_success', 'Đã xoá các cảnh báo đã chọn'));
      }
      clearSelection();
      setPage(1);
      fetchAlerts();
    } catch (error) {
      toast.error(error?.response?.data?.message || t('customer.alerts.delete_error', 'Lỗi khi xoá cảnh báo'));
    } finally {
      setDeleteModalState(prev => ({ ...prev, isOpen: false, loading: false }));
    }
  };

  return (
    <div className="assets-page">
      <VHeaderPage
        title={t('customer.alerts.title')}
        action={
          <div style={{ display: 'flex', gap: '0.8571rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {selectedIds.length > 0 && (
              <VButton variant="danger" onClick={handleBulkDelete} style={{ flex: '1 1 auto', whiteSpace: 'nowrap' }}>
                <Trash2 size={18} />
                {t('common.delete')} ({selectedIds.length})
              </VButton>
            )}
            <VButton onClick={fetchAlerts} variant="outline" icon={RefreshCw} style={{ flex: '1 1 auto', whiteSpace: 'nowrap' }}>
              {t('customer.common.refresh')}
            </VButton>
          </div>
        }
      />

      <div className="assets-content">
        <VFilterPage 
          searchPlaceholder={t('common.search', 'Tìm kiếm...')}
          searchValue={search}
          onSearchChange={(e) => handleSearchChange(e.target.value)}
        >
          <div className="filter-select-wrapper">
            <select 
              className="v-filter-select" 
              value={filters.severity} 
              onChange={(e) => handleFilterChange('severity', e.target.value)}
            >
              <option value="">{t('alerts.filter_severity', 'Tất cả mức độ')}</option>
              {SEVERITY_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            {filters.severity && (
              <X 
                size={14} 
                className="clear-icon"
                onClick={() => handleFilterChange('severity', '')}
              />
            )}
          </div>

          <div className="filter-select-wrapper">
            <select 
              className="v-filter-select" 
              value={filters.rule_name} 
              onChange={(e) => handleFilterChange('rule_name', e.target.value)}
            >
              <option value="">{t('simulator.filter_scenario_all', 'Tất cả mô phỏng')}</option>
              {SIMULATOR_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            {filters.rule_name && (
              <X 
                size={14} 
                className="clear-icon"
                onClick={() => handleFilterChange('rule_name', '')}
              />
            )}
          </div>

          <div className="filter-select-wrapper">
            <select 
              className="v-filter-select" 
              value={filters.status} 
              onChange={(e) => handleFilterChange('status', e.target.value)}
            >
              <option value="">{t('alerts.filter_status', 'Tất cả trạng thái')}</option>
              {ALERT_STATUS_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            {filters.status && (
              <X 
                size={14} 
                className="clear-icon"
                onClick={() => handleFilterChange('status', '')}
              />
            )}
          </div>

          <select 
            className="v-filter-select" 
            value={order} 
            onChange={(e) => {
              setOrder(e.target.value);
              setPage(1);
            }}
          >
            {SORT_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </VFilterPage>

        {alerts.length === 0 && !search && !filters.severity && !filters.status && !filters.rule_name ? (
          <VNoData message={t('customer.alerts.no_data')} />
        ) : (
          <div className="device-list-container">
            <div className="device-table-wrapper">
              <table className="device-table">
                <thead>
                  <tr>
                    <th style={{ width: '4%', textAlign: 'center' }}>
                      <VCheckbox 
                        indeterminate={selectedIds.length > 0 && selectedIds.length < alerts.length}
                        checked={alerts.length > 0 && selectedIds.length === alerts.length}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        style={{ cursor: 'pointer' }}
                      />
                    </th>
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
                    <tr key={alert._id} className={selectedIds.includes(alert._id) ? 'selected-row' : ''}>
                      <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                        <VCheckbox 
                          checked={selectedIds.includes(alert._id)}
                          onChange={(e) => handleSelect(alert._id, e.target.checked)}
                          style={{ cursor: 'pointer' }}
                        />
                      </td>
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
                        <VStatus {...getScenarioProps(getScenarioFromRule(alert.rule_name), t)} />
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
                              label: t('common.btn_view_details', 'Xem chi tiết'),
                              icon: Info,
                              onClick: () => setSelectedAlert(alert),
                            },
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
                            },
                            {
                              label: t('common.delete', 'Xoá'),
                              icon: Trash2,
                              onClick: () => handleDelete(alert),
                              style: { color: 'var(--red-600)' }
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
                <div style={{ padding: '0 0.5rem 0 1rem' }}>
                  <input 
                    type="checkbox" 
                    checked={alerts.length > 0 && selectedIds.length === alerts.length}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                  />
                </div>
                <div className="col-id">{t('customer.alerts.col_id', 'ID')}</div>
                <div className="col-title">{t('customer.alerts.col_title')}</div>
                <div className="col-action"></div>
              </div>
              
              {alerts.map((alert) => {
                const id = alert._id;
                const isExpanded = expandedId === id;

                return (
                  <div className={`mobile-card ${isExpanded ? 'expanded' : ''} ${selectedIds.includes(id) ? 'selected' : ''}`} key={id}>
                    {/* Card Header */}
                    <div className="mobile-card-header" style={{ display: 'flex', alignItems: 'center', paddingLeft: '0' }}>
                      <div style={{ padding: '0 0.5rem 0 1rem' }} onClick={(e) => e.stopPropagation()}>
                        <input 
                          type="checkbox"
                          checked={selectedIds.includes(id)}
                          onChange={(e) => handleSelect(id, e.target.checked)}
                        />
                      </div>
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
                                label: t('common.btn_view_details', 'Xem chi tiết'),
                                icon: Info,
                                onClick: () => setSelectedAlert(alert),
                              },
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
                              },
                              {
                                label: t('common.delete', 'Xoá'),
                                icon: Trash2,
                                onClick: () => handleDelete(alert),
                                style: { color: 'var(--red-600)' }
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

      <AlertDetailModal 
        alert={selectedAlert} 
        onClose={() => setSelectedAlert(null)} 
      />

      <DeleteConfirmModal
        isOpen={deleteModalState.isOpen}
        onClose={() => setDeleteModalState(prev => ({ ...prev, isOpen: false }))}
        onConfirm={handleConfirmDelete}
        title={t('customer.alerts.delete_title', 'Xoá cảnh báo')}
        message={
          deleteModalState.items.length === 1
            ? t('customer.alerts.delete_confirm', 'Bạn có chắc chắn muốn xoá cảnh báo này không?')
            : t('customer.alerts.bulk_delete_confirm', 'Bạn có chắc chắn muốn xoá {{count}} cảnh báo đã chọn không?', { count: deleteModalState.items.length })
        }
        loading={deleteModalState.loading}
      />
    </div>
  );
};

export default CustomerAlerts;

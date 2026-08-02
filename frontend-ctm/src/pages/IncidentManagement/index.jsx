import React, { useState, useEffect } from 'react';
import { RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import incidentsApi from '@/api/incidents';
import { toast } from '@/utils/toast';
import VHeaderPage from '@/components/VHeaderPage';
import VFilterPage from '@/components/VFilterPage';
import VNoData from '@/components/VNoData';
import VPagination from '@/components/VPagination';
import VButton from '@/components/VButton';
import VStatus from '@/components/VStatus';
import { getSeverityProps, getIncidentStatusProps } from '@/utils/statusMapper';
import { formatDate } from '@/utils/formatDate';
import { useExpandable } from '@/hooks/useExpandable';
import ActionMenu from '@/components/ActionMenu';
import IncidentForm from '@/sections/IncidentManagement/IncidentForm';
import IncidentDetailModal from './components/IncidentDetailModal';
import { Info, Trash2, X } from 'lucide-react';
import { useSelection } from '@/hooks/useSelection';
import { useFetchList } from '@/hooks/useFetchList';
import DeleteConfirmModal from '@/components/DeleteConfirmModal';
import VCheckbox from '@/components/VCheckbox';
import { SEVERITY_OPTIONS, INCIDENT_STATUS_OPTIONS, SORT_OPTIONS } from '@/constants/filterConstants';
import '../index.scss';
import '../DeviceManagement/DeviceManagement.scss';
const CustomerIncidents = () => {
  const { t } = useTranslation();

  const {
    data: incidents,
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
    fetchData: fetchIncidents
  } = useFetchList({
    fetchFn: incidentsApi.getAll,
    initialFilters: { severity: '', status: '' },
    errorMessageKey: 'customer.incidents.fetch_error'
  });

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const { expandedId, toggleExpand } = useExpandable();
  const { selectedIds, handleSelect, handleSelectAll, clearSelection } = useSelection(incidents, '_id');

  useEffect(() => {
    clearSelection();
  }, [incidents, clearSelection]);

  const [deleteModalState, setDeleteModalState] = useState({
    isOpen: false,
    items: [],
    loading: false
  });

  const handleDelete = (incident) => {
    setDeleteModalState({
      isOpen: true,
      items: [incident],
      loading: false
    });
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    const itemsToDelete = incidents.filter(i => selectedIds.includes(i._id));
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
        await incidentsApi.delete(items[0]._id);
        toast.success(t('customer.incidents.delete_success', 'Đã xoá sự cố'));
      } else {
        await incidentsApi.deleteMultiple(items.map(i => i._id));
        toast.success(t('customer.incidents.bulk_delete_success', 'Đã xoá các sự cố đã chọn'));
      }
      clearSelection();
      setPage(1);
      fetchIncidents();
    } catch (error) {
      toast.error(error?.response?.data?.message || t('customer.incidents.delete_error', 'Lỗi khi xoá sự cố'));
    } finally {
      setDeleteModalState(prev => ({ ...prev, isOpen: false, loading: false }));
    }
  };

  useEffect(() => { fetchIncidents(); }, [page, perPage]);

  return (
    <div className="assets-page">
      <VHeaderPage
        title={t('customer.incidents.title')}
        action={
          <div style={{ display: 'flex', gap: '0.8571rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {selectedIds.length > 0 && (
              <VButton variant="danger" onClick={handleBulkDelete} style={{ flex: '1 1 auto', whiteSpace: 'nowrap' }}>
                <Trash2 size={18} />
                {t('common.delete')} ({selectedIds.length})
              </VButton>
            )}
            <VButton onClick={() => setIsFormOpen(true)} variant="primary" style={{ flex: '1 1 auto', whiteSpace: 'nowrap' }}>
              Báo cáo sự cố
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
              <option value="">{t('incidents.filter_severity_all', 'Tất cả mức độ')}</option>
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
              value={filters.status} 
              onChange={(e) => handleFilterChange('status', e.target.value)}
            >
              <option value="">{t('incidents.filter_status_all', 'Tất cả trạng thái')}</option>
              {INCIDENT_STATUS_OPTIONS.map(opt => (
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

        {incidents.length === 0 && !search && !filters.severity && !filters.status ? (
          <VNoData message={t('customer.incidents.no_data')} />
        ) : (
          <div className="device-list-container">
            {/* --- DESKTOP TABLE VIEW --- */}
            <div className="device-table-wrapper">
              <table className="device-table">
                <thead>
                  <tr>
                    <th style={{ width: '4%', textAlign: 'center' }}>
                      <VCheckbox 
                        indeterminate={selectedIds.length > 0 && selectedIds.length < incidents.length}
                        checked={incidents.length > 0 && selectedIds.length === incidents.length}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        style={{ cursor: 'pointer' }}
                      />
                    </th>
                    {[
                      t('customer.incidents.col_id', 'ID'),
                      t('customer.incidents.col_title'),
                      t('customer.incidents.col_description'),
                      t('customer.incidents.col_severity'),
                      t('customer.incidents.col_status'),
                      t('customer.incidents.col_time'),
                      t('customer.incidents.col_action', 'Thao tác'),
                    ].map((h, i) => <th key={i}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {incidents.map((incident) => (
                    <tr key={incident._id} className={selectedIds.includes(incident._id) ? 'selected-row' : ''}>
                      <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                        <VCheckbox 
                          checked={selectedIds.includes(incident._id)}
                          onChange={(e) => handleSelect(incident._id, e.target.checked)}
                          style={{ cursor: 'pointer' }}
                        />
                      </td>
                      <td><strong>{incident.incident_code || `${incident._id.substring(0, 8)}...`}</strong></td>
                      <td style={{ maxWidth: '15rem' }}>
                        <div className="truncate-text" style={{ fontWeight: 500, color: 'var(--slate-900)' }} title={incident.title}>
                          {incident.title}
                        </div>
                      </td>
                      <td style={{ maxWidth: '20rem' }}>
                        {incident.description && (
                          <div className="truncate-text" style={{ fontSize: '0.8571rem', color: 'var(--slate-500)' }} title={incident.description}>
                            {incident.description}
                          </div>
                        )}
                      </td>
                      <td>
                        <VStatus {...getSeverityProps(incident.severity, t)} className="uppercase" />
                      </td>
                      <td>
                        <VStatus {...getIncidentStatusProps(incident.status, t)} />
                      </td>
                      <td className="text-muted" style={{ fontSize: '0.8571rem' }}>
                        {incident.createdAt ? formatDate(incident.createdAt) : '—'}
                      </td>
                      <td>
                        {(() => {
                          const actions = [
                            {
                              label: t('common.btn_view_details', 'Xem chi tiết'),
                              icon: Info,
                              onClick: () => setSelectedIncident(incident),
                            },
                            {
                              label: t('common.delete', 'Xoá'),
                              icon: Trash2,
                              onClick: () => handleDelete(incident),
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
                    checked={incidents.length > 0 && selectedIds.length === incidents.length}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                  />
                </div>
                <div className="col-id">{t('customer.incidents.col_id', 'ID')}</div>
                <div className="col-title">{t('customer.incidents.col_title')}</div>
                <div className="col-action"></div>
              </div>
              
              {incidents.map((incident) => {
                const id = incident._id;
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
                      <div className="col-id" onClick={() => toggleExpand(id)}><strong>{incident.incident_code || `${id.substring(0, 8)}...`}</strong></div>
                      <div className="col-title truncate-text" onClick={() => toggleExpand(id)}>{incident.title}</div>
                      <div className="col-action" onClick={() => toggleExpand(id)}>
                        {isExpanded ? <ChevronUp size={20} className="expand-icon" /> : <ChevronDown size={20} className="expand-icon" />}
                      </div>
                    </div>
                    
                    {/* Card Body */}
                    {isExpanded && (
                      <div className="mobile-card-body">
                        {incident.description && (
                          <div className="detail-row">
                            <span className="detail-label">{t('customer.incidents.lbl_description')}</span>
                            <span className="detail-value" style={{ textAlign: 'right' }}>{incident.description}</span>
                          </div>
                        )}
                        <div className="detail-row">
                          <span className="detail-label">{t('customer.incidents.col_severity')}</span>
                          <span className="detail-value">
                            <VStatus {...getSeverityProps(incident.severity, t)} className="uppercase" />
                          </span>
                        </div>
                        <div className="detail-row">
                          <span className="detail-label">{t('customer.incidents.col_status')}</span>
                          <span className="detail-value">
                            <VStatus {...getIncidentStatusProps(incident.status, t)} />
                          </span>
                        </div>
                        <div className="detail-row">
                          <span className="detail-label">{t('customer.incidents.col_time')}</span>
                          <span className="detail-value">{incident.createdAt ? formatDate(incident.createdAt) : '—'}</span>
                        </div>
                        <div className="detail-row" style={{ marginTop: '1rem', justifyContent: 'flex-end', display: 'flex' }}>
                          {(() => {
                            const actions = [
                              {
                                label: t('common.btn_view_details', 'Xem chi tiết'),
                                icon: Info,
                                onClick: () => setSelectedIncident(incident),
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

        {total > 0 && incidents.length > 0 && (
          <VPagination
            page={page}
            perPage={perPage}
            total={total}
            dataLength={incidents.length}
            itemName={t('customer.incidents.item_name')}
            onPageChange={(newPage) => setPage(newPage)}
            onPerPageChange={(newPerPage) => { setPerPage(newPerPage); setPage(1); }}
          />
        )}
      </div>

      {isFormOpen && (
        <IncidentForm 
          onClose={() => setIsFormOpen(false)} 
          onSuccess={() => { setIsFormOpen(false); fetchIncidents(); }}
        />
      )}

      <IncidentDetailModal 
        incident={selectedIncident} 
        onClose={() => setSelectedIncident(null)} 
      />

      <DeleteConfirmModal
        isOpen={deleteModalState.isOpen}
        onClose={() => setDeleteModalState(prev => ({ ...prev, isOpen: false }))}
        onConfirm={handleConfirmDelete}
        title={t('customer.incidents.delete_title', 'Xoá sự cố')}
        message={
          deleteModalState.items.length === 1
            ? t('customer.incidents.delete_confirm', 'Bạn có chắc chắn muốn xoá sự cố này không?')
            : t('customer.incidents.bulk_delete_confirm', 'Bạn có chắc chắn muốn xoá {{count}} sự cố đã chọn không?', { count: deleteModalState.items.length })
        }
        loading={deleteModalState.loading}
      />
    </div>
  );
};

export default CustomerIncidents;

import React, { useState, useEffect, useCallback } from 'react';
import { Search } from 'lucide-react';
import alertsApi from '@/api/alerts';
import AlertList from '@/sections/AlertManagement/AlertList';
import DeleteConfirmModal from '@/Dialog/DeleteConfirmModal';
import VPagination from '@/components/VPagination';
import VHeaderPage from '@/components/VHeaderPage';
import VFilterPage from '@/components/VFilterPage';
import { toast } from '@/utils/toast';
import { useTranslation } from 'react-i18next';
import { useSelection } from '@/hooks/useSelection';
import { useFetchList } from '@/hooks/useFetchList';
import { DEFAULT_PAGE_SIZE } from '@/constants/uiConstants';
import { ALERT_SEVERITIES, ALERT_STATUSES } from '@/constants/alertConstants';
import VSelectFilter from '@/components/VSelectFilter';
import VButton from '@/components/VButton';
import { Trash2, X } from 'lucide-react';
import './AlertManagement.scss';

const AlertManagement = () => {
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
    initialFilters: { severity: '', status: '' },
    errorMessageKey: 'error_general'
  });

  const { selectedIds, handleSelect, handleSelectAll, clearSelection } = useSelection(alerts, 'id', '_id');
  
  useEffect(() => {
    clearSelection();
  }, [alerts, clearSelection]);
  
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [alertToDelete, setAlertToDelete] = useState(null);
  const [isBulkDelete, setIsBulkDelete] = useState(false);

  const confirmDelete = (alert) => {
    setAlertToDelete(alert);
    setIsBulkDelete(false);
    setIsDeleteModalOpen(true);
  };

  const handleBulkDeleteClick = () => {
    if (selectedIds.length === 0) return;
    setIsBulkDelete(true);
    setIsDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    try {
      if (isBulkDelete) {
        await alertsApi.deleteMultipleAlerts(selectedIds);
        toast.success(t('common.delete_success', 'Xóa thành công'));
        clearSelection();
      } else {
        if (!alertToDelete) return;
        await alertsApi.deleteAlert(alertToDelete._id);
        toast.success(t('common.delete_success', 'Xóa thành công'));
      }
      setIsDeleteModalOpen(false);
      fetchAlerts();
    } catch (error) {
      toast.error(t('error_general', 'Có lỗi xảy ra'));
    }
  };

  const handleUpdateStatus = async (alert, status) => {
    try {
      await alertsApi.updateAlertStatus(alert._id, status);
      toast.success(t('alerts.update_success', 'Cập nhật trạng thái thành công'));
      fetchAlerts();
    } catch (error) {
      toast.error(t('error_general', 'Có lỗi xảy ra'));
    }
  };

  return (
    <div className="alerts-page">
      <VHeaderPage 
        title={t('alerts.title', 'Quản lý Cảnh báo')}
        action={
          <div style={{ display: 'flex', gap: '0.8571rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {selectedIds.length > 0 && (
              <VButton variant="danger" onClick={handleBulkDeleteClick} style={{ flex: '1 1 auto', whiteSpace: 'nowrap' }}>
                <Trash2 size={18} />
                {t('incidents.btn_delete_selected', { count: selectedIds.length })}
              </VButton>
            )}
          </div>
        }
      />

      <div className="alerts-content">
        <VFilterPage 
          searchPlaceholder={t('alerts.search_placeholder', 'Tìm kiếm tiêu đề, mô tả...')}
          searchValue={search}
          onSearchChange={(e) => handleSearchChange(e.target.value)}
        >
          <div className="filter-select-wrapper">
            <select 
              className="v-filter-select" 
              value={filters.severity} 
              onChange={(e) => handleFilterChange('severity', e.target.value)}
              style={{ paddingRight: filters.severity ? '2rem' : undefined }}
            >
              <option value="">{t('alerts.filter_severity', 'Tất cả mức độ')}</option>
              {ALERT_SEVERITIES.map(sev => (
                <option key={sev.value} value={sev.value}>{sev.label}</option>
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
              style={{ paddingRight: filters.status ? '2rem' : undefined }}
            >
              <option value="">{t('alerts.filter_status', 'Tất cả trạng thái')}</option>
              {ALERT_STATUSES.map(stat => (
                <option key={stat.value} value={stat.value}>{stat.label}</option>
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
            <option value="desc">{t('alerts.filter_order_desc')}</option>
            <option value="asc">{t('alerts.filter_order_asc')}</option>
          </select>
        </VFilterPage>
        
        {loading ? (
          <div className="user-loading">{t('common.loading')}</div>
        ) : (
          <AlertList 
            alerts={alerts} 
            onUpdateStatus={handleUpdateStatus} 
            onDelete={confirmDelete}
            selectedIds={selectedIds}
            onSelect={handleSelect}
            onSelectAll={handleSelectAll}
          />
        )}
        
        {alerts && alerts.length > 0 && (
          <VPagination 
            page={page}
            perPage={perPage}
            total={total}
            dataLength={alerts.length}
            itemName={t('alerts.item_name')}
            onPageChange={(newPage) => setPage(newPage)}
            onPerPageChange={(newPerPage) => {
              setPerPage(newPerPage);
              setPage(1);
            }}
          />
        )}
      </div>

      <DeleteConfirmModal 
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDelete}
        title={t('alerts.confirm_delete', 'Xóa cảnh báo')}
        message={isBulkDelete 
          ? t('alerts.confirm_bulk_delete_msg', `Bạn có chắc chắn muốn xóa ${selectedIds.length} cảnh báo đã chọn?`)
          : t('alerts.confirm_delete_msg', 'Bạn có chắc chắn muốn xóa cảnh báo này?')}
      />
    </div>
  );
};

export default AlertManagement;

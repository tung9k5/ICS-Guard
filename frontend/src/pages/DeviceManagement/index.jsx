import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Server, Filter, X, Trash2 } from 'lucide-react';
import VButton from '@/components/VButton';
import VInput from '@/components/VInput';
import ApiDevice from '@/api/device';
import DeviceList from '@/sections/DeviceManagement/DeviceList';
import DeviceForm from '@/sections/DeviceManagement/DeviceForm';
import DeleteConfirmModal from '@/Dialog/DeleteConfirmModal';
import VPagination from '@/components/VPagination';
import VHeaderPage from '@/components/VHeaderPage';
import VFilterPage from '@/components/VFilterPage';
import { DEVICE_TYPES } from '@/constants/deviceConstants';
import { toast } from '@/utils/toast';
import { useTranslation } from 'react-i18next';
import { useSelection } from '@/hooks/useSelection';
import { useFetchList } from '@/hooks/useFetchList';
import { DEFAULT_PAGE_SIZE } from '@/constants/uiConstants';
import './DeviceManagement.scss';
 
const DeviceManagement = () => {
  const { t } = useTranslation();
  const {
    data: devices,
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
    fetchData: fetchDevices
  } = useFetchList({
    fetchFn: ApiDevice.getAll,
    initialFilters: { status: '', type: '' },
    errorMessageKey: 'assets.fetch_error'
  });

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState(null);
  const { selectedIds, handleSelect, handleSelectAll, clearSelection } = useSelection(devices, 'id', '_id');
  
  // Clear selection when data changes
  useEffect(() => {
    clearSelection();
  }, [devices, clearSelection]);
  
  // Delete Modal State
  const [deleteModalState, setDeleteModalState] = useState({
    isOpen: false,
    items: [],
    loading: false
  });

  const handleAddDevice = () => {
    setEditingDevice(null);
    setIsFormOpen(true);
  };

  const handleEditDevice = (device) => {
    setEditingDevice(device);
    setIsFormOpen(true);
  };

  const handleDeleteDevice = (id) => {
    const deviceToDelete = devices.find(d => (d.id || d._id) === id) || { id };
    setDeleteModalState({
      isOpen: true,
      items: [deviceToDelete],
      loading: false
    });
  };

  const handleViewDevice = (device) => {
    toast.info(t('assets.view_details', { name: device.name, ip: device.ip_address }));
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    const devicesToDelete = devices.filter(d => selectedIds.includes(d.id || d._id));
    setDeleteModalState({
      isOpen: true,
      items: devicesToDelete.length > 0 ? devicesToDelete : selectedIds.map(id => ({ id })),
      loading: false
    });
  };

  const handleConfirmDelete = async () => {
    const { items } = deleteModalState;
    if (!items || items.length === 0) return;

    setDeleteModalState(prev => ({ ...prev, loading: true }));

    try {
      if (items.length === 1) {
        const id = items[0].id || items[0]._id;
        await ApiDevice.delete(id);
        toast.success(t('common.delete_success', 'Xóa thành công'));
      } else {
        const ids = items.map(i => i.id || i._id);
        await ApiDevice.deleteMultiple(ids);
        toast.success(t('common.delete_success', 'Xóa thành công'));
        clearSelection();
      }
      fetchDevices();
    } catch (err) {
      console.error('Delete error:', err);
      toast.error(t('common.delete_error', 'Xóa thất bại'));
    } finally {
      setDeleteModalState(prev => ({ ...prev, isOpen: false, loading: false }));
    }
  };

  const handleFormSuccess = () => {
    setIsFormOpen(false);
    fetchDevices();
  };

  return (
    <div className="assets-page">
      <VHeaderPage 
        title={t('assets.page_title')}
        action={
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {selectedIds.length > 0 && (
              <VButton variant="danger" onClick={handleBulkDelete} style={{ flex: '1 1 auto', whiteSpace: 'nowrap' }}>
                <Trash2 size={18} />
                Xóa đã chọn ({selectedIds.length})
              </VButton>
            )}
            <VButton onClick={handleAddDevice} style={{ flex: '1 1 auto', whiteSpace: 'nowrap' }}>
              <Plus size={18} />
              {t('assets.btn_add')}
            </VButton>
          </div>
        }
      />

      <div className="assets-content">
        <VFilterPage 
          searchPlaceholder={t('assets.filter_search_placeholder')}
          searchValue={search}
          onSearchChange={(e) => handleSearchChange(e.target.value)}
        >
          <div className="filter-select-wrapper">
            <select 
              className="v-filter-select" 
              value={filters.type} 
              onChange={(e) => handleFilterChange('type', e.target.value)}
              style={{ paddingRight: filters.type ? '28px' : undefined }}
            >
              <option value="">{t('assets.filter_type_all')}</option>
              {DEVICE_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            {filters.type && (
              <X 
                size={14} 
                className="clear-icon"
                onClick={() => handleFilterChange('type', '')}
              />
            )}
          </div>

          <div className="filter-select-wrapper">
            <select 
              className="v-filter-select" 
              value={filters.status} 
              onChange={(e) => handleFilterChange('status', e.target.value)}
              style={{ paddingRight: filters.status ? '28px' : undefined }}
            >
              <option value="">{t('assets.filter_status_all')}</option>
              <option value="active">{t('assets.filter_status_active')}</option>
              <option value="inactive">{t('assets.filter_status_inactive')}</option>
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
            <option value="desc">{t('assets.filter_order_desc')}</option>
            <option value="asc">{t('assets.filter_order_asc')}</option>
          </select>
        </VFilterPage>

        <DeviceList 
          devices={devices} 
          loading={loading} 
          onEdit={handleEditDevice}
          onDelete={handleDeleteDevice}
          onView={handleViewDevice}
          selectedIds={selectedIds}
          onSelect={handleSelect}
          onSelectAll={handleSelectAll}
        />

        {devices && devices.length > 0 && (
          <VPagination 
            page={page}
            perPage={perPage}
            total={total}
            dataLength={devices.length}
            itemName={t('assets.item_name')}
            onPageChange={(newPage) => setPage(newPage)}
            onPerPageChange={(newPerPage) => {
              setPerPage(newPerPage);
              setPage(1);
            }}
          />
        )}
      </div>

      {isFormOpen && (
        <DeviceForm 
          device={editingDevice} 
          onClose={() => setIsFormOpen(false)} 
          onSuccess={handleFormSuccess}
        />
      )}

      <DeleteConfirmModal 
        isOpen={deleteModalState.isOpen}
        items={deleteModalState.items}
        loading={deleteModalState.loading}
        onClose={() => setDeleteModalState(prev => ({ ...prev, isOpen: false }))}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
};

export default DeviceManagement;

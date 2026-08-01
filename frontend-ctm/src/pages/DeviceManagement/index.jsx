import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Server, Filter, X, Trash2 } from 'lucide-react';
import VButton from '@/components/VButton';
import deviceApi from '@/api/device';
import DeviceList from './components/DeviceList';
import DeviceForm from './components/DeviceForm';
import SimulatorModal from './components/SimulatorModal';
import DeviceDetailModal from './components/DeviceDetailModal';
import DeleteConfirmModal from '@/components/DeleteConfirmModal';
import VPagination from '@/components/VPagination';
import VHeaderPage from '@/components/VHeaderPage';
import VFilterPage from '@/components/VFilterPage';
import { DEVICE_TYPES } from '@/constants/deviceConstants';
import { SIMULATOR_OPTIONS, SORT_OPTIONS } from '@/constants/filterConstants';
import { toast } from '@/utils/toast';
import { useTranslation } from 'react-i18next';
import { useSelection } from '@/hooks/useSelection';
import { useFetchList } from '@/hooks/useFetchList';
import '../index.scss';
 
const CustomerDevices = () => {
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
    fetchFn: deviceApi.getAll,
    initialFilters: { status: '', type: '', current_scenario: '' },
    errorMessageKey: 'customer.devices.fetch_error'
  });

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState(null);
  const [simulatorDevice, setSimulatorDevice] = useState(null);
  const [viewingDevice, setViewingDevice] = useState(null);
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
    setViewingDevice(device);
  };

  const handleSimulateDevice = (device) => {
    setSimulatorDevice(device);
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
        await deviceApi.delete(id);
        toast.success(t('common.delete_success', 'Xóa thành công'));
      } else {
        const ids = items.map(i => i.id || i._id);
        await deviceApi.deleteMultiple(ids);
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
    <div className="customer-page-wrapper assets-page">
      <VHeaderPage 
        title={t('customer.devices.title')}
        action={
          <div style={{ display: 'flex', gap: '0.8571rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {selectedIds.length > 0 && (
              <VButton variant="danger" onClick={handleBulkDelete} style={{ flex: '1 1 auto', whiteSpace: 'nowrap' }}>
                <Trash2 size={18} />
                {t('common.delete')} ({selectedIds.length})
              </VButton>
            )}
            <VButton onClick={handleAddDevice} style={{ flex: '1 1 auto', whiteSpace: 'nowrap' }}>
              <Plus size={18} />
              {t('assets.btn_add', 'Thêm thiết bị')}
            </VButton>
          </div>
        }
      />

      <div className="assets-content">
        <VFilterPage 
          searchPlaceholder={t('customer.devices.filter_search_placeholder', 'Tìm kiếm thiết bị...')}
          searchValue={search}
          onSearchChange={(e) => handleSearchChange(e.target.value)}
        >
          <div className="filter-select-wrapper">
            <select 
              className="v-filter-select" 
              value={filters.type} 
              onChange={(e) => handleFilterChange('type', e.target.value)}
              style={{ paddingRight: filters.type ? '2rem' : undefined }}
            >
              <option value="">{t('assets.filter_type_all', 'Tất cả loại thiết bị')}</option>
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
              style={{ paddingRight: filters.status ? '2rem' : undefined }}
            >
              <option value="">{t('assets.filter_status_all', 'Tất cả trạng thái')}</option>
              <option value="active">{t('assets.filter_status_active', 'Hoạt động')}</option>
              <option value="inactive">{t('assets.filter_status_inactive', 'Vô hiệu hóa')}</option>
            </select>
            {filters.status && (
              <X 
                size={14} 
                className="clear-icon"
                onClick={() => handleFilterChange('status', '')}
              />
            )}
          </div>

          <div className="filter-select-wrapper">
            <select 
              className="v-filter-select" 
              value={filters.current_scenario} 
              onChange={(e) => handleFilterChange('current_scenario', e.target.value)}
              style={{ paddingRight: filters.current_scenario ? '2rem' : undefined }}
            >
              <option value="">{t('simulator.filter_scenario_all', 'Tất cả mô phỏng')}</option>
              {SIMULATOR_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            {filters.current_scenario && (
              <X 
                size={14} 
                className="clear-icon"
                onClick={() => handleFilterChange('current_scenario', '')}
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

        <DeviceList 
          devices={devices} 
          loading={loading} 
          onEdit={handleEditDevice}
          onDelete={handleDeleteDevice}
          onView={handleViewDevice}
          onSimulate={handleSimulateDevice}
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
            itemName={t('customer.devices.item_name')}
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

      {simulatorDevice && (
        <SimulatorModal 
          device={simulatorDevice}
          onClose={() => setSimulatorDevice(null)}
        />
      )}

      <DeleteConfirmModal 
        isOpen={deleteModalState.isOpen}
        items={deleteModalState.items}
        loading={deleteModalState.loading}
        onClose={() => setDeleteModalState(prev => ({ ...prev, isOpen: false }))}
        onConfirm={handleConfirmDelete}
      />

      {viewingDevice && (
        <DeviceDetailModal
          device={viewingDevice}
          onClose={() => setViewingDevice(null)}
        />
      )}
    </div>
  );
};

export default CustomerDevices;

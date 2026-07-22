import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import ApiAttacks from '@/api/attacks';
import AttackDevicesList from '@/sections/AttackSimulator/AttackDevicesList';
import AttackModal from '@/sections/AttackSimulator/AttackModal';
import VHeaderPage from '@/components/VHeaderPage';
import VFilterPage from '@/components/VFilterPage';
import VSelectFilter from '@/components/VSelectFilter';
import VButton from '@/components/VButton';
import DeleteConfirmModal from '@/Dialog/DeleteConfirmModal';
import { Trash2, Plus } from 'lucide-react';
import { toast } from 'react-toastify';
import { useLoader } from '@/hooks/useLoader';
import { useSelection } from '@/hooks/useSelection';
import './AttackSimulator.scss';

import { DEVICE_TYPES } from '@/constants/deviceConstants';

const AttackSimulator = () => {
  const { t } = useTranslation();
  const [devices, setDevices] = useState([]);
  const { isLoading: loading, showLoading, hideLoading } = useLoader(false);
  const [attackLoading, setAttackLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [deviceType, setDeviceType] = useState('all');
  const [order, setOrder] = useState('desc');

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [total, setTotal] = useState(0);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { selectedIds, handleSelect, handleSelectAll, clearSelection } = useSelection(devices, 'id', '_id');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deviceToDelete, setDeviceToDelete] = useState(null);

  const fetchDevices = async () => {
    try {
      showLoading();
      const res = await ApiAttacks.getDevices({
        page,
        per_page: perPage,
        search,
        type: deviceType !== 'all' ? deviceType : undefined,
        order,
      });
      if (res.data) {
        setDevices(res.data);
        setTotal(res.pagination?.total || res.meta?.total || res.data.length);
      } else if (Array.isArray(res)) {
        setDevices(res);
        setTotal(res.length);
      } else {
        setDevices([]);
        setTotal(0);
      }
    } catch (err) {
      console.error(err);
      toast.error(t('attack.fetch_error'));
    } finally {
      hideLoading();
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => fetchDevices(), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line
  }, [page, perPage, search, deviceType, order]);

  const handleLaunchClick = (device) => {
    setSelectedDevice(device);
    setIsModalOpen(true);
  };

  const handleConfirmAttack = async (attackType) => {
    try {
      setAttackLoading(true);
      await ApiAttacks.launchAttack(selectedDevice._id || selectedDevice.id, attackType);
      toast.success(t('attack.launch_success', { type: attackType }));
      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.message || t('attack.launch_error'));
    } finally {
      setAttackLoading(false);
    }
  };

  const confirmDelete = (id) => {
    setDeviceToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    try {
      if (deviceToDelete === 'bulk') {
        await ApiAttacks.bulkDeleteDevices(selectedIds);
        toast.success(t('common.delete_success', 'Xóa thành công'));
        clearSelection();
      } else {
        await ApiAttacks.deleteDevice(deviceToDelete);
        toast.success(t('common.delete_success', 'Xóa thành công'));
      }
      setIsDeleteModalOpen(false);
      fetchDevices();
    } catch (error) {
      toast.error(t('common.delete_error', 'Xóa thất bại'));
    }
  };

  return (
    <div className="assets-page">
      <VHeaderPage 
        title={t('attack.page_title')}
        action={
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {selectedIds.length > 0 && (
              <VButton variant="danger" onClick={() => confirmDelete('bulk')} style={{ flex: '1 1 auto', whiteSpace: 'nowrap' }}>
                <Trash2 size={18} />
                {t('incidents.btn_delete_selected', { count: selectedIds.length })}
              </VButton>
            )}
            <VButton variant="primary" onClick={() => setIsModalOpen(true)} style={{ flex: '1 1 auto', whiteSpace: 'nowrap' }}>
              <Plus size={18} />
              {t('attack.add_devices')}
            </VButton>
          </div>
        }
      />

      <div className="assets-content">
        <VFilterPage 
          searchPlaceholder={t('attack.search_placeholder')}
          searchValue={search}
          onSearchChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        >
          {/* Device type filter */}
          <VSelectFilter
            value={deviceType}
            defaultValue="all"
            onChange={(val) => { setDeviceType(val); setPage(1); }}
            placeholder={t('assets.filter_type_all')}
            options={DEVICE_TYPES.map(tp => ({ value: tp.value, label: tp.label }))}
          />

          {/* Order filter */}
          <VSelectFilter
            value={order}
            defaultValue="desc"
            onChange={(val) => { setOrder(val); setPage(1); }}
            placeholder={t('assets.filter_order_desc')}
            options={[
              { value: 'asc', label: t('assets.filter_order_asc') },
            ]}
          />
        </VFilterPage>

        <AttackDevicesList 
          devices={devices}
          loading={loading}
          page={page}
          perPage={perPage}
          total={total}
          onPageChange={setPage}
          onPerPageChange={setPerPage}
          onLaunch={handleLaunchClick}
          selectedIds={selectedIds}
          onSelect={handleSelect}
          onSelectAll={handleSelectAll}
          onDelete={confirmDelete}
        />
      </div>

      {isModalOpen && (
        <AttackModal 
          device={selectedDevice}
          onClose={() => setIsModalOpen(false)}
          onConfirm={handleConfirmAttack}
          loading={attackLoading}
        />
      )}

      <DeleteConfirmModal 
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDelete}
        title={t('assets.confirm_delete', 'Xóa thiết bị')}
        message={deviceToDelete === 'bulk' 
          ? t('assets.confirm_bulk_delete_msg', 'Bạn có chắc chắn muốn xóa các thiết bị đã chọn?') 
          : t('assets.confirm_delete_msg', 'Bạn có chắc chắn muốn xóa thiết bị này không?')}
      />
    </div>
  );
};

export default AttackSimulator;

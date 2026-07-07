import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Server, Filter, X } from 'lucide-react';
import VButton from '@/components/common/VButton/VButton';
import VInput from '@/components/common/VInput/VInput';
import deviceService from '@/services/deviceService';
import DeviceList from './DeviceList';
import DeviceForm from './DeviceForm';
import VPagination from '@/components/common/UI/VPagination';
import VHeaderPage from '@/components/common/VHeaderPage';
import VFilterPage from '@/components/common/VFilterPage';
import { DEVICE_TYPES } from '@/constants/deviceConstants';
import { toast } from '@/utils/toast';
import './Assets.scss';

const Assets = () => {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Filter & Pagination States
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [order, setOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [total, setTotal] = useState(0);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState(null);

  const fetchDevices = useCallback(async () => {
    try {
      setLoading(true);
      
      const params = {
        search,
        status,
        type,
        order,
        page,
        per_page: perPage
      };

      const res = await deviceService.getAll(params);
      
      // Handle both Laravel-style pagination and flat array gracefully
      if (res && res.pagination) {
        setDevices(res.data);
        setTotal(res.pagination.total);
      } else if (res && res.data && Array.isArray(res.data)) {
        setDevices(res.data);
        setTotal(res.meta?.total || res.total || res.data.length);
      } else if (Array.isArray(res)) {
        setDevices(res);
        setTotal(res.length);
      } else {
        setDevices([]);
        setTotal(0);
      }
    } catch (err) {
      console.error('Error fetching devices:', err);
      toast.error('Không thể tải danh sách thiết bị. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
    }
  }, [search, status, type, order, page, perPage]);

  // Use a slight debounce for search input
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchDevices();
    }, 500);
    return () => clearTimeout(timer);
  }, [fetchDevices]);

  const handleAddDevice = () => {
    setEditingDevice(null);
    setIsFormOpen(true);
  };

  const handleEditDevice = (device) => {
    setEditingDevice(device);
    setIsFormOpen(true);
  };

  const handleDeleteDevice = async (id) => {
    if (window.confirm('Bạn có chắc chắn muốn xoá thiết bị này?')) {
      try {
        await deviceService.delete(id);
        toast.success('Xoá thiết bị thành công');
        fetchDevices();
      } catch (err) {
        console.error('Error deleting device:', err);
        toast.error('Có lỗi xảy ra khi xoá thiết bị');
      }
    }
  };

  const handleViewDevice = (device) => {
    toast.info(`Xem chi tiết thiết bị: ${device.name}\nIP: ${device.ip_address}`);
  };

  const handleFormSuccess = () => {
    setIsFormOpen(false);
    fetchDevices();
  };

  return (
    <div className="assets-page">
      <VHeaderPage 
        title="Quản lý thiết bị"
        action={
          <VButton onClick={handleAddDevice}>
            <Plus size={18} />
            Thêm mới
          </VButton>
        }
      />

      <div className="assets-content">
        <VFilterPage 
          searchPlaceholder="Tìm kiếm (Tên, Loại, IP)..."
          searchValue={search}
          onSearchChange={(e) => {
            setSearch(e.target.value);
            setPage(1); // Reset page on search
          }}
        >
          <div className="filter-select-wrapper">
            <select 
              className="v-filter-select" 
              value={type} 
              onChange={(e) => {
                setType(e.target.value);
                setPage(1);
              }}
              style={{ paddingRight: type ? '28px' : undefined }}
            >
              <option value="">Tất cả thiết bị</option>
              {DEVICE_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            {type && (
              <X 
                size={14} 
                className="clear-icon"
                onClick={() => { setType(''); setPage(1); }}
              />
            )}
          </div>

          <div className="filter-select-wrapper">
            <select 
              className="v-filter-select" 
              value={status} 
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              style={{ paddingRight: status ? '28px' : undefined }}
            >
              <option value="">Tất cả trạng thái</option>
              <option value="active">Hoạt động</option>
              <option value="inactive">Vô hiệu hóa</option>
            </select>
            {status && (
              <X 
                size={14} 
                className="clear-icon"
                onClick={() => { setStatus(''); setPage(1); }}
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
            <option value="desc">Mới nhất</option>
            <option value="asc">Cũ nhất</option>
          </select>
        </VFilterPage>

        <DeviceList 
          devices={devices} 
          loading={loading} 
          onEdit={handleEditDevice}
          onDelete={handleDeleteDevice}
          onView={handleViewDevice}
        />

        {devices && devices.length > 0 && (
          <VPagination 
            page={page}
            perPage={perPage}
            total={total}
            dataLength={devices.length}
            itemName="Thiết bị"
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
    </div>
  );
};

export default Assets;

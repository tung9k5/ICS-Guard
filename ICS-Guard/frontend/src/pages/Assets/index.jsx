import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Server, Filter } from 'lucide-react';
import VButton from '@/components/common/VButton/VButton';
import VInput from '@/components/common/VInput/VInput';
import deviceService from '@/services/deviceService';
import DeviceList from './DeviceList';
import DeviceForm from './DeviceForm';
import VPagination from '@/components/common/UI/VPagination';
import VHeaderPage from '@/components/common/VHeaderPage';
import VFilterPage from '@/components/common/VFilterPage';
import './Assets.scss';

const Assets = () => {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Filter & Pagination States
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [order, setOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [total, setTotal] = useState(0);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState(null);

  const fetchDevices = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      
      const params = {
        search,
        status,
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
      setError('Không thể tải danh sách thiết bị. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
    }
  }, [search, status, order, page, perPage]);

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
        fetchDevices();
      } catch (err) {
        console.error('Error deleting device:', err);
        alert('Có lỗi xảy ra khi xoá thiết bị');
      }
    }
  };

  const handleViewDevice = (device) => {
    alert(`Xem chi tiết thiết bị: ${device.name}\nIP: ${device.ip_address}`);
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

      {error && <div className="alert-error">{error}</div>}

      <div className="assets-content">
        <VFilterPage 
          searchPlaceholder="Tìm kiếm (Tên, Loại, IP)..."
          searchValue={search}
          onSearchChange={(e) => {
            setSearch(e.target.value);
            setPage(1); // Reset page on search
          }}
        >
          <select 
            className="v-filter-select" 
            value={status} 
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="active">Đang hoạt động</option>
            <option value="inactive">Vô hiệu hóa</option>
          </select>

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

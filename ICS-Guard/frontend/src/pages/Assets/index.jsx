import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Server, Filter, X } from 'lucide-react';
import VButton from '@/components/VButton';
import VInput from '@/components/VInput';
import ApiDevice from '@/api/device';
import DeviceList from './DeviceList';
import DeviceForm from './DeviceForm';
import VPagination from '@/components/VPagination';
import VHeaderPage from '@/components/VHeaderPage';
import VFilterPage from '@/components/VFilterPage';
import { DEVICE_TYPES } from '@/constants/deviceConstants';
import { toast } from '@/utils/toast';
import { useTranslation } from 'react-i18next';
import { SEARCH_DEBOUNCE_MS, DEFAULT_PAGE_SIZE } from '@/constants/uiConstants';
import './Assets.scss';

const Assets = () => {
  const { t } = useTranslation();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Filter & Pagination States
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [order, setOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(DEFAULT_PAGE_SIZE);
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

      const res = await ApiDevice.getAll(params);
      
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
      toast.error(t('assets.fetch_error'));
    } finally {
      setLoading(false);
    }
  }, [search, status, type, order, page, perPage]);

  // Use a slight debounce for search input
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchDevices();
    }, SEARCH_DEBOUNCE_MS);
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
    if (window.confirm(t('assets.delete_confirm'))) {
      try {
        await ApiDevice.delete(id);
        toast.success(t('assets.delete_success'));
        fetchDevices();
      } catch (err) {
        console.error('Error deleting device:', err);
        toast.error(t('assets.delete_error'));
      }
    }
  };

  const handleViewDevice = (device) => {
    toast.info(t('assets.view_details', { name: device.name, ip: device.ip_address }));
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
          <VButton onClick={handleAddDevice}>
            <Plus size={18} />
            {t('assets.btn_add')}
          </VButton>
        }
      />

      <div className="assets-content">
        <VFilterPage 
          searchPlaceholder={t('assets.filter_search_placeholder')}
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
              <option value="">{t('assets.filter_type_all')}</option>
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
              <option value="">{t('assets.filter_status_all')}</option>
              <option value="active">{t('assets.filter_status_active')}</option>
              <option value="inactive">{t('assets.filter_status_inactive')}</option>
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
    </div>
  );
};

export default Assets;

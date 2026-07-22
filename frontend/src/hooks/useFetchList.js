import { useState, useEffect, useCallback } from 'react';
import { useLoader } from './useLoader';
import { SEARCH_DEBOUNCE_MS, DEFAULT_PAGE_SIZE } from '@/constants/uiConstants';
import { toast } from '@/utils/toast';
import { useTranslation } from 'react-i18next';

export const useFetchList = ({ fetchFn, initialFilters = {}, onClearSelection, errorMessageKey = 'error_general' }) => {
  const { t } = useTranslation();
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  
  const [search, setSearch] = useState('');
  const [order, setOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(DEFAULT_PAGE_SIZE);
  const [filters, setFilters] = useState(initialFilters);
  
  const { isLoading, showLoading, hideLoading } = useLoader(false);

  const fetchData = useCallback(async () => {
    try {
      showLoading();
      const params = {
        search,
        order,
        page,
        per_page: perPage,
        ...filters
      };
      
      const res = await fetchFn(params);
      
      if (res && res.pagination) {
        setData(res.data);
        setTotal(res.pagination.total);
      } else if (res && res.data && Array.isArray(res.data)) {
        setData(res.data);
        setTotal(res.meta?.total || res.total || res.data.length);
      } else if (res && res.status === 'success' && res.data) {
        setData(res.data);
        setTotal(res.pagination?.total || 0);
      } else if (Array.isArray(res)) {
        setData(res);
        setTotal(res.length);
      } else {
        setData([]);
        setTotal(0);
      }
      
      if (onClearSelection) {
        onClearSelection();
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      toast.error(t(errorMessageKey, 'Có lỗi xảy ra'));
    } finally {
      hideLoading();
    }
  }, [fetchFn, search, order, page, perPage, filters, t, errorMessageKey, onClearSelection]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData();
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [fetchData]);

  const handleFilterChange = useCallback((key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  }, []);

  const handleSearchChange = useCallback((value) => {
    setSearch(value);
    setPage(1);
  }, []);

  return {
    data,
    setData,
    total,
    isLoading,
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
    fetchData,
  };
};

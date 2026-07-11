import React, { useState, useEffect, useCallback } from 'react';
import { Plus, X, Trash2 } from 'lucide-react';
import VButton from '@/components/VButton';
import ApiIncident from '@/api/incidents';
import IncidentList from '@/sections/IncidentManagement/IncidentList';
import IncidentForm from '@/sections/IncidentManagement/IncidentForm';
import DeleteConfirmModal from '@/Dialog/DeleteConfirmModal';
import VPagination from '@/components/VPagination';
import VHeaderPage from '@/components/VHeaderPage';
import VFilterPage from '@/components/VFilterPage';
import { toast } from '@/utils/toast';
import { SEARCH_DEBOUNCE_MS, DEFAULT_PAGE_SIZE } from '@/constants/uiConstants';
import './IncidentManagement.scss';

const IncidentManagement = () => {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Filter & Pagination States
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [severity, setSeverity] = useState('');
  const [order, setOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(DEFAULT_PAGE_SIZE);
  const [total, setTotal] = useState(0);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingIncident, setEditingIncident] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  
  // Delete Modal State
  const [deleteModalState, setDeleteModalState] = useState({
    isOpen: false,
    items: [],
    loading: false
  });

  const fetchIncidents = useCallback(async () => {
    try {
      setLoading(true);
      
      const params = {
        search,
        status,
        severity,
        order,
        page,
        per_page: perPage
      };

      const res = await ApiIncident.getAll(params);
      
      if (res && res.pagination) {
        setIncidents(res.data);
        setTotal(res.pagination.total);
      } else if (res && res.data && Array.isArray(res.data)) {
        setIncidents(res.data);
        setTotal(res.meta?.total || res.total || res.data.length);
      } else if (Array.isArray(res)) {
        setIncidents(res);
        setTotal(res.length);
      } else {
        setIncidents([]);
        setTotal(0);
      }
      setSelectedIds([]); 
    } catch (err) {
      console.error('Error fetching incidents:', err);
      toast.error('Lỗi khi lấy danh sách sự cố');
    } finally {
      setLoading(false);
    }
  }, [search, status, severity, order, page, perPage]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchIncidents();
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [fetchIncidents]);

  const handleEditIncident = (incident) => {
    setEditingIncident(incident);
    setIsFormOpen(true);
  };

  const handleDeleteIncident = (id) => {
    const incidentToDelete = incidents.find(i => (i.id || i._id) === id) || { id };
    setDeleteModalState({
      isOpen: true,
      items: [incidentToDelete],
      loading: false
    });
  };

  const handleSelectIncident = (id, isSelected) => {
    if (isSelected) {
      setSelectedIds(prev => [...prev, id]);
    } else {
      setSelectedIds(prev => prev.filter(item => item !== id));
    }
  };

  const handleSelectAll = (isSelected) => {
    if (isSelected) {
      const allIds = incidents.map(i => i.id || i._id);
      setSelectedIds(allIds);
    } else {
      setSelectedIds([]);
    }
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    const incidentsToDelete = incidents.filter(i => selectedIds.includes(i.id || i._id));
    setDeleteModalState({
      isOpen: true,
      items: incidentsToDelete.length > 0 ? incidentsToDelete : selectedIds.map(id => ({ id })),
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
        await ApiIncident.delete(id);
        toast.success('Xóa sự cố thành công');
      } else {
        const ids = items.map(i => i.id || i._id);
        await ApiIncident.deleteMultiple(ids);
        toast.success(`Đã xóa thành công ${ids.length} sự cố`);
        setSelectedIds([]);
      }
      fetchIncidents();
    } catch (err) {
      console.error('Delete error:', err);
      toast.error('Có lỗi xảy ra khi xóa sự cố');
    } finally {
      setDeleteModalState(prev => ({ ...prev, isOpen: false, loading: false }));
    }
  };

  const handleAiAnalyze = async (id) => {
    try {
      toast.success('Đã gửi yêu cầu phân tích AI. Vui lòng đợi trong giây lát...');
      await ApiIncident.triggerAiAnalysis(id);
      fetchIncidents();
    } catch (err) {
      console.error('AI Analyze error:', err);
      toast.error(err?.response?.data?.message || 'Có lỗi xảy ra khi yêu cầu phân tích AI');
    }
  };

  const handleFormSuccess = () => {
    setIsFormOpen(false);
    fetchIncidents();
  };

  return (
    <div className="incidents-page">
      <VHeaderPage 
        title="Quản lý sự cố"
        action={
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {selectedIds.length > 0 && (
              <VButton variant="danger" onClick={handleBulkDelete} style={{ flex: '1 1 auto', whiteSpace: 'nowrap' }}>
                <Trash2 size={18} />
                Xóa đã chọn ({selectedIds.length})
              </VButton>
            )}
          </div>
        }
      />

      <div className="incidents-content">
        <VFilterPage 
          searchPlaceholder="Tìm kiếm tên, mô tả..."
          searchValue={search}
          onSearchChange={(e) => {
            setSearch(e.target.value);
            setPage(1); 
          }}
        >
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
              <option value="open">Mở</option>
              <option value="investigating">Đang điều tra</option>
              <option value="remediated">Đã khắc phục</option>
              <option value="closed">Đã đóng</option>
            </select>
            {status && (
              <X 
                size={14} 
                className="clear-icon"
                onClick={() => { setStatus(''); setPage(1); }}
              />
            )}
          </div>

          <div className="filter-select-wrapper">
            <select 
              className="v-filter-select" 
              value={severity} 
              onChange={(e) => {
                setSeverity(e.target.value);
                setPage(1);
              }}
              style={{ paddingRight: severity ? '28px' : undefined }}
            >
              <option value="">Tất cả mức độ</option>
              <option value="LOW">Thấp (Low)</option>
              <option value="MEDIUM">Trung bình (Medium)</option>
              <option value="HIGH">Cao (High)</option>
              <option value="CRITICAL">Nghiêm trọng (Critical)</option>
            </select>
            {severity && (
              <X 
                size={14} 
                className="clear-icon"
                onClick={() => { setSeverity(''); setPage(1); }}
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

        <IncidentList 
          incidents={incidents} 
          loading={loading} 
          onEdit={handleEditIncident}
          onDelete={handleDeleteIncident}
          onAiAnalyze={handleAiAnalyze}
          selectedIds={selectedIds}
          onSelect={handleSelectIncident}
          onSelectAll={handleSelectAll}
        />

        {incidents && incidents.length > 0 && (
          <VPagination 
            page={page}
            perPage={perPage}
            total={total}
            dataLength={incidents.length}
            itemName="sự cố"
            onPageChange={(newPage) => setPage(newPage)}
            onPerPageChange={(newPerPage) => {
              setPerPage(newPerPage);
              setPage(1);
            }}
          />
        )}
      </div>

      {isFormOpen && (
        <IncidentForm 
          incident={editingIncident} 
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

export default IncidentManagement;

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, X, Trash2 } from 'lucide-react';
import VButton from '@/components/VButton';
import ApiUser from '@/api/users';
import UserList from '@/sections/UserManagement/UserList';
import UserForm from '@/sections/UserManagement/UserForm';
import DeleteConfirmModal from '@/Dialog/DeleteConfirmModal';
import VPagination from '@/components/VPagination';
import VHeaderPage from '@/components/VHeaderPage';
import VFilterPage from '@/components/VFilterPage';
import { toast } from '@/utils/toast';
import { useTranslation } from 'react-i18next';
import { SEARCH_DEBOUNCE_MS, DEFAULT_PAGE_SIZE } from '@/constants/uiConstants';
import './UserManagement.scss';

const UserManagement = () => {
  const { t } = useTranslation();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Filter & Pagination States
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [role, setRole] = useState('');
  const [order, setOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(DEFAULT_PAGE_SIZE);
  const [total, setTotal] = useState(0);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  
  // Delete Modal State
  const [deleteModalState, setDeleteModalState] = useState({
    isOpen: false,
    items: [],
    loading: false
  });

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      
      const params = {
        search,
        status,
        role,
        order,
        page,
        per_page: perPage
      };

      const res = await ApiUser.getAllUsers(params);
      
      if (res && res.pagination) {
        setUsers(res.data);
        setTotal(res.pagination.total);
      } else if (res && res.data && Array.isArray(res.data)) {
        setUsers(res.data);
        setTotal(res.meta?.total || res.total || res.data.length);
      } else if (Array.isArray(res)) {
        setUsers(res);
        setTotal(res.length);
      } else {
        setUsers([]);
        setTotal(0);
      }
      setSelectedIds([]); 
    } catch (err) {
      console.error('Error fetching users:', err);
      toast.error(t('users.fetch_error'));
    } finally {
      setLoading(false);
    }
  }, [search, status, role, order, page, perPage, t]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers();
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [fetchUsers]);

  const handleAddUser = () => {
    setEditingUser(null);
    setIsFormOpen(true);
  };

  const handleEditUser = (user) => {
    setEditingUser(user);
    setIsFormOpen(true);
  };

  const handleDeleteUser = (id) => {
    const userToDelete = users.find(u => (u.id || u._id) === id) || { id };
    setDeleteModalState({
      isOpen: true,
      items: [userToDelete],
      loading: false
    });
  };

  const handleSelectUser = (id, isSelected) => {
    if (isSelected) {
      setSelectedIds(prev => [...prev, id]);
    } else {
      setSelectedIds(prev => prev.filter(item => item !== id));
    }
  };

  const handleSelectAll = (isSelected) => {
    if (isSelected) {
      const allIds = users.map(u => u.id || u._id);
      setSelectedIds(allIds);
    } else {
      setSelectedIds([]);
    }
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    const usersToDelete = users.filter(u => selectedIds.includes(u.id || u._id));
    setDeleteModalState({
      isOpen: true,
      items: usersToDelete.length > 0 ? usersToDelete : selectedIds.map(id => ({ id })),
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
        await ApiUser.deleteUser(id);
        toast.success(t('users.delete_success'));
      } else {
        const ids = items.map(i => i.id || i._id);
        await ApiUser.deleteMultipleUsers(ids);
        toast.success(t('users.bulk_delete_success', { count: ids.length }));
        setSelectedIds([]);
      }
      fetchUsers();
    } catch (err) {
      console.error('Delete error:', err);
      toast.error(t('users.delete_error'));
    } finally {
      setDeleteModalState(prev => ({ ...prev, isOpen: false, loading: false }));
    }
  };

  const handleFormSuccess = () => {
    setIsFormOpen(false);
    fetchUsers();
  };

  return (
    <div className="users-page">
      <VHeaderPage 
        title={t('users.page_title')}
        action={
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {selectedIds.length > 0 && (
              <VButton variant="danger" onClick={handleBulkDelete} style={{ flex: '1 1 auto', whiteSpace: 'nowrap' }}>
                <Trash2 size={18} />
                {t('users.btn_delete_selected', { count: selectedIds.length })}
              </VButton>
            )}
            <VButton onClick={handleAddUser} style={{ flex: '1 1 auto', whiteSpace: 'nowrap' }}>
              <Plus size={18} />
              {t('users.btn_add')}
            </VButton>
          </div>
        }
      />

      <div className="users-content">
        <VFilterPage 
          searchPlaceholder={t('users.search_placeholder')}
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
              <option value="">{t('users.filter_status_all')}</option>
              <option value="active">{t('users.filter_status_active')}</option>
              <option value="inactive">{t('users.filter_status_inactive')}</option>
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
              value={role} 
              onChange={(e) => {
                setRole(e.target.value);
                setPage(1);
              }}
              style={{ paddingRight: role ? '28px' : undefined }}
            >
              <option value="">{t('users.filter_role_all')}</option>
              <option value="admin">{t('users.filter_role_admin')}</option>
              <option value="l1_analyst">{t('users.filter_role_l1')}</option>
              <option value="l2_responder">{t('users.filter_role_l2')}</option>
              <option value="l3_manager">{t('users.filter_role_l3')}</option>
              <option value="ot_operator">{t('users.filter_role_ot')}</option>
            </select>
            {role && (
              <X 
                size={14} 
                className="clear-icon"
                onClick={() => { setRole(''); setPage(1); }}
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
            <option value="desc">{t('users.filter_order_desc')}</option>
            <option value="asc">{t('users.filter_order_asc')}</option>
          </select>
        </VFilterPage>

        <UserList 
          users={users} 
          loading={loading} 
          onEdit={handleEditUser}
          onDelete={handleDeleteUser}
          selectedIds={selectedIds}
          onSelect={handleSelectUser}
          onSelectAll={handleSelectAll}
        />

        {users && users.length > 0 && (
          <VPagination 
            page={page}
            perPage={perPage}
            total={total}
            dataLength={users.length}
            itemName={t('users.item_name')}
            onPageChange={(newPage) => setPage(newPage)}
            onPerPageChange={(newPerPage) => {
              setPerPage(newPerPage);
              setPage(1);
            }}
          />
        )}
      </div>

      {isFormOpen && (
        <UserForm 
          user={editingUser} 
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

export default UserManagement;

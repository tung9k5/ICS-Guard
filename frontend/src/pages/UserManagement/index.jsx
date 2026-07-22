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
import { useSelection } from '@/hooks/useSelection';
import { useFetchList } from '@/hooks/useFetchList';
import { DEFAULT_PAGE_SIZE } from '@/constants/uiConstants';
import './UserManagement.scss';

const UserManagement = () => {
  const { t } = useTranslation();
  const {
    data: users,
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
    fetchData: fetchUsers
  } = useFetchList({
    fetchFn: ApiUser.getAllUsers,
    initialFilters: { status: '', role: '' },
    errorMessageKey: 'users.fetch_error'
  });

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const { selectedIds, handleSelect, handleSelectAll, clearSelection } = useSelection(users, 'id', '_id');
  
  // Clear selection when data changes
  useEffect(() => {
    clearSelection();
  }, [users, clearSelection]);
  
  // Delete Modal State
  const [deleteModalState, setDeleteModalState] = useState({
    isOpen: false,
    items: [],
    loading: false
  });

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
        toast.success(t('common.delete_success', 'Xóa thành công'));
      } else {
        const ids = items.map(i => i.id || i._id);
        await ApiUser.deleteMultipleUsers(ids);
        toast.success(t('common.delete_success', 'Xóa thành công'));
        clearSelection();
      }
      fetchUsers();
    } catch (err) {
      console.error('Delete error:', err);
      toast.error(t('common.delete_error', 'Xóa thất bại'));
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
          onSearchChange={(e) => handleSearchChange(e.target.value)}
        >
          <div className="filter-select-wrapper">
            <select 
              className="v-filter-select" 
              value={filters.status} 
              onChange={(e) => handleFilterChange('status', e.target.value)}
              style={{ paddingRight: filters.status ? '28px' : undefined }}
            >
              <option value="">{t('users.filter_status_all')}</option>
              <option value="active">{t('users.filter_status_active')}</option>
              <option value="inactive">{t('users.filter_status_inactive')}</option>
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
              value={filters.role} 
              onChange={(e) => handleFilterChange('role', e.target.value)}
              style={{ paddingRight: filters.role ? '28px' : undefined }}
            >
              <option value="">{t('users.filter_role_all')}</option>
              <option value="admin">{t('users.filter_role_admin')}</option>
              <option value="l1_analyst">{t('users.filter_role_l1')}</option>
              <option value="l2_responder">{t('users.filter_role_l2')}</option>
              <option value="l3_manager">{t('users.filter_role_l3')}</option>
              <option value="ot_operator">{t('users.filter_role_ot')}</option>
            </select>
            {filters.role && (
              <X 
                size={14} 
                className="clear-icon"
                onClick={() => handleFilterChange('role', '')}
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
          onSelect={handleSelect}
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

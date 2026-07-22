import React, { useState, useEffect, useCallback } from 'react';
import { Plus, X, Trash2 } from 'lucide-react';
import VButton from '@/components/VButton';
import VInput from '@/components/VInput';
import rulesApi from '@/api/rules';
import RuleList from '@/sections/RuleManagement/RuleList';
import RuleForm from '@/sections/RuleManagement/RuleForm';
import DeleteConfirmModal from '@/Dialog/DeleteConfirmModal';
import VPagination from '@/components/VPagination';
import VHeaderPage from '@/components/VHeaderPage';
import VFilterPage from '@/components/VFilterPage';
import { toast } from '@/utils/toast';
import { useTranslation } from 'react-i18next';
import { useSelection } from '@/hooks/useSelection';
import { useFetchList } from '@/hooks/useFetchList';
import { DEFAULT_PAGE_SIZE } from '@/constants/uiConstants';
import { RULE_SEVERITIES, RULE_STATUSES } from '@/constants/ruleConstants';
import VSelectFilter from '@/components/VSelectFilter';
import './RuleManagement.scss';

const RuleManagement = () => {
  const { t } = useTranslation();

  const {
    data: rules,
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
    fetchData: fetchRules
  } = useFetchList({
    fetchFn: rulesApi.getAllRules,
    initialFilters: { severity: '', is_active: '' },
    errorMessageKey: 'error_general'
  });

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedRule, setSelectedRule] = useState(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [ruleToDelete, setRuleToDelete] = useState(null);

  const { selectedIds: selectedRuleIds, handleSelect, handleSelectAll, clearSelection } = useSelection(rules, 'id', '_id');
  
  useEffect(() => {
    clearSelection();
  }, [rules, clearSelection]);

  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);

  const handleCreate = () => {
    setSelectedRule(null);
    setIsFormOpen(true);
  };

  const handleEdit = (rule) => {
    setSelectedRule(rule);
    setIsFormOpen(true);
  };

  const handleSubmit = async (data) => {
    try {
      if (selectedRule) {
        await rulesApi.updateRule(selectedRule._id, data);
        toast.success(t('rules.update_success', 'Cập nhật thành công'));
      } else {
        await rulesApi.createRule(data);
        toast.success(t('rules.create_success', 'Tạo mới thành công'));
      }
      setIsFormOpen(false);
      fetchRules();
    } catch (error) {
      toast.error(error.response?.data?.message || t('error_general', 'Có lỗi xảy ra'));
    }
  };

  const confirmDelete = (rule) => {
    setRuleToDelete(rule);
    setIsDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!ruleToDelete) return;
    try {
      await rulesApi.deleteRule(ruleToDelete._id);
      toast.success(t('common.delete_success', 'Xóa thành công'));
      setIsDeleteModalOpen(false);
      clearSelection();
      fetchRules();
    } catch (error) {
      toast.error(t('error_general', 'Có lỗi xảy ra'));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedRuleIds.length === 0) return;
    try {
      await rulesApi.bulkDeleteRules({ ids: selectedRuleIds });
      toast.success(t('common.delete_success', 'Xóa thành công'));
      clearSelection();
      setIsBulkDeleteModalOpen(false);
      fetchRules();
    } catch (error) {
      toast.error(t('error_general', 'Có lỗi xảy ra'));
    }
  };



  return (
    <div className="rules-page">
      <VHeaderPage
        title={t('rules.title', 'Quản lý Quy tắc')}
        action={
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {selectedRuleIds.length > 0 && (
              <VButton variant="danger" onClick={() => setIsBulkDeleteModalOpen(true)}>
                <Trash2 size={18} />
                {t('rules.delete_selected', { count: selectedRuleIds.length, defaultValue: `Xóa đã chọn (${selectedRuleIds.length})` })}
              </VButton>
            )}
            <VButton variant="primary" onClick={handleCreate} className="d-flex align-items-center gap-2">
              <Plus size={18} />
              {t('rules.add', 'Thêm Quy tắc')}
            </VButton>
          </div>
        }
      />

      <div className="rules-content">
        {isFormOpen && (
          <RuleForm
            initialData={selectedRule}
            onSubmit={handleSubmit}
            onCancel={() => setIsFormOpen(false)}
          />
        )}
        <VFilterPage
          searchPlaceholder={t('rules.search_placeholder', 'Tìm tên quy tắc...')}
          searchValue={search}
          onSearchChange={(e) => handleSearchChange(e.target.value)}
        >
          <div className="filter-select-wrapper">
            <select 
              className="v-filter-select" 
              value={filters.severity} 
              onChange={(e) => handleFilterChange('severity', e.target.value)}
              style={{ paddingRight: filters.severity ? '28px' : undefined }}
            >
              <option value="">{t('rules.filter_severity', 'Tất cả mức độ')}</option>
              {RULE_SEVERITIES.map(sev => (
                <option key={sev.value} value={sev.value}>{sev.label}</option>
              ))}
            </select>
            {filters.severity && (
              <X 
                size={14} 
                className="clear-icon"
                onClick={() => handleFilterChange('severity', '')}
              />
            )}
          </div>

          <div className="filter-select-wrapper">
            <select 
              className="v-filter-select" 
              value={filters.is_active} 
              onChange={(e) => handleFilterChange('is_active', e.target.value)}
              style={{ paddingRight: filters.is_active ? '28px' : undefined }}
            >
              <option value="">{t('rules.filter_status', 'Tất cả trạng thái')}</option>
              {RULE_STATUSES.map(stat => (
                <option key={stat.value} value={stat.value}>{stat.label}</option>
              ))}
            </select>
            {filters.is_active && (
              <X 
                size={14} 
                className="clear-icon"
                onClick={() => handleFilterChange('is_active', '')}
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

        {loading ? (
          <div className="user-loading">{t('common.loading', 'Đang tải...')}</div>
        ) : (
          <>
            <RuleList
              rules={rules}
              onEdit={handleEdit}
              onDelete={confirmDelete}
              selectedIds={selectedRuleIds}
              onSelect={handleSelect}
              onSelectAll={handleSelectAll}
            />

            {rules && rules.length > 0 && (
              <VPagination
                page={page}
                perPage={perPage}
                total={total}
                dataLength={rules.length}
                itemName="quy tắc"
                onPageChange={(newPage) => setPage(newPage)}
                onPerPageChange={(newPerPage) => {
                  setPerPage(newPerPage);
                  setPage(1);
                }}
              />
            )}
          </>
        )}



      </div>

      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDelete}
        title={t('rules.confirm_delete', 'Xóa quy tắc')}
        message={t('rules.confirm_delete_msg', 'Bạn có chắc chắn muốn xóa quy tắc này?')}
      />

      <DeleteConfirmModal
        isOpen={isBulkDeleteModalOpen}
        onClose={() => setIsBulkDeleteModalOpen(false)}
        onConfirm={handleBulkDelete}
        title={t('rules.confirm_delete_bulk', 'Xóa nhiều quy tắc')}
        message={t('rules.confirm_delete_bulk_msg', `Bạn có chắc chắn muốn xóa ${selectedRuleIds.length} quy tắc đã chọn?`)}
      />
    </div>
  );
};

export default RuleManagement;

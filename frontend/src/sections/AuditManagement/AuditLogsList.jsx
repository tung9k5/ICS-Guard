import React, { useState, useEffect } from 'react';
import { Info, User, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import ApiAudit from '@/api/audit';
import VPagination from '@/components/VPagination';
import VNoData from '@/components/VNoData';
import VCheckbox from '@/components/VCheckbox';
import VFilterPage from '@/components/VFilterPage';
import VSelectFilter from '@/components/VSelectFilter';
import ActionMenu from '@/components/ActionMenu';
import VStatus from '@/components/VStatus';
import DeleteConfirmModal from '@/Dialog/DeleteConfirmModal';
import { toast } from 'react-toastify';
import { formatDate } from '@/utils/formatDate';
import { useLoader } from '@/hooks/useLoader';

// Known audit actions from server (extend as needed)
const AUDIT_ACTIONS = [
  'USER_LOGIN_ATTEMPT', 'USER_LOGOUT', 'USER_REGISTER', 'USER_GOOGLE_LOGIN_ATTEMPT', 'USER_SETUP_ONBOARDING',
  'USER_CREATE', 'USER_UPDATE', 'USER_DELETE', 'USER_BULK_DELETE', 'PROFILE_UPDATE',
  'DEVICE_CREATE', 'DEVICE_UPDATE', 'DEVICE_DELETE', 'DEVICE_BULK_DELETE', 'DEVICE_ISOLATE', 'DEVICE_UNISOLATE', 'DEVICE_ROLLBACK', 'DEVICE_ISOLATION_TRIGGERED', 'DEVICE_UNISOLATION_TRIGGERED', 'DEVICE_ROLLBACK_TRIGGERED',
  'IP_AUTO_BLOCK', 'IP_MANUAL_UNBLOCK',
  'RULE_CREATE', 'RULE_UPDATE', 'RULE_DELETE', 'RULE_BULK_DELETE',
  'ALERT_UPDATE_STATUS', 'ALERT_DELETE', 'ALERT_BULK_DELETE',
  'INCIDENT_CREATE', 'INCIDENT_AI_ANALYZE', 'INCIDENT_UPDATE', 'INCIDENT_DELETE', 'INCIDENT_BULK_DELETE'
];

const AuditLogsList = ({ selectedIds = [], setSelectedIds, triggerBulkDelete }) => {
  const { t } = useTranslation();
  const [logs, setLogs] = useState([]);
  const { isLoading: loading, showLoading, hideLoading } = useLoader(false);
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('all');
  const [role, setRole] = useState('all');
  const [order, setOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [total, setTotal] = useState(0);

  const getActionVariant = (act) => {
    if (!act) return 'neutral';
    if (act.includes('DELETE') || act.includes('BLOCK') || (act.includes('ISOLATE') && !act.includes('UNISOLATE'))) return 'danger';
    if (act.includes('CREATE') || act.includes('UNBLOCK') || act.includes('UNISOLATE')) return 'success';
    if (act.includes('UPDATE') || act.includes('ANALYZE')) return 'warning';
    return 'neutral';
  };

  const [expandedId, setExpandedId] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [logToDelete, setLogToDelete] = useState(null);

  useEffect(() => {
    if (triggerBulkDelete > 0) {
      confirmDelete('bulk');
    }
  }, [triggerBulkDelete]);

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedIds(logs.map(log => log.id || log._id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelect = (id, checked) => {
    if (checked) {
      setSelectedIds(prev => [...prev, id]);
    } else {
      setSelectedIds(prev => prev.filter(item => item !== id));
    }
  };

  const confirmDelete = (id) => {
    setLogToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    try {
      if (logToDelete === 'bulk') {
        await ApiAudit.bulkDeleteLogs(selectedIds);
        toast.success(t('common.delete_success', 'Xóa thành công'));
        setSelectedIds([]);
      } else {
        await ApiAudit.deleteLog(logToDelete);
        toast.success(t('common.delete_success', 'Xóa thành công'));
      }
      setIsDeleteModalOpen(false);
      fetchLogs();
    } catch (error) {
      toast.error(t('common.delete_error', 'Xóa thất bại'));
    }
  };

  const fetchLogs = async () => {
    try {
      showLoading();
      const res = await ApiAudit.getLogs({
        page,
        per_page: perPage,
        search,
        action: action !== 'all' ? action : undefined,
        role: role !== 'all' ? role : undefined,
        order,
      });
      if (res.data) {
        setLogs(res.data);
        setTotal(res.pagination?.total || res.meta?.total || res.data.length);
      } else if (Array.isArray(res)) {
        setLogs(res);
        setTotal(res.length);
      } else {
        setLogs([]);
        setTotal(0);
      }
    } catch (err) {
      console.error(err);
      toast.error(t('audit.fetch_error'));
    } finally {
      hideLoading();
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => fetchLogs(), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line
  }, [page, perPage, search, action, order]);

  return (
    <div className="audit-logs-section">
      <VFilterPage
        searchPlaceholder={t('audit.search_placeholder')}
        searchValue={search}
        onSearchChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
      >
        <VSelectFilter
          value={role}
          onChange={(val) => {
            setRole(val);
            setPage(1);
          }}
          placeholder={t('audit.all_roles', 'Tất cả vai trò')}
          options={[
            { value: 'admin', label: 'Admin' },
            { value: 'l1_analyst', label: 'L1 Analyst' },
            { value: 'l2_responder', label: 'L2 Responder' },
            { value: 'l3_manager', label: 'L3 Manager' },
            { value: 'ot_operator', label: 'OT Operator' }
          ]}
        />
        <VSelectFilter
          value={action}
          onChange={(val) => {
            setAction(val);
            setPage(1);
          }}
          placeholder={t('audit.all_actions', 'Tất cả hành động')}
          options={[
            ...AUDIT_ACTIONS.map(act => ({ value: act, label: act }))
          ]}
        />
        {/* Order filter */}
        <VSelectFilter
          value={order}
          defaultValue="desc"
          onChange={(val) => { setOrder(val); setPage(1); }}
          placeholder={t('assets.filter_order_desc')}
          options={[
            { value: 'asc', label: t('assets.filter_order_asc') },
            { value: 'desc', label: t('assets.filter_order_desc') },
          ]}
        />
      </VFilterPage>

      <div className="list-container">
        {/* --- DESKTOP TABLE VIEW --- */}
        <div className="table-wrapper">
          {loading ? (
            <div className="loading-state">{t('common.processing_data')}</div>
          ) : logs.length === 0 ? (
            <VNoData message={t('assets.list.no_data')} />
          ) : (
            <table className="v-table">
              <thead>
                <tr>
                  <th style={{ width: '40px', textAlign: 'center' }}>
                    <VCheckbox 
                      checked={logs.length > 0 && selectedIds.length === logs.length}
                      indeterminate={selectedIds.length > 0 && selectedIds.length < logs.length}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                    />
                  </th>
                  <th>{t('audit.logs.table_username', 'TÊN NGƯỜI DÙNG')}</th>
                  <th>{t('audit.logs.table_email', 'EMAIL')}</th>
                  <th>{t('audit.logs.table_role', 'VAI TRÒ')}</th>
                  <th>{t('audit.logs.table_action')}</th>
                  <th>{t('audit.logs.table_ip')}</th>
                  <th style={{ whiteSpace: 'nowrap' }}>{t('common.created_at', 'Ngày tạo')}</th>
                  <th style={{ whiteSpace: 'nowrap' }}>{t('common.updated_at', 'Ngày cập nhật')}</th>
                  <th className="actions-col">{t('assets.list.table_actions')}</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id || log._id} className={selectedIds.includes(log.id || log._id) ? 'selected-row' : ''}>
                    <td style={{ textAlign: 'center' }}>
                      <VCheckbox 
                        checked={selectedIds.includes(log.id || log._id)}
                        onChange={(e) => handleSelect(log.id || log._id, e.target.checked)}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>
                    <td style={{ maxWidth: '150px' }}>
                      <div className="user-info" style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                        <User size={16} style={{ flexShrink: 0 }} />
                        <span className="truncate-text" style={{ flex: 1, minWidth: 0 }} title={log.username}>{log.username || 'System'}</span>
                      </div>
                    </td>
                    <td style={{ maxWidth: '180px' }}>
                      <div className="truncate-text" title={log.email || log.details?.body?.email || 'N/A'}>{log.email || log.details?.body?.email || 'N/A'}</div>
                    </td>
                    <td>
                      <span className="truncate-text" title={log.role}>{log.role || 'System'}</span>
                    </td>
                    <td>
                      <VStatus status={getActionVariant(log.action)} label={log.action} />
                    </td>
                    <td>
                      {log.ipAddress || 'N/A'}
                    </td>
                    <td className="time-col">
                      {formatDate(log.createdAt)}
                    </td>
                    <td className="time-col">
                      {formatDate(log.updatedAt)}
                    </td>
                    <td className="actions-col">
                      <ActionMenu
                        actions={[
                          { label: 'Xóa', icon: Trash2, danger: true, onClick: () => confirmDelete(log.id || log._id) }
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* --- MOBILE LIST VIEW --- */}
        {!loading && logs.length > 0 && (
          <div className="mobile-list">
            <div className="mobile-list-header">
              <div className="col-checkbox" style={{ width: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <input
                  type="checkbox"
                  checked={logs.length > 0 && selectedIds.length === logs.length}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
              </div>
              <div className="col-id">{t('audit.logs.table_user')} & {t('audit.logs.table_action')}</div>
              <div className="col-action"></div>
            </div>

            {logs.map(log => {
              const id = log.id || log._id;
              const isExpanded = expandedId === id;

              return (
                <div className={`mobile-card ${isExpanded ? 'expanded' : ''} ${selectedIds.includes(id) ? 'selected' : ''}`} key={id}>
                  <div className="mobile-card-header" onClick={() => toggleExpand(id)}>
                    <div className="col-checkbox" style={{ width: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(id)}
                        onChange={(e) => handleSelect(id, e.target.checked)}
                        style={{ cursor: 'pointer' }}
                      />
                    </div>
                    <div className="col-id">
                      <div className="user-info" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <User size={16} style={{ flexShrink: 0, color: 'var(--slate-400)' }} />
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <strong className="truncate-text" style={{ maxWidth: '150px' }}>{log.username || 'System'}</strong>
                          <span style={{ fontSize: '12px', color: 'var(--slate-500)' }}>{formatDate(log.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="col-action">
                      {isExpanded ? <ChevronUp size={20} className="expand-icon" /> : <ChevronDown size={20} className="expand-icon" />}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mobile-card-body">
                      <div className="detail-row">
                        <span className="detail-label">{t('audit.logs.table_action')}</span>
                        <span className="detail-value">
                          <VStatus status={getActionVariant(log.action)} label={log.action} />
                        </span>
                        <div className="card-action-menu" style={{ marginLeft: '12px' }}>
                          <ActionMenu
                            actions={[
                              { label: t('common.delete'), icon: Trash2, danger: true, onClick: () => confirmDelete(id) }
                            ]}
                            direction="down"
                          />
                        </div>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">{t('audit.logs.table_ip')}</span>
                        <span className="detail-value">{log.ipAddress || '-'}</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">{t('common.created_at', 'Ngày tạo')}</span>
                        <span className="detail-value">{formatDate(log.createdAt)}</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">{t('common.updated_at', 'Ngày cập nhật')}</span>
                        <span className="detail-value">{formatDate(log.updatedAt)}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {logs && logs.length > 0 && (
        <VPagination
          page={page}
          perPage={perPage}
          total={total}
          dataLength={logs.length}
          itemName={t('audit.tab_logs')}
          onPageChange={(newPage) => setPage(newPage)}
          onPerPageChange={(newPerPage) => {
            setPerPage(newPerPage);
            setPage(1);
          }}
        />
      )}
      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDelete}
        title={t('audit.confirm_delete', 'Xóa nhật ký')}
        message={logToDelete === 'bulk'
          ? t('audit.confirm_bulk_delete_msg', 'Bạn có chắc chắn muốn xóa các nhật ký đã chọn?')
          : t('audit.confirm_delete_msg', 'Bạn có chắc chắn muốn xóa nhật ký này không?')}
      />
    </div>
  );
};

export default AuditLogsList;

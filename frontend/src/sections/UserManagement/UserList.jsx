import React from 'react';
import { Edit2, Trash2, User, ChevronDown, ChevronUp } from 'lucide-react';
import ActionMenu from '@/components/ActionMenu';
import VNoData from '@/components/VNoData';
import VStatus from '@/components/VStatus';
import VCheckbox from '@/components/VCheckbox';
import { useTranslation } from 'react-i18next';
import { formatDate } from '@/utils/formatDate';
import { useExpandable } from '@/hooks/useExpandable';

const UserList = ({ 
  users, 
  loading, 
  onEdit, 
  onDelete, 
  selectedIds = [],
  onSelect,
  onSelectAll
}) => {
  const { t } = useTranslation();
  const { expandedId, toggleExpand } = useExpandable();

  const getRoleLabel = (role) => {
    switch (role) {
      case 'admin': return t('users.list.role_admin');
      case 'customer': return t('users.list.role_customer');
      default: return role;
    }
  };
  
  if (loading) {
    return <div className="user-loading">{t('users.list.loading')}</div>;
  }

  if (!users || users.length === 0) {
    return <VNoData message={t('users.list.no_data')} />;
  }

  const allSelected = users.length > 0 && selectedIds.length === users.length;

  return (
    <div className="user-list-container">
      {/* --- DESKTOP TABLE VIEW --- */}
      <div className="user-table-wrapper">
        <table className="user-table">
          <thead>
            <tr>
              <th style={{ width: '2.8571rem', textAlign: 'center' }}>
                <VCheckbox 
                  checked={allSelected} 
                  indeterminate={selectedIds.length > 0 && selectedIds.length < users.length}
                  onChange={(e) => onSelectAll(e.target.checked)} 
                  style={{ cursor: 'pointer' }}
                />
              </th>
              <th>{t('users.list.table_fullname')}</th>
              <th>{t('users.list.table_email')}</th>
              <th>{t('users.list.table_role')}</th>
              <th>{t('users.list.table_status')}</th>
              <th>{t('common.created_at', 'Ngày tạo')}</th>
              <th>{t('common.updated_at', 'Ngày cập nhật')}</th>
              <th className="actions-col">{t('users.list.table_actions')}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user, index) => {
              const id = user.id || user._id;
              const isSelected = selectedIds.includes(id);
              const actions = [
                { label: t('users.list.btn_edit'), icon: Edit2, onClick: () => onEdit(user) },
                { label: t('users.list.btn_delete'), icon: Trash2, danger: true, onClick: () => onDelete(id) }
              ];

              return (
                <tr key={id} className={isSelected ? 'selected-row' : ''}>
                  <td style={{ textAlign: 'center' }}>
                    <VCheckbox 
                      checked={isSelected}
                      onChange={(e) => onSelect(id, e.target.checked)}
                      style={{ cursor: 'pointer' }}
                    />
                  </td>
                  <td style={{ maxWidth: '10.7143rem' }}>
                    <div className="truncate-text" title={user.full_name}>{user.full_name || 'N/A'}</div>
                  </td>
                  <td style={{ maxWidth: '12.8571rem' }}>
                    <div className="truncate-text" title={user.email}>{user.email || 'N/A'}</div>
                  </td>
                  <td>
                    <VStatus 
                      label={getRoleLabel(user.role)}
                      className="badge-outline"
                    />
                  </td>
                  <td>
                    <VStatus 
                      status={user.is_active ? 'active' : 'inactive'} 
                      label={user.is_active ? t('users.list.status_active') : t('users.list.status_inactive')} 
                    />
                  </td>
                  <td style={{ whiteSpace: 'nowrap', fontSize: '0.9286rem' }}>{formatDate(user.createdAt)}</td>
                  <td style={{ whiteSpace: 'nowrap', fontSize: '0.9286rem' }}>{formatDate(user.updatedAt)}</td>
                  <td className="actions-col">
                    <ActionMenu 
                      actions={actions} 
                      direction={index >= users.length - 2 && users.length > 2 ? 'up' : 'down'} 
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* --- MOBILE LIST VIEW --- */}
      <div className="mobile-user-list">
        <div className="mobile-list-header" style={{ display: 'flex', alignItems: 'center' }}>
          <div className="col-checkbox" style={{ width: '2.8571rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <VCheckbox 
              checked={allSelected} 
              indeterminate={selectedIds.length > 0 && selectedIds.length < users.length}
              onChange={(e) => onSelectAll(e.target.checked)} 
              style={{ cursor: 'pointer' }}
            />
          </div>
          <div className="col-title">{t('users.list.mobile_fullname')}</div>
          <div className="col-action"></div>
        </div>
        
        {users.map((user, index) => {
          const id = user.id || user._id;
          const isExpanded = expandedId === id;
          const isSelected = selectedIds.includes(id);
          const actions = [
            { label: t('users.list.btn_edit'), icon: Edit2, onClick: () => onEdit(user) },
            { label: t('users.list.btn_delete'), icon: Trash2, danger: true, onClick: () => onDelete(id) }
          ];

          return (
            <div className={`mobile-card ${isExpanded ? 'expanded' : ''} ${isSelected ? 'selected' : ''}`} key={id}>
              {/* Card Header */}
              <div className="mobile-card-header" style={{ display: 'flex', alignItems: 'center' }}>
                <div className="col-checkbox" style={{ width: '2.8571rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <VCheckbox 
                    checked={isSelected}
                    onChange={(e) => onSelect(id, e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                </div>
                <div className="col-id" onClick={() => toggleExpand(id)}><strong>{user.username}</strong></div>
                <div className="col-title truncate-text" onClick={() => toggleExpand(id)}>{user.full_name}</div>
                <div className="col-action" onClick={() => toggleExpand(id)}>
                  {isExpanded ? <ChevronUp size={20} className="expand-icon" /> : <ChevronDown size={20} className="expand-icon" />}
                </div>
              </div>
              
              {/* Card Body */}
              {isExpanded && (
                <div className="mobile-card-body">
                  <div className="detail-row">
                    <span className="detail-label">{t('users.list.table_role')}</span>
                    <span className="detail-value">
                      <VStatus 
                        label={getRoleLabel(user.role)}
                        className="badge-outline"
                      />
                    </span>
                    <div className="card-action-menu">
                      <ActionMenu actions={actions} direction="down" />
                    </div>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">{t('users.list.table_email')}</span>
                    <span className="detail-value">{user.email || 'N/A'}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">{t('users.list.table_status')}</span>
                    <span className="detail-value">
                      <VStatus 
                        status={user.is_active ? 'active' : 'inactive'} 
                        label={user.is_active ? t('users.list.status_active') : t('users.list.status_inactive')} 
                      />
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">{t('common.created_at', 'Ngày tạo')}</span>
                    <span className="detail-value">{formatDate(user.createdAt)}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">{t('common.updated_at', 'Ngày cập nhật')}</span>
                    <span className="detail-value">{formatDate(user.updatedAt)}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default UserList;

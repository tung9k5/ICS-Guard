import React, { useState } from 'react';
import { Edit2, Trash2, User, ChevronDown, ChevronUp } from 'lucide-react';
import ActionMenu from '@/components/ActionMenu';
import VNoData from '@/components/VNoData';
import VStatus from '@/components/VStatus';
import VCheckbox from '@/components/VCheckbox';
import { useTranslation } from 'react-i18next';

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
  const [expandedId, setExpandedId] = useState(null);

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const getRoleLabel = (role) => {
    switch (role) {
      case 'admin': return t('users.list.role_admin');
      case 'l1_analyst': return t('users.list.role_l1');
      case 'l2_responder': return t('users.list.role_l2');
      case 'l3_manager': return t('users.list.role_l3');
      case 'ot_operator': return t('users.list.role_ot');
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
              <th style={{ width: '40px', textAlign: 'center' }}>
                <VCheckbox 
                  checked={allSelected} 
                  indeterminate={selectedIds.length > 0 && selectedIds.length < users.length}
                  onChange={(e) => onSelectAll(e.target.checked)} 
                  style={{ cursor: 'pointer' }}
                />
              </th>
              <th>{t('users.list.table_username')}</th>
              <th>{t('users.list.table_fullname')}</th>
              <th>{t('users.list.table_email')}</th>
              <th>{t('users.list.table_role')}</th>
              <th>{t('users.list.table_status')}</th>
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
                  <td>
                    <div className="user-name" title={user.username}>
                      <User size={16} className="text-primary" style={{ flexShrink: 0 }} />
                      <span className="truncate-text">{user.username}</span>
                    </div>
                  </td>
                  <td>
                    <span className="truncate-text" title={user.full_name}>{user.full_name || 'N/A'}</span>
                  </td>
                  <td>
                    <span className="truncate-text" title={user.email}>{user.email || 'N/A'}</span>
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
          <div className="col-checkbox" style={{ width: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <VCheckbox 
              checked={allSelected} 
              indeterminate={selectedIds.length > 0 && selectedIds.length < users.length}
              onChange={(e) => onSelectAll(e.target.checked)} 
              style={{ cursor: 'pointer' }}
            />
          </div>
          <div className="col-id">{t('users.list.mobile_username')}</div>
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
                <div className="col-checkbox" style={{ width: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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

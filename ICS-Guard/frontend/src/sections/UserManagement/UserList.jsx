import React, { useState } from 'react';
import { Edit2, Trash2, User, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import { jwtDecode } from 'jwt-decode';
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
  onRestore,
  selectedIds = [],
  onSelect,
  onSelectAll
}) => {
  const { t } = useTranslation();
  const [expandedId, setExpandedId] = useState(null);

  const token = localStorage.getItem('access_token');
  let currentUserId = null;
  try {
    if (token) {
      const payload = jwtDecode(token);
      currentUserId = payload.id || payload.userId || payload._id;
    }
  } catch (e) {}

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const getRoleLabel = (role) => {
    switch (role) {
      case 'admin': return t('users.list.role_admin', 'Quản trị viên (Admin)');
      case 'analyst': return t('users.list.role_l1', 'Chuyên viên phân tích');
      case 'hr_management': return 'Quản lý nhân sự (HR)';
      case 'device_management': return 'Quản lý thiết bị';
      case 'l2_responder': return t('users.list.role_l2', 'L2 Responder');
      case 'ot_operator': return t('users.list.role_ot', 'OT Operator');
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
              <th>Trạng thái TK</th>
              <th className="actions-col">{t('users.list.table_actions')}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user, index) => {
              const id = user.id || user._id;
              const isSelected = selectedIds.includes(id);
              const isSelf = String(id) === String(currentUserId);
              const isLocked = user.status === 'locked' || user.deletion_pending === true || user.is_active === false;

              // Trạng thái đã khóa/chờ hủy: CHỈ có thao tác Khôi phục
              const actions = isLocked
                ? [{ label: 'Khôi phục tài khoản', icon: RotateCcw, onClick: () => onRestore && onRestore(id) }]
                : [
                    { label: t('users.list.btn_edit'), icon: Edit2, onClick: () => onEdit(user) },
                    ...(!isSelf ? [{ label: t('users.list.btn_delete'), icon: Trash2, danger: true, onClick: () => onDelete(id) }] : [])
                  ];

              return (
                <tr key={id} className={isSelected ? 'selected-row' : ''}>
                  <td style={{ textAlign: 'center' }}>
                    <VCheckbox 
                      checked={isSelected}
                      disabled={isSelf || isLocked}
                      onChange={(e) => onSelect(id, e.target.checked)}
                      style={{ cursor: isSelf || isLocked ? 'not-allowed' : 'pointer' }}
                    />
                  </td>
                  <td>
                    <div className="user-name" title={user.username}>
                      <User size={16} className="text-primary" style={{ flexShrink: 0 }} />
                      <span className="truncate-text" style={{ fontWeight: isSelf ? 700 : 500 }}>{user.username}</span>
                      {isSelf && (
                        <span style={{ background: 'rgba(59, 130, 246, 0.18)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.35)', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, marginLeft: '6px', whiteSpace: 'nowrap' }}>
                          [Bạn]
                        </span>
                      )}
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
                    {isLocked ? (
                      <span className="user-account-badge user-account-badge--locked" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '4px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: '600' }}>
                        Đã khóa / Chờ hủy
                      </span>
                    ) : (user.username === 'admin' || user.is_activated === true) || (user.is_active !== false && user.isFirstLogin === false) ? (
                      <span className="user-account-badge user-account-badge--active" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '4px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: '600' }}>
                        Đã kích hoạt
                      </span>
                    ) : (
                      <span className="user-account-badge user-account-badge--pending" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '4px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: '600' }}>
                        Chưa kích hoạt
                      </span>
                    )}
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
          const isSelf = String(id) === String(currentUserId);
          const isLocked = user.status === 'locked' || user.deletion_pending === true || user.is_active === false;

          const actions = isLocked
            ? [{ label: 'Khôi phục tài khoản', icon: RotateCcw, onClick: () => onRestore && onRestore(id) }]
            : [
                { label: t('users.list.btn_edit'), icon: Edit2, onClick: () => onEdit(user) },
                ...(!isSelf ? [{ label: t('users.list.btn_delete'), icon: Trash2, danger: true, onClick: () => onDelete(id) }] : [])
              ];

          return (
            <div className={`mobile-card ${isExpanded ? 'expanded' : ''} ${isSelected ? 'selected' : ''}`} key={id}>
              {/* Card Header */}
              <div className="mobile-card-header" style={{ display: 'flex', alignItems: 'center' }}>
                <div className="col-checkbox" style={{ width: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <VCheckbox 
                    checked={isSelected}
                    disabled={isSelf || isLocked}
                    onChange={(e) => onSelect(id, e.target.checked)}
                    style={{ cursor: isSelf || isLocked ? 'not-allowed' : 'pointer' }}
                  />
                </div>
                <div className="col-id" onClick={() => toggleExpand(id)}>
                  <strong>{user.username} {isSelf && '[Bạn]'}</strong>
                </div>
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
                    <span className="detail-label">Trạng thái TK</span>
                    <span className="detail-value">
                      {isLocked ? (
                        <span className="user-account-badge user-account-badge--locked">Đã khóa / Chờ hủy</span>
                      ) : user.isFirstLogin !== false ? (
                        <span className="user-account-badge user-account-badge--pending">Chưa kích hoạt</span>
                      ) : (
                        <span className="user-account-badge user-account-badge--active">Đã kích hoạt</span>
                      )}
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

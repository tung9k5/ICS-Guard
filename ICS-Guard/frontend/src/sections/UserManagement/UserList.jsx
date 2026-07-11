import React, { useState, useRef, useEffect } from 'react';
import { Edit2, Trash2, User, ChevronDown, ChevronUp } from 'lucide-react';
import ActionMenu from '@/components/ActionMenu';
import VNoData from '@/components/VNoData';
import VStatus from '@/components/VStatus';

const IndeterminateCheckbox = ({ indeterminate, ...rest }) => {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = typeof indeterminate === 'boolean' ? indeterminate : false;
    }
  }, [indeterminate]);
  return <input type="checkbox" ref={ref} {...rest} />;
};

const getRoleLabel = (role) => {
  switch (role) {
    case 'admin': return 'Quản trị viên';
    case 'l1_analyst': return 'Nhà phân tích (L1)';
    case 'l2_responder': return 'Phản ứng viên (L2)';
    case 'l3_manager': return 'Quản lý (L3)';
    case 'ot_operator': return 'Vận hành viên (OT)';
    default: return role;
  }
};

const UserList = ({ 
  users, 
  loading, 
  onEdit, 
  onDelete, 
  selectedIds = [],
  onSelect,
  onSelectAll
}) => {
  const [expandedId, setExpandedId] = useState(null);

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };
  
  if (loading) {
    return <div className="user-loading">Đang tải dữ liệu...</div>;
  }

  if (!users || users.length === 0) {
    return <VNoData message="Không có dữ liệu người dùng" />;
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
                <IndeterminateCheckbox 
                  checked={allSelected} 
                  indeterminate={selectedIds.length > 0 && selectedIds.length < users.length}
                  onChange={(e) => onSelectAll(e.target.checked)} 
                  style={{ cursor: 'pointer' }}
                />
              </th>
              <th>Tên đăng nhập</th>
              <th>Họ và tên</th>
              <th>Email</th>
              <th>Vai trò</th>
              <th>Trạng thái</th>
              <th className="actions-col">Hành động</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user, index) => {
              const id = user.id || user._id;
              const isSelected = selectedIds.includes(id);
              const actions = [
                { label: 'Sửa', icon: Edit2, onClick: () => onEdit(user) },
                { label: 'Xóa', icon: Trash2, danger: true, onClick: () => onDelete(id) }
              ];

              return (
                <tr key={id} className={isSelected ? 'selected-row' : ''}>
                  <td style={{ textAlign: 'center' }}>
                    <input 
                      type="checkbox" 
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
                      label={user.is_active ? 'Hoạt động' : 'Không hoạt động'} 
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
            <IndeterminateCheckbox 
              checked={allSelected} 
              indeterminate={selectedIds.length > 0 && selectedIds.length < users.length}
              onChange={(e) => onSelectAll(e.target.checked)} 
              style={{ cursor: 'pointer' }}
            />
          </div>
          <div className="col-id">Tên ĐN</div>
          <div className="col-title">Họ và tên</div>
          <div className="col-action"></div>
        </div>
        
        {users.map((user, index) => {
          const id = user.id || user._id;
          const isExpanded = expandedId === id;
          const isSelected = selectedIds.includes(id);
          const actions = [
            { label: 'Sửa', icon: Edit2, onClick: () => onEdit(user) },
            { label: 'Xóa', icon: Trash2, danger: true, onClick: () => onDelete(id) }
          ];

          return (
            <div className={`mobile-card ${isExpanded ? 'expanded' : ''} ${isSelected ? 'selected' : ''}`} key={id}>
              {/* Card Header */}
              <div className="mobile-card-header" style={{ display: 'flex', alignItems: 'center' }}>
                <div className="col-checkbox" style={{ width: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <input 
                    type="checkbox" 
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
                    <span className="detail-label">Vai trò</span>
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
                    <span className="detail-label">Email</span>
                    <span className="detail-value">{user.email || 'N/A'}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Trạng thái</span>
                    <span className="detail-value">
                      <VStatus 
                        status={user.is_active ? 'active' : 'inactive'} 
                        label={user.is_active ? 'Hoạt động' : 'Không hoạt động'} 
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

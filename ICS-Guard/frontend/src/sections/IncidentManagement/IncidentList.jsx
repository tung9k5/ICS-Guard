import React, { useState, useRef, useEffect } from 'react';
import { Edit2, Trash2, ShieldAlert, ChevronDown, ChevronUp, Bot } from 'lucide-react';
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

const getSeverityStyle = (severity) => {
  switch (severity) {
    case 'CRITICAL': return { backgroundColor: 'var(--red-100)', color: 'var(--red-700)', borderColor: 'var(--red-300)' };
    case 'HIGH': return { backgroundColor: 'var(--orange-100)', color: 'var(--orange-700)', borderColor: 'var(--orange-300)' };
    case 'MEDIUM': return { backgroundColor: 'var(--amber-100)', color: 'var(--amber-700)', borderColor: 'var(--amber-300)' };
    case 'LOW': return { backgroundColor: 'var(--green-100)', color: 'var(--green-700)', borderColor: 'var(--green-300)' };
    default: return {};
  }
};

const getStatusLabel = (status) => {
  switch (status) {
    case 'open': return 'Mở';
    case 'investigating': return 'Đang điều tra';
    case 'remediated': return 'Đã khắc phục';
    case 'closed': return 'Đã đóng';
    default: return status;
  }
};

const IncidentList = ({ 
  incidents, 
  loading, 
  onEdit, 
  onDelete, 
  onAiAnalyze,
  selectedIds = [],
  onSelect,
  onSelectAll
}) => {
  const [expandedId, setExpandedId] = useState(null);

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };
  
  if (loading) {
    return <div className="incident-loading">Đang tải dữ liệu...</div>;
  }

  if (!incidents || incidents.length === 0) {
    return <VNoData message="Không có dữ liệu sự cố" />;
  }

  const allSelected = incidents.length > 0 && selectedIds.length === incidents.length;

  return (
    <div className="incident-list-container">
      {/* --- DESKTOP TABLE VIEW --- */}
      <div className="incident-table-wrapper">
        <table className="incident-table">
          <thead>
            <tr>
              <th style={{ width: '40px', textAlign: 'center' }}>
                <IndeterminateCheckbox 
                  checked={allSelected} 
                  indeterminate={selectedIds.length > 0 && selectedIds.length < incidents.length}
                  onChange={(e) => onSelectAll(e.target.checked)} 
                  style={{ cursor: 'pointer' }}
                />
              </th>
              <th>Tên sự cố</th>
              <th>Mức độ</th>
              <th>Trạng thái</th>
              <th>Mô tả</th>
              <th className="actions-col">Hành động</th>
            </tr>
          </thead>
          <tbody>
            {incidents.map((incident, index) => {
              const id = incident.id || incident._id;
              const isSelected = selectedIds.includes(id);
              const actions = [
                { label: 'Phân tích AI', icon: Bot, onClick: () => onAiAnalyze(id) },
                { label: 'Sửa', icon: Edit2, onClick: () => onEdit(incident) },
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
                    <div className="incident-name" title={incident.title}>
                      <ShieldAlert size={16} className="text-primary" style={{ flexShrink: 0 }} />
                      <span className="truncate-text">{incident.title}</span>
                    </div>
                  </td>
                  <td>
                    <VStatus 
                      label={incident.severity || 'N/A'}
                      style={getSeverityStyle(incident.severity)}
                      className="badge-outline"
                    />
                  </td>
                  <td>
                    <VStatus 
                      status={incident.status === 'open' ? 'inactive' : incident.status === 'closed' ? 'active' : 'default'} 
                      label={getStatusLabel(incident.status)} 
                    />
                  </td>
                  <td className="text-muted">
                    <span className="truncate-text" title={incident.description}>{incident.description || 'Không có mô tả'}</span>
                  </td>
                  <td className="actions-col">
                    <ActionMenu 
                      actions={actions} 
                      direction={index >= incidents.length - 2 && incidents.length > 2 ? 'up' : 'down'} 
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* --- MOBILE LIST VIEW --- */}
      <div className="mobile-incident-list">
        <div className="mobile-list-header" style={{ display: 'flex', alignItems: 'center' }}>
          <div className="col-checkbox" style={{ width: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <IndeterminateCheckbox 
              checked={allSelected} 
              indeterminate={selectedIds.length > 0 && selectedIds.length < incidents.length}
              onChange={(e) => onSelectAll(e.target.checked)} 
              style={{ cursor: 'pointer' }}
            />
          </div>
          <div className="col-id">Tên sự cố</div>
          <div className="col-action"></div>
        </div>
        
        {incidents.map((incident, index) => {
          const id = incident.id || incident._id;
          const isExpanded = expandedId === id;
          const isSelected = selectedIds.includes(id);
          const actions = [
            { label: 'Phân tích AI', icon: Bot, onClick: () => onAiAnalyze(id) },
            { label: 'Sửa', icon: Edit2, onClick: () => onEdit(incident) },
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
                <div className="col-title truncate-text" onClick={() => toggleExpand(id)}><strong>{incident.title}</strong></div>
                <div className="col-action" onClick={() => toggleExpand(id)}>
                  {isExpanded ? <ChevronUp size={20} className="expand-icon" /> : <ChevronDown size={20} className="expand-icon" />}
                </div>
              </div>
              
              {/* Card Body */}
              {isExpanded && (
                <div className="mobile-card-body">
                  <div className="detail-row">
                    <span className="detail-label">Mức độ</span>
                    <span className="detail-value">
                      <VStatus 
                        label={incident.severity || 'N/A'}
                        style={getSeverityStyle(incident.severity)}
                        className="badge-outline"
                      />
                    </span>
                    <div className="card-action-menu">
                      <ActionMenu actions={actions} direction="down" />
                    </div>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Trạng thái</span>
                    <span className="detail-value">
                      <VStatus 
                        status={incident.status === 'open' ? 'inactive' : incident.status === 'closed' ? 'active' : 'default'} 
                        label={getStatusLabel(incident.status)} 
                      />
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Mô tả</span>
                    <span className="detail-value">{incident.description || 'Không có mô tả'}</span>
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

export default IncidentList;

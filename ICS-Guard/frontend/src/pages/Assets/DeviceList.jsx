import React, { useState } from 'react';
import { Edit2, Trash2, Server, Activity, ChevronDown, ChevronUp } from 'lucide-react';
import ActionMenu from '@/components/common/UI/ActionMenu';
import VNoData from '@/components/common/UI/VNoData';

const DeviceList = ({ devices, loading, onEdit, onDelete, onView }) => {
  const [expandedId, setExpandedId] = useState(null);

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };
  if (loading) {
    return <div className="device-loading">Đang tải dữ liệu...</div>;
  }

  if (!devices || devices.length === 0) {
    return <VNoData message="Chưa có thiết bị nào trong hệ thống." />;
  }

  return (
    <div className="device-list-container">
      {/* --- DESKTOP TABLE VIEW --- */}
      <div className="device-table-wrapper">
        <table className="device-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Tên thiết bị</th>
              <th>Loại (Type)</th>
              <th>IP Address</th>
              <th>MAC Address</th>
              <th>Trạng thái</th>
              <th>Mô tả</th>
              <th className="actions-col">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {devices.map((device, index) => {
              const actions = [
                { label: 'Chỉnh sửa', icon: Edit2, onClick: () => onEdit(device) },
                { label: 'Xóa thiết bị', icon: Trash2, danger: true, onClick: () => onDelete(device.id || device._id) }
              ];

              return (
                <tr key={device.id || device._id}>
                  <td><strong>{device.id || device._id}</strong></td>
                  <td>
                    <div className="device-name" title={device.name}>
                      <Activity size={16} className="text-primary" style={{ flexShrink: 0 }} />
                      <span className="truncate-text">{device.name}</span>
                    </div>
                  </td>
                  <td><span className="badge badge-outline">{device.type || 'N/A'}</span></td>
                  <td>{device.ip_address || device.ipAddress || 'N/A'}</td>
                  <td>{device.mac_address || device.macAddress || 'N/A'}</td>
                  <td>
                    <span className={`badge ${device.status === 'active' ? 'badge-success' : 'badge-danger'}`}>
                      {device.status === 'active' ? 'Đang hoạt động' : 'Vô hiệu hóa'}
                    </span>
                  </td>
                  <td className="text-muted">
                    <span className="truncate-text" title={device.description}>{device.description || '-'}</span>
                  </td>
                  <td className="actions-col">
                    <ActionMenu 
                      actions={actions} 
                      direction={index >= devices.length - 2 && devices.length > 2 ? 'up' : 'down'} 
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* --- MOBILE LIST VIEW --- */}
      <div className="mobile-device-list">
        <div className="mobile-list-header">
          <div className="col-id">Mã</div>
          <div className="col-title">Tên thiết bị</div>
          <div className="col-action"></div>
        </div>
        
        {devices.map((device, index) => {
          const id = device.id || device._id;
          const isExpanded = expandedId === id;
          const actions = [
            { label: 'Chỉnh sửa', icon: Edit2, onClick: () => onEdit(device) },
            { label: 'Xóa thiết bị', icon: Trash2, danger: true, onClick: () => onDelete(id) }
          ];

          return (
            <div className={`mobile-card ${isExpanded ? 'expanded' : ''}`} key={id}>
              {/* Card Header (Always visible) */}
              <div className="mobile-card-header" onClick={() => toggleExpand(id)}>
                <div className="col-id"><strong>{id.substring(0, 8)}...</strong></div>
                <div className="col-title truncate-text">{device.name}</div>
                <div className="col-action">
                  {isExpanded ? <ChevronUp size={20} className="expand-icon" /> : <ChevronDown size={20} className="expand-icon" />}
                </div>
              </div>
              
              {/* Card Body (Visible when expanded) */}
              {isExpanded && (
                <div className="mobile-card-body">
                  <div className="detail-row">
                    <span className="detail-label">Loại thiết bị</span>
                    <span className="detail-value">{device.type || 'N/A'}</span>
                    <div className="card-action-menu">
                      <ActionMenu actions={actions} direction="down" />
                    </div>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">IP Address</span>
                    <span className="detail-value">{device.ip_address || device.ipAddress || 'N/A'}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">MAC Address</span>
                    <span className="detail-value">{device.mac_address || device.macAddress || 'N/A'}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Trạng thái</span>
                    <span className="detail-value">
                      <span className={`badge ${device.status === 'active' ? 'badge-success' : 'badge-danger'}`}>
                        {device.status === 'active' ? 'Đang hoạt động' : 'Vô hiệu hóa'}
                      </span>
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Mô tả</span>
                    <span className="detail-value text-muted">{device.description || '-'}</span>
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

export default DeviceList;

import React, { useState } from 'react';
import { Edit2, Trash2, Activity, ChevronDown, ChevronUp } from 'lucide-react';
import ActionMenu from '@/components/ActionMenu';
import VNoData from '@/components/VNoData';
import VStatus from '@/components/VStatus';
import VCheckbox from '@/components/VCheckbox';
import { getDeviceTypeLabel, getDeviceTypeStyle } from '@/constants/deviceConstants';
import { useTranslation } from 'react-i18next';
import { formatDate } from '@/utils/formatDate';

const DeviceList = ({ 
  devices, 
  loading, 
  onEdit, 
  onDelete, 
  onView,
  selectedIds = [],
  onSelect,
  onSelectAll
}) => {
  const { t } = useTranslation();
  const [expandedId, setExpandedId] = useState(null);

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };
  
  if (loading) {
    return <div className="device-loading">{t('assets.list.loading')}</div>;
  }

  if (!devices || devices.length === 0) {
    return <VNoData message={t('assets.list.no_data')} />;
  }

  const allSelected = devices.length > 0 && selectedIds.length === devices.length;

  return (
    <div className="device-list-container">
      {/* --- DESKTOP TABLE VIEW --- */}
      <div className="device-table-wrapper">
        <table className="device-table">
          <thead>
            <tr>
              <th style={{ width: '40px', textAlign: 'center' }}>
                <VCheckbox 
                  indeterminate={selectedIds.length > 0 && selectedIds.length < devices.length}
                  checked={allSelected} 
                  onChange={(e) => onSelectAll(e.target.checked)} 
                  style={{ cursor: 'pointer' }}
                />
              </th>
              <th>{t('assets.list.table_id')}</th>
              <th>{t('assets.list.table_name')}</th>
              <th>{t('assets.list.table_type')}</th>
              <th>{t('assets.list.table_ip')}</th>
              <th>{t('assets.list.table_status')}</th>
              <th>{t('assets.list.table_desc')}</th>
              <th>{t('common.created_at', 'Ngày tạo')}</th>
              <th>{t('common.updated_at', 'Ngày cập nhật')}</th>
              <th className="actions-col">{t('assets.list.table_actions')}</th>
            </tr>
          </thead>
          <tbody>
            {devices.map((device, index) => {
              const id = device.id || device._id;
              const isSelected = selectedIds.includes(id);
              const actions = [
                { label: t('assets.list.btn_edit'), icon: Edit2, onClick: () => onEdit(device) },
                { label: t('assets.list.btn_delete'), icon: Trash2, danger: true, onClick: () => onDelete(id) }
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
                  <td><strong>{id}</strong></td>
                  <td style={{ maxWidth: '150px' }}>
                    <div className="device-name" title={device.name} style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                      <Activity size={16} className="text-primary" style={{ flexShrink: 0 }} />
                      <span className="truncate-text" style={{ flex: 1, minWidth: 0 }}>{device.name}</span>
                    </div>
                  </td>
                  <td>
                    <VStatus 
                      label={getDeviceTypeLabel(device.type) || 'N/A'}
                      style={getDeviceTypeStyle(device.type)}
                      className="badge-outline"
                    />
                  </td>
                  <td>{device.ip_address || device.ipAddress || 'N/A'}</td>

                  <td>
                    <VStatus 
                      status={device.status} 
                      label={device.status === 'active' ? t('assets.filter_status_active') : t('assets.filter_status_inactive')} 
                    />
                  </td>
                  <td className="text-muted" style={{ maxWidth: '200px' }}>
                    <div className="truncate-text" title={device.description}>{device.description || 'không có mô tả'}</div>
                  </td>
                  <td style={{ whiteSpace: 'nowrap', fontSize: '13px' }}>{formatDate(device.createdAt)}</td>
                  <td style={{ whiteSpace: 'nowrap', fontSize: '13px' }}>{formatDate(device.updatedAt)}</td>
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
        <div className="mobile-list-header" style={{ display: 'flex', alignItems: 'center' }}>
          <div className="col-checkbox" style={{ width: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <VCheckbox 
              indeterminate={selectedIds.length > 0 && selectedIds.length < devices.length}
              checked={allSelected} 
              onChange={(e) => onSelectAll(e.target.checked)} 
              style={{ cursor: 'pointer' }}
            />
          </div>
          <div className="col-id">{t('assets.list.mobile_id')}</div>
          <div className="col-title">{t('assets.list.mobile_name')}</div>
          <div className="col-action"></div>
        </div>
        
        {devices.map((device, index) => {
          const id = device.id || device._id;
          const isExpanded = expandedId === id;
          const isSelected = selectedIds.includes(id);
          const actions = [
            { label: t('assets.list.btn_edit'), icon: Edit2, onClick: () => onEdit(device) },
            { label: t('assets.list.btn_delete'), icon: Trash2, danger: true, onClick: () => onDelete(id) }
          ];

          return (
            <div className={`mobile-card ${isExpanded ? 'expanded' : ''} ${isSelected ? 'selected' : ''}`} key={id}>
              {/* Card Header (Always visible) */}
              <div className="mobile-card-header" style={{ display: 'flex', alignItems: 'center' }}>
                <div className="col-checkbox" style={{ width: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <VCheckbox 
                    checked={isSelected}
                    onChange={(e) => onSelect(id, e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                </div>
                <div className="col-id" onClick={() => toggleExpand(id)}><strong>{id.substring(0, 8)}...</strong></div>
                <div className="col-title truncate-text" onClick={() => toggleExpand(id)}>{device.name}</div>
                <div className="col-action" onClick={() => toggleExpand(id)}>
                  {isExpanded ? <ChevronUp size={20} className="expand-icon" /> : <ChevronDown size={20} className="expand-icon" />}
                </div>
              </div>
              
              {/* Card Body (Visible when expanded) */}
              {isExpanded && (
                <div className="mobile-card-body">
                  <div className="detail-row">
                    <span className="detail-label">{t('assets.form.label_type')}</span>
                    <span className="detail-value">
                      <VStatus 
                        label={getDeviceTypeLabel(device.type) || 'N/A'}
                        style={getDeviceTypeStyle(device.type)}
                        className="badge-outline"
                      />
                    </span>
                    <div className="card-action-menu">
                      <ActionMenu actions={actions} direction="down" />
                    </div>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">{t('assets.list.table_ip')}</span>
                    <span className="detail-value">{device.ip_address || device.ipAddress || 'N/A'}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">{t('assets.list.table_status')}</span>
                    <span className="detail-value">
                      <VStatus 
                        status={device.status} 
                        label={device.status === 'active' ? t('assets.filter_status_active') : t('assets.filter_status_inactive')} 
                      />
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">{t('assets.list.table_desc')}</span>
                    <span className="detail-value text-muted">{device.description || '-'}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">{t('common.created_at', 'Ngày tạo')}</span>
                    <span className="detail-value">{formatDate(device.createdAt)}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">{t('common.updated_at', 'Ngày cập nhật')}</span>
                    <span className="detail-value">{formatDate(device.updatedAt)}</span>
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

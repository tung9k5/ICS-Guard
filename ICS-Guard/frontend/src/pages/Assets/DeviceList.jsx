import React, { useState } from 'react';
import { Edit2, Trash2, Server, Activity, ChevronDown, ChevronUp } from 'lucide-react';
import ActionMenu from '@/components/ActionMenu';
import VNoData from '@/components/VNoData';
import { getDeviceTypeLabel, getDeviceTypeStyle } from '@/constants/deviceConstants';
import { useTranslation } from 'react-i18next';

const DeviceList = ({ devices, loading, onEdit, onDelete, onView }) => {
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

  return (
    <div className="device-list-container">
      {/* --- DESKTOP TABLE VIEW --- */}
      <div className="device-table-wrapper">
        <table className="device-table">
          <thead>
            <tr>
              <th>{t('assets.list.table_id')}</th>
              <th>{t('assets.list.table_name')}</th>
              <th>{t('assets.list.table_type')}</th>
              <th>{t('assets.list.table_ip')}</th>
              <th>{t('assets.list.table_mac')}</th>
              <th>{t('assets.list.table_status')}</th>
              <th>{t('assets.list.table_desc')}</th>
              <th className="actions-col">{t('assets.list.table_actions')}</th>
            </tr>
          </thead>
          <tbody>
            {devices.map((device, index) => {
              const actions = [
                { label: t('assets.list.btn_edit'), icon: Edit2, onClick: () => onEdit(device) },
                { label: t('assets.list.btn_delete'), icon: Trash2, danger: true, onClick: () => onDelete(device.id || device._id) }
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
                  <td>
                    <span className="badge badge-outline" style={getDeviceTypeStyle(device.type)}>
                      {getDeviceTypeLabel(device.type) || 'N/A'}
                    </span>
                  </td>
                  <td>{device.ip_address || device.ipAddress || 'N/A'}</td>
                  <td>{device.mac_address || device.macAddress || 'N/A'}</td>
                  <td>
                    <span 
                      className={`badge ${device.status === 'active' ? 'badge-success' : 'badge-danger'}`}
                      style={{ backgroundColor: device.status === 'active' ? '#E7FAD1' : '#FEECCA', color: device.status === 'active' ? '#1b5e20' : '#b71c1c' }}
                    >
                      {device.status === 'active' ? t('assets.filter_status_active') : t('assets.filter_status_inactive')}
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
          <div className="col-id">{t('assets.list.mobile_id')}</div>
          <div className="col-title">{t('assets.list.mobile_name')}</div>
          <div className="col-action"></div>
        </div>
        
        {devices.map((device, index) => {
          const id = device.id || device._id;
          const isExpanded = expandedId === id;
          const actions = [
            { label: t('assets.list.btn_edit'), icon: Edit2, onClick: () => onEdit(device) },
            { label: t('assets.list.btn_delete'), icon: Trash2, danger: true, onClick: () => onDelete(id) }
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
                    <span className="detail-label">{t('assets.form.label_type')}</span>
                    <span className="detail-value">
                      <span className="badge badge-outline" style={getDeviceTypeStyle(device.type)}>
                        {getDeviceTypeLabel(device.type) || 'N/A'}
                      </span>
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
                    <span className="detail-label">{t('assets.list.table_mac')}</span>
                    <span className="detail-value">{device.mac_address || device.macAddress || 'N/A'}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">{t('assets.list.table_status')}</span>
                    <span className="detail-value">
                      <span 
                        className={`badge ${device.status === 'active' ? 'badge-success' : 'badge-danger'}`}
                        style={{ backgroundColor: device.status === 'active' ? '#E7FAD1' : '#FEECCA', color: device.status === 'active' ? '#1b5e20' : '#b71c1c' }}
                      >
                        {device.status === 'active' ? t('assets.filter_status_active') : t('assets.filter_status_inactive')}
                      </span>
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">{t('assets.list.table_desc')}</span>
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

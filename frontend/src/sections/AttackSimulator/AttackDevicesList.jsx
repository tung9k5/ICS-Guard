import React, { useState } from 'react';
import { Crosshair, Monitor, Cpu, Network, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import VPagination from '@/components/VPagination';
import VNoData from '@/components/VNoData';
import VCheckbox from '@/components/VCheckbox';
import VButton from '@/components/VButton';
import ActionMenu from '@/components/ActionMenu';
import VStatus from '@/components/VStatus';
import { formatDate } from '@/utils/formatDate';

const AttackDevicesList = ({ devices, loading, page, perPage, total, onPageChange, onPerPageChange, onLaunch, selectedIds = [], onSelect, onSelectAll, onDelete }) => {
  const { t } = useTranslation();

  const [expandedId, setExpandedId] = useState(null);

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const getDeviceIcon = (type) => {
    switch (type) {
      case 'PLC': return <Cpu size={18} />;
      case 'HMI': return <Monitor size={18} />;
      case 'Switch': return <Network size={18} />;
      default: return <Monitor size={18} />;
    }
  };

  return (
    <div className="attack-devices-section">
      <div className="list-container">
        {/* --- DESKTOP TABLE VIEW --- */}
        <div className="table-wrapper">
          {loading ? (
            <div className="loading-state">{t('common.processing_data')}</div>
          ) : devices.length === 0 ? (
            <VNoData message={t('assets.list.no_data')} />
          ) : (
            <table className="v-table">
              <thead>
                <tr>
                  <th style={{ width: '40px', textAlign: 'center' }}>
                    <VCheckbox 
                      checked={devices.length > 0 && selectedIds.length === devices.length}
                      indeterminate={selectedIds.length > 0 && selectedIds.length < devices.length}
                      onChange={(e) => onSelectAll(e.target.checked)}
                      style={{ cursor: 'pointer' }}
                    />
                  </th>
                  <th>{t('attack.list.table_device')}</th>
                  <th>{t('attack.list.table_type')}</th>
                  <th style={{ whiteSpace: 'nowrap' }}>{t('attack.list.table_ip')}</th>
                  <th>{t('attack.list.table_status')}</th>
                  <th style={{ whiteSpace: 'nowrap' }}>{t('common.created_at', 'Ngày tạo')}</th>
                  <th style={{ whiteSpace: 'nowrap' }}>{t('common.updated_at', 'Ngày cập nhật')}</th>
                  <th className="actions-col">{t('attack.list.table_actions')}</th>
                </tr>
              </thead>
              <tbody>
                {devices.map((device, index) => {
                  const id = device.id || device._id;
                  const isSelected = selectedIds.includes(id);
                  return (
                  <tr key={id} className={isSelected ? 'selected-row' : ''}>
                    <td style={{ textAlign: 'center' }}>
                      <VCheckbox 
                        checked={isSelected}
                        onChange={(e) => onSelect(id, e.target.checked)}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>
                    <td style={{ maxWidth: '200px' }}>
                      <div className="device-info">
                        <div className="icon-wrapper">
                          {getDeviceIcon(device.type)}
                        </div>
                        <div className="name-details" style={{ flex: 1, minWidth: 0 }}>
                          <span className="device-name truncate-text" title={device.name}>{device.name}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="v-badge">{device.type}</span>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>{device.ipAddress || '-'}</td>
                    <td>
                      <VStatus 
                        status={device.status} 
                        label={device.status === 'active' ? t('assets.filter_status_active') : t('assets.filter_status_inactive')} 
                        showDot 
                      />
                    </td>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '13px' }}>{formatDate(device.createdAt)}</td>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '13px' }}>{formatDate(device.updatedAt)}</td>
                    <td className="actions-col">
                      <ActionMenu 
                        actions={[
                          { label: t('attack.btn_attack'), icon: Crosshair, onClick: () => onLaunch(device) },
                          { label: 'Xóa', icon: Trash2, danger: true, onClick: () => onDelete(id) }
                        ]}
                        direction={index >= devices.length - 2 && devices.length > 2 ? 'up' : 'down'}
                      />
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          )}
        </div>

        {!loading && devices.length > 0 && (
          <div className="mobile-list">
            <div className="mobile-list-header">
              <div className="col-checkbox" onClick={(e) => e.stopPropagation()}>
                <VCheckbox 
                  checked={devices.length > 0 && selectedIds.length === devices.length}
                  indeterminate={selectedIds.length > 0 && selectedIds.length < devices.length}
                  onChange={(e) => onSelectAll(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
              </div>
              <div className="col-id">{t('attack.mobile_header_device')}</div>
              <div className="col-action"></div>
            </div>
            
            {devices.map(device => {
              const id = device.id || device._id;
              const isExpanded = expandedId === id;
              const isSelected = selectedIds.includes(id);
              
              return (
                <div className={`mobile-card ${isExpanded ? 'expanded' : ''} ${isSelected ? 'selected' : ''}`} key={id}>
                  <div className="mobile-card-header" onClick={() => toggleExpand(id)}>
                    <div className="col-checkbox" style={{ width: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={(e) => e.stopPropagation()}>
                      <VCheckbox 
                        checked={isSelected}
                        onChange={(e) => onSelect(id, e.target.checked)}
                        style={{ cursor: 'pointer' }}
                      />
                    </div>
                    <div className="col-id">
                      <div className="device-info" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div className="icon-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '6px', background: 'var(--slate-100)', color: 'var(--slate-600)' }}>
                          {getDeviceIcon(device.type)}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <strong className="truncate-text" style={{ maxWidth: '150px' }}>{device.name}</strong>
                          <span style={{ fontSize: '12px', color: 'var(--slate-500)' }}>{String(id).substring(0, 8)}...</span>
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
                        <span className="detail-label">{t('attack.list.table_type')}</span>
                        <span className="detail-value">
                          <span className="v-badge">{device.type}</span>
                        </span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">{t('attack.list.table_ip')}</span>
                        <span className="detail-value">{device.ipAddress || '-'}</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">{t('attack.list.table_status')}</span>
                        <span className="detail-value">
                          <VStatus 
                            status={device.status} 
                            label={device.status === 'active' ? t('assets.filter_status_active') : t('assets.filter_status_inactive')} 
                            showDot 
                          />
                        </span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">{t('common.created_at', 'Ngày tạo')}</span>
                        <span className="detail-value">{formatDate(device.createdAt)}</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">{t('common.updated_at', 'Ngày cập nhật')}</span>
                        <span className="detail-value">{formatDate(device.updatedAt)}</span>
                      </div>
                      <div className="detail-row" style={{ borderBottom: 'none', paddingBottom: 0, paddingTop: '16px', display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        <VButton 
                          variant="danger" 
                          onClick={() => onLaunch(device)}
                          style={{ flex: 1 }}
                        >
                          <Crosshair size={16} />
                          {t('attack.btn_attack')}
                        </VButton>
                        <VButton 
                          variant="outline" 
                          onClick={() => onDelete(id)}
                          style={{ color: 'var(--red-600)', borderColor: 'var(--red-200)', background: 'var(--red-50)' }}
                        >
                          <Trash2 size={16} />
                        </VButton>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {devices && devices.length > 0 && (
        <VPagination 
          page={page}
          perPage={perPage}
          total={total}
          dataLength={devices.length}
          itemName={t('assets.item_name')}
          onPageChange={onPageChange}
          onPerPageChange={onPerPageChange}
        />
      )}
    </div>
  );
};

export default AttackDevicesList;

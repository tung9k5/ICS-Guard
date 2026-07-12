import React, { useState } from 'react';
import { Crosshair, Monitor, Cpu, Network, ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import VPagination from '@/components/VPagination';
import VNoData from '@/components/VNoData';
import VButton from '@/components/VButton';

const AttackDevicesList = ({ devices, loading, page, perPage, total, onPageChange, onPerPageChange, onLaunch }) => {
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
                  <th>{t('attack.list.table_device')}</th>
                  <th style={{ width: '90px' }}>{t('attack.list.table_type')}</th>
                  <th style={{ width: '130px', whiteSpace: 'nowrap' }}>{t('attack.list.table_ip')}</th>
                  <th style={{ width: '100px' }}>{t('attack.list.table_status')}</th>
                  <th style={{ width: '130px' }}>{t('attack.list.table_actions')}</th>
                </tr>
              </thead>
              <tbody>
                {devices.map(device => (
                  <tr key={device.id || device._id}>
                    <td>
                      <div className="device-info">
                        <div className="icon-wrapper">
                          {getDeviceIcon(device.type)}
                        </div>
                        <div className="name-details">
                          <span className="device-name truncate-text" style={{ maxWidth: '140px' }} title={device.name}>{device.name}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="v-badge">{device.type}</span>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>{device.ipAddress || '-'}</td>
                    <td>
                      <span className={`v-badge ${device.status === 'active' ? 'v-badge--success' : 'v-badge--danger'}`}>
                        {device.status === 'active' ? t('assets.filter_status_active') : t('assets.filter_status_inactive')}
                      </span>
                    </td>
                    <td>
                      <VButton 
                        variant="danger" 
                        onClick={() => onLaunch(device)}
                      >
                        <Crosshair size={16} />
                        {t('attack.btn_attack')}
                      </VButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {!loading && devices.length > 0 && (
          <div className="mobile-list">
            <div className="mobile-list-header">
              <div className="col-id">Thiết bị</div>
              <div className="col-action"></div>
            </div>
            
            {devices.map(device => {
              const id = device.id || device._id;
              const isExpanded = expandedId === id;
              
              return (
                <div className={`mobile-card ${isExpanded ? 'expanded' : ''}`} key={id}>
                  <div className="mobile-card-header" onClick={() => toggleExpand(id)}>
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
                          <span className={`v-badge ${device.status === 'active' ? 'v-badge--success' : 'v-badge--danger'}`}>
                            {device.status === 'active' ? t('assets.filter_status_active') : t('assets.filter_status_inactive')}
                          </span>
                        </span>
                      </div>
                      <div className="detail-row" style={{ borderBottom: 'none', paddingBottom: 0, paddingTop: '16px', display: 'flex', justifyContent: 'center' }}>
                        <VButton 
                          variant="danger" 
                          onClick={() => onLaunch(device)}
                          style={{ width: '100%' }}
                        >
                          <Crosshair size={16} />
                          {t('attack.btn_attack')}
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

import React from 'react';
import { Edit2, Trash2, ShieldAlert, ChevronDown, ChevronUp, Bot } from 'lucide-react';
import ActionMenu from '@/components/ActionMenu';
import VNoData from '@/components/VNoData';
import VStatus from '@/components/VStatus';
import VCheckbox from '@/components/VCheckbox';
import { useTranslation } from 'react-i18next';
import { formatDate } from '@/utils/formatDate';
import { useExpandable } from '@/hooks/useExpandable';

import { INCIDENT_STATUS, getIncidentSeverityStyle, getIncidentStatusLabel } from '@/constants/incidentConstants';


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
  const { t } = useTranslation();
  const { expandedId, toggleExpand } = useExpandable();


  if (loading) {
    return <div className="incident-loading">{t('incidents.list.loading')}</div>;
  }

  if (!incidents || incidents.length === 0) {
    return <VNoData message={t('incidents.list.no_data')} />;
  }

  const allSelected = incidents.length > 0 && selectedIds.length === incidents.length;

  return (
    <div className="incident-list-container">
      {/* --- DESKTOP TABLE VIEW --- */}
      <div className="incident-table-wrapper">
        <table className="incident-table">
          <thead>
            <tr>
              <th style={{ width: '2.8571rem', textAlign: 'center' }}>
                <VCheckbox 
                  indeterminate={selectedIds.length > 0 && selectedIds.length < incidents.length}
                  checked={allSelected}
                  onChange={(e) => onSelectAll(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
              </th>
              <th>{t('incidents.list.table_name')}</th>
              <th>{t('incidents.list.table_severity')}</th>
              <th>{t('incidents.list.table_status')}</th>
              <th>{t('incidents.list.table_desc')}</th>
              <th>{t('common.created_at', 'Ngày tạo')}</th>
              <th>{t('common.updated_at', 'Ngày cập nhật')}</th>
              <th className="actions-col">{t('incidents.list.table_actions')}</th>
            </tr>
          </thead>
          <tbody>
            {incidents.map((incident, index) => {
              const id = incident.id || incident._id;
              const isSelected = selectedIds.includes(id);
              const actions = [
                { label: t('incidents.list.btn_ai_analyze'), icon: Bot, onClick: () => onAiAnalyze(id) },
                { label: t('incidents.list.btn_edit'), icon: Edit2, onClick: () => onEdit(incident) },
                { label: t('incidents.list.btn_delete'), icon: Trash2, danger: true, onClick: () => onDelete(id) }
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
                  <td style={{ maxWidth: '12.8571rem' }}>
                    <div className="incident-title" title={incident.title}>
                      <span className="truncate-text" style={{ flex: 1, minWidth: 0 }}>{incident.title}</span>
                    </div>
                  </td>
                  <td>
                    <VStatus 
                      label={incident.severity || 'N/A'}
                      style={getIncidentSeverityStyle(incident.severity)}
                      className="badge-outline"
                    />
                  </td>
                  <td>
                    <VStatus 
                      status={incident.status === INCIDENT_STATUS.OPEN ? 'inactive' : incident.status === INCIDENT_STATUS.CLOSED ? 'active' : 'default'} 
                      label={getIncidentStatusLabel(incident.status, t)} 
                    />
                  </td>
                  <td className="text-muted" style={{ maxWidth: '14.2857rem' }}>
                    <span className="truncate-text" title={incident.description}>{incident.description || '-'}</span>
                  </td>
                  <td style={{ whiteSpace: 'nowrap', fontSize: '0.9286rem' }}>{formatDate(incident.createdAt)}</td>
                  <td style={{ whiteSpace: 'nowrap', fontSize: '0.9286rem' }}>{formatDate(incident.updatedAt)}</td>
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
          <div className="col-checkbox" style={{ width: '2.8571rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <VCheckbox 
              checked={allSelected} 
              indeterminate={selectedIds.length > 0 && selectedIds.length < incidents.length}
              onChange={(e) => onSelectAll(e.target.checked)} 
              style={{ cursor: 'pointer' }}
            />
          </div>
          <div className="col-title">{t('incidents.list.mobile_name')}</div>
          <div className="col-action"></div>
        </div>
        
        {incidents.map((incident, index) => {
          const id = incident.id || incident._id;
          const isExpanded = expandedId === id;
          const isSelected = selectedIds.includes(id);
          const actions = [
            { label: t('incidents.list.btn_ai_analyze'), icon: Bot, onClick: () => onAiAnalyze(id) },
            { label: t('incidents.list.btn_edit'), icon: Edit2, onClick: () => onEdit(incident) },
            { label: t('incidents.list.btn_delete'), icon: Trash2, danger: true, onClick: () => onDelete(id) }
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
                <div className="col-title truncate-text" onClick={() => toggleExpand(id)}><strong>{incident.title}</strong></div>
                <div className="col-action" onClick={() => toggleExpand(id)}>
                  {isExpanded ? <ChevronUp size={20} className="expand-icon" /> : <ChevronDown size={20} className="expand-icon" />}
                </div>
              </div>
              
              {/* Card Body */}
              {isExpanded && (
                <div className="mobile-card-body">
                  <div className="detail-row">
                    <span className="detail-label">{t('incidents.list.table_severity')}</span>
                    <span className="detail-value">
                      <VStatus 
                        label={incident.severity || 'N/A'}
                        style={getIncidentSeverityStyle(incident.severity)}
                        className="badge-outline"
                      />
                    </span>
                    <div className="card-action-menu">
                      <ActionMenu actions={actions} direction="down" />
                    </div>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">{t('incidents.list.table_status')}</span>
                    <span className="detail-value">
                      <VStatus 
                        status={incident.status === INCIDENT_STATUS.OPEN ? 'inactive' : incident.status === INCIDENT_STATUS.CLOSED ? 'active' : 'default'} 
                        label={getIncidentStatusLabel(incident.status, t)} 
                      />
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">{t('incidents.list.table_desc')}</span>
                    <span className="detail-value">{incident.description || '-'}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">{t('common.created_at', 'Ngày tạo')}</span>
                    <span className="detail-value">{formatDate(incident.createdAt)}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">{t('common.updated_at', 'Ngày cập nhật')}</span>
                    <span className="detail-value">{formatDate(incident.updatedAt)}</span>
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

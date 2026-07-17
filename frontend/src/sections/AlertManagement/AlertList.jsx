import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle, XCircle, Trash2, ShieldAlert, ChevronDown, ChevronUp } from 'lucide-react';
import ActionMenu from '@/components/ActionMenu';
import VCheckbox from '@/components/VCheckbox';
import VNoData from '@/components/VNoData';
import { ALERT_SEVERITIES, ALERT_STATUSES } from '@/constants/alertConstants';

const AlertList = ({ alerts, onUpdateStatus, onDelete, selectedIds, onSelect, onSelectAll }) => {
  const { t } = useTranslation();
  const [expandedId, setExpandedId] = useState(null);

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  if (!alerts || alerts.length === 0) {
    return <VNoData message={t('alerts.no_data', 'Không có cảnh báo nào')} />;
  }

  const getSeverityLabel = (val) => {
    const sev = ALERT_SEVERITIES.find(s => s.value === val);
    return sev ? sev.label : val;
  };

  const getStatusLabel = (val) => {
    const stat = ALERT_STATUSES.find(s => s.value === val);
    return stat ? stat.label : val;
  };

  const getSeverityClass = (severity) => {
    switch (severity) {
      case 'CRITICAL': return 'badge-danger';
      case 'HIGH': return 'badge-warning';
      case 'MEDIUM': return 'badge-info';
      default: return 'badge-success';
    }
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'resolved': return 'badge-success';
      case 'false_positive': return 'badge-secondary';
      default: return 'badge-danger';
    }
  };

  const allSelected = alerts.length > 0 && selectedIds.length === alerts.length;

  const getActions = (alert) => [
    ...(alert.status !== 'resolved' && alert.status !== 'false_positive' ? [
      { icon: CheckCircle, label: t('alerts.mark_resolved'), onClick: () => onUpdateStatus(alert, 'resolved') },
      { icon: XCircle, label: t('alerts.mark_fp'), onClick: () => onUpdateStatus(alert, 'false_positive') }
    ] : []),
    { icon: Trash2, label: t('common.delete'), onClick: () => onDelete(alert), danger: true }
  ];

  return (
    <div className="alert-list-container">
      {/* --- DESKTOP TABLE VIEW --- */}
      <div className="alert-table-wrapper">
        <table className="alert-table">
          <thead>
            <tr>
              <th style={{ width: '40px', textAlign: 'center' }}>
                <VCheckbox 
                  checked={allSelected} 
                  indeterminate={selectedIds.length > 0 && selectedIds.length < alerts.length}
                  onChange={(e) => onSelectAll(e.target.checked)} 
                  style={{ cursor: 'pointer' }}
                />
              </th>
              <th>{t('alerts.list_table.table_title', 'Tiêu đề')}</th>
              <th>{t('alerts.list_table.table_rule', 'Từ quy tắc')}</th>
              <th>{t('alerts.list_table.table_severity', 'Mức độ')}</th>
              <th>{t('alerts.list_table.table_status', 'Trạng thái')}</th>
              <th>{t('alerts.list_table.table_detected_at', 'Thời gian')}</th>
              <th className="actions-col">{t('alerts.list_table.table_actions', 'Thao tác')}</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((alert, index) => {
              const isSelected = selectedIds.includes(alert._id);
              return (
                <tr key={alert._id} className={isSelected ? 'selected-row' : ''}>
                  <td style={{ textAlign: 'center' }}>
                    <VCheckbox 
                      checked={isSelected}
                      onChange={(e) => onSelect(alert._id, e.target.checked)}
                      style={{ cursor: 'pointer' }}
                    />
                  </td>
                  <td>
                    <div className="alert-name" title={alert.title}>
                      <ShieldAlert size={16} className="text-primary" style={{ flexShrink: 0 }} />
                      <span className="truncate-text">{alert.title}</span>
                    </div>
                    {alert.description && <div style={{ fontSize: '12px', color: 'var(--slate-500)', marginTop: '2px' }}>{alert.description}</div>}
                  </td>
                  <td>{alert.rule_name || '-'}</td>
                  <td>
                    <span className={`badge ${getSeverityClass(alert.severity)}`}>
                      {getSeverityLabel(alert.severity)}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${getStatusClass(alert.status)}`}>
                      {getStatusLabel(alert.status)}
                    </span>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>{new Date(alert.detected_at).toLocaleString()}</td>
                  <td className="actions-col">
                    <ActionMenu 
                      actions={getActions(alert)}
                      direction={index >= alerts.length - 2 && alerts.length > 2 ? 'up' : 'down'}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* --- MOBILE LIST VIEW --- */}
      <div className="mobile-alert-list">
        <div className="mobile-list-header" style={{ display: 'flex', alignItems: 'center' }}>
          <div className="col-checkbox" style={{ width: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <VCheckbox 
              checked={allSelected} 
              indeterminate={selectedIds.length > 0 && selectedIds.length < alerts.length}
              onChange={(e) => onSelectAll(e.target.checked)} 
              style={{ cursor: 'pointer' }}
            />
          </div>
          <div className="col-title">{t('alerts.list_table.mobile_title', 'Tiêu đề cảnh báo')}</div>
          <div className="col-action"></div>
        </div>

        {alerts.map((alert, index) => {
          const id = alert._id;
          const isExpanded = expandedId === id;
          const isSelected = selectedIds.includes(id);

          return (
            <div className={`mobile-card ${isExpanded ? 'expanded' : ''} ${isSelected ? 'selected' : ''}`} key={id}>
              <div className="mobile-card-header" style={{ display: 'flex', alignItems: 'center' }}>
                <div className="col-checkbox" style={{ width: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <VCheckbox 
                    checked={isSelected}
                    onChange={(e) => onSelect(id, e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                </div>
                <div className="col-title truncate-text" onClick={() => toggleExpand(id)}>
                  <strong>{alert.title}</strong>
                </div>
                <div className="col-action" onClick={() => toggleExpand(id)}>
                  {isExpanded ? <ChevronUp size={20} className="expand-icon" /> : <ChevronDown size={20} className="expand-icon" />}
                </div>
              </div>

              {isExpanded && (
                <div className="mobile-card-body">
                  <div className="detail-row">
                    <span className="detail-label">{t('alerts.list_table.table_severity', 'Mức độ')}</span>
                    <span className="detail-value">
                      <span className={`badge ${getSeverityClass(alert.severity)}`}>
                        {getSeverityLabel(alert.severity)}
                      </span>
                    </span>
                    <div className="card-action-menu">
                      <ActionMenu actions={getActions(alert)} direction="down" />
                    </div>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">{t('alerts.list_table.table_status', 'Trạng thái')}</span>
                    <span className="detail-value">
                      <span className={`badge ${getStatusClass(alert.status)}`}>
                        {getStatusLabel(alert.status)}
                      </span>
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">{t('alerts.list_table.table_rule', 'Từ quy tắc')}</span>
                    <span className="detail-value">{alert.rule_name || '-'}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">{t('alerts.list_table.table_detected_at', 'Thời gian')}</span>
                    <span className="detail-value">{new Date(alert.detected_at).toLocaleString()}</span>
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

export default AlertList;

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle, XCircle, Trash2, ShieldAlert, ChevronDown, ChevronUp } from 'lucide-react';
import ActionMenu from '@/components/ActionMenu';
import VCheckbox from '@/components/VCheckbox';
import VNoData from '@/components/VNoData';
import VStatus from '@/components/VStatus';
import { ALERT_SEVERITIES, ALERT_STATUSES } from '@/constants/alertConstants';
import { formatDate } from '@/utils/formatDate';

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

  const getSeverityVariant = (severity) => {
    switch (severity) {
      case 'CRITICAL': return 'danger';
      case 'HIGH': return 'warning';
      case 'MEDIUM': return 'neutral';
      default: return 'success';
    }
  };

  const getStatusVariant = (status) => {
    switch (status) {
      case 'resolved': return 'success';
      case 'false_positive': return 'neutral';
      default: return 'danger';
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
              <th>{t('common.created_at', 'Ngày tạo')}</th>
              <th>{t('common.updated_at', 'Ngày cập nhật')}</th>
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
                  <td style={{ maxWidth: '180px' }}>
                    <div className="alert-title" title={alert.title}>
                      <span className="truncate-text" style={{ flex: 1, minWidth: 0 }}>{alert.title}</span>
                    </div>
                  </td>
                  <td>{alert.rule_name || '-'}</td>
                  <td>
                    <VStatus status={getSeverityVariant(alert.severity)} label={getSeverityLabel(alert.severity)} showDot />
                  </td>
                  <td>
                    <VStatus status={getStatusVariant(alert.status)} label={getStatusLabel(alert.status)} showDot />
                  </td>
                  <td style={{ whiteSpace: 'nowrap', fontSize: '13px' }}>{formatDate(alert.createdAt)}</td>
                  <td style={{ whiteSpace: 'nowrap', fontSize: '13px' }}>{formatDate(alert.updatedAt)}</td>
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
                      <VStatus status={getSeverityVariant(alert.severity)} label={getSeverityLabel(alert.severity)} showDot />
                    </span>
                    <div className="card-action-menu">
                      <ActionMenu actions={getActions(alert)} direction="down" />
                    </div>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">{t('alerts.list_table.table_status', 'Trạng thái')}</span>
                    <span className="detail-value">
                      <VStatus status={getStatusVariant(alert.status)} label={getStatusLabel(alert.status)} showDot />
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">{t('alerts.list_table.table_rule', 'Từ quy tắc')}</span>
                    <span className="detail-value">{alert.rule_name || '-'}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">{t('common.created_at', 'Ngày tạo')}</span>
                    <span className="detail-value">{formatDate(alert.createdAt)}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">{t('common.updated_at', 'Ngày cập nhật')}</span>
                    <span className="detail-value">{formatDate(alert.updatedAt)}</span>
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

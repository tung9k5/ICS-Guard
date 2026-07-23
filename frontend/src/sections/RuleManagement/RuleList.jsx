import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Edit2, Trash2, ShieldAlert, ChevronDown, ChevronUp } from 'lucide-react';
import ActionMenu from '@/components/ActionMenu';
import VCheckbox from '@/components/VCheckbox';
import VNoData from '@/components/VNoData';
import VStatus from '@/components/VStatus';
import { RULE_SEVERITIES, RULE_STATUSES } from '@/constants/ruleConstants';
import { formatDate } from '@/utils/formatDate';

const RuleList = ({ rules, onEdit, onDelete, selectedIds = [], onSelect, onSelectAll }) => {
  const { t } = useTranslation();
  const [expandedId, setExpandedId] = useState(null);

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  if (!rules || rules.length === 0) {
    return <VNoData message={t('rules.no_data', 'Không có quy tắc nào')} />;
  }

  const getSeverityLabel = (val) => {
    const sev = RULE_SEVERITIES.find(s => s.value === val);
    return sev ? sev.label : val;
  };

  const getSeverityVariant = (severity) => {
    switch (severity) {
      case 'CRITICAL': return 'danger';
      case 'HIGH': return 'warning';
      case 'MEDIUM': return 'neutral';
      default: return 'success';
    }
  };

  const allSelected = rules.length > 0 && rules.every(r => selectedIds.includes(r._id));
  const someSelected = rules.length > 0 && rules.some(r => selectedIds.includes(r._id)) && !allSelected;

  const getActions = (rule) => [
    { icon: Edit2, label: t('rules.edit', 'Chỉnh sửa'), onClick: () => onEdit(rule) },
    { icon: Trash2, label: t('rules.delete', 'Xóa'), onClick: () => onDelete(rule), danger: true }
  ];

  return (
    <div className="rule-list-container">
      {/* --- DESKTOP TABLE VIEW --- */}
      <div className="rule-table-wrapper">
        <table className="rule-table">
          <thead>
            <tr>
              <th style={{ width: '40px', textAlign: 'center' }}>
                <VCheckbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  onChange={(e) => onSelectAll(e.target.checked)}
                />
              </th>
              <th>{t('rules.list_table.table_name', 'TÊN QUY TẮC')}</th>
              <th>{t('rules.list_table.table_severity', 'Mức độ')}</th>
              <th>{t('rules.list_table.table_status', 'Trạng thái')}</th>
              <th>{t('rules.list_table.table_time_window', 'Thời gian (s)')}</th>
              <th>{t('rules.list_table.table_trigger_count', 'Ngưỡng')}</th>
              <th>{t('common.created_at', 'Ngày tạo')}</th>
              <th>{t('common.updated_at', 'Ngày cập nhật')}</th>
              <th className="actions-col">{t('rules.list_table.table_actions', 'Thao tác')}</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule, index) => (
              <tr key={rule._id} className={selectedIds.includes(rule._id) ? 'selected-row' : ''}>
                <td style={{ textAlign: 'center' }}>
                  <VCheckbox 
                    checked={selectedIds.includes(rule._id)}
                    onChange={(e) => onSelect(rule._id, e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                </td>
                <td style={{ maxWidth: '180px' }}>
                  <div className="truncate-text font-medium text-primary" title={rule.rule_name}>{rule.rule_name}</div>
                </td>
                <td>
                  <VStatus status={getSeverityVariant(rule.severity)} label={getSeverityLabel(rule.severity)} showDot />
                </td>
                <td>
                  <VStatus status={rule.is_active ? 'active' : 'inactive'} label={rule.is_active ? t('rules.status_active', 'Đang hoạt động') : t('rules.status_inactive', 'Tạm dừng')} showDot />
                </td>
                <td>{rule.time_window_seconds}s</td>
                <td>{rule.trigger_count}</td>
                <td style={{ whiteSpace: 'nowrap', fontSize: '13px' }}>{formatDate(rule.createdAt)}</td>
                <td style={{ whiteSpace: 'nowrap', fontSize: '13px' }}>{formatDate(rule.updatedAt)}</td>
                <td className="actions-col">
                  <ActionMenu 
                    actions={getActions(rule)}
                    direction={index >= rules.length - 2 && rules.length > 2 ? 'up' : 'down'}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* --- MOBILE LIST VIEW --- */}
      <div className="mobile-rule-list">
        <div className="mobile-list-header" style={{ display: 'flex', alignItems: 'center' }}>
          <div className="col-checkbox" style={{ width: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <VCheckbox
              checked={allSelected}
              indeterminate={someSelected}
              onChange={(e) => onSelectAll(e.target.checked)}
            />
          </div>
          <div className="col-title">{t('rules.list_table.mobile_name', 'Tên quy tắc')}</div>
          <div className="col-action"></div>
        </div>

        {rules.map((rule, index) => {
          const isExpanded = expandedId === rule._id;
          const isSelected = selectedIds.includes(rule._id);

          return (
            <div className={`mobile-card ${isExpanded ? 'expanded' : ''} ${isSelected ? 'selected' : ''}`} key={rule._id}>
              <div className="mobile-card-header" style={{ display: 'flex', alignItems: 'center' }}>
                <div className="col-checkbox" style={{ width: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  onClick={(e) => e.stopPropagation()}>
                  <VCheckbox 
                    checked={isSelected}
                    onChange={(e) => onSelect(rule._id, e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                </div>
                <div className="col-title truncate-text" onClick={() => toggleExpand(rule._id)}>
                  <strong>{rule.rule_name}</strong>
                </div>
                <div className="col-action" onClick={() => toggleExpand(rule._id)}>
                  {isExpanded ? <ChevronUp size={20} className="expand-icon" /> : <ChevronDown size={20} className="expand-icon" />}
                </div>
              </div>

              {isExpanded && (
                <div className="mobile-card-body">
                  <div className="detail-row">
                    <span className="detail-label">{t('rules.list_table.table_severity', 'Mức độ')}</span>
                    <span className="detail-value">
                      <VStatus status={getSeverityVariant(rule.severity)} label={getSeverityLabel(rule.severity)} showDot />
                    </span>
                    <div className="card-action-menu">
                      <ActionMenu actions={getActions(rule)} direction="down" />
                    </div>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">{t('rules.list_table.table_status', 'Trạng thái')}</span>
                    <span className="detail-value">
                      <VStatus status={rule.is_active ? 'active' : 'inactive'} label={rule.is_active ? t('rules.status_active') : t('rules.status_inactive')} showDot />
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">{t('rules.list_table.table_time_window', 'Thời gian')}</span>
                    <span className="detail-value">{rule.time_window_seconds}s</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">{t('rules.list_table.table_trigger_count', 'Ngưỡng')}</span>
                    <span className="detail-value">{rule.trigger_count}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">{t('common.created_at', 'Ngày tạo')}</span>
                    <span className="detail-value">{formatDate(rule.createdAt)}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">{t('common.updated_at', 'Ngày cập nhật')}</span>
                    <span className="detail-value">{formatDate(rule.updatedAt)}</span>
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

export default RuleList;

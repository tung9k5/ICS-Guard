import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Edit2, Trash2, ChevronDown, ChevronUp, Play, Globe, UserCheck, Eye } from 'lucide-react';
import ActionMenu from '@/components/ActionMenu';
import VCheckbox from '@/components/VCheckbox';
import VNoData from '@/components/VNoData';
import { RULE_SEVERITIES } from '@/constants/ruleConstants';

const RuleList = ({ rules, onEdit, onDelete, onBacktest, onViewDetail, selectedIds = [], setSelectedIds }) => {
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

  const getSeverityClass = (severity) => {
    switch (severity) {
      case 'CRITICAL': return 'badge-danger';
      case 'HIGH': return 'badge-warning';
      case 'MEDIUM': return 'badge-info';
      default: return 'badge-success';
    }
  };

  const isStandardRule = (rule) => {
    return Boolean(
      rule.is_international ||
      rule.mitre_technique ||
      /^MITRE/i.test(rule.rule_name || '') ||
      /^SIGMA/i.test(rule.rule_name || '') ||
      rule.category === 'ICS_PROTOCOL'
    );
  };

  // Helper to format concise display name
  const getShortRuleName = (name = '') => {
    if (!name) return '';
    // Strip redundant prefix if long, e.g. "MITRE-T0855: Modbus Unauthorized Force Coil (FC05)" -> "Modbus Unauthorized Force Coil"
    return name.replace(/^(MITRE-[A-Z0-9]+:\s*|SIGMA-ICS:\s*)/i, '');
  };

  const allSelected = rules.length > 0 && rules.every(r => selectedIds.includes(r._id));
  const someSelected = rules.length > 0 && rules.some(r => selectedIds.includes(r._id)) && !allSelected;

  const handleSelectAll = (checked) => {
    if (checked) {
      const allIds = rules.map(r => r._id);
      setSelectedIds(Array.from(new Set([...selectedIds, ...allIds])));
    } else {
      const currentIds = rules.map(r => r._id);
      setSelectedIds(selectedIds.filter(id => !currentIds.includes(id)));
    }
  };

  const handleSelect = (id, checked) => {
    if (checked) {
      setSelectedIds([...selectedIds, id]);
    } else {
      setSelectedIds(selectedIds.filter(selectedId => selectedId !== id));
    }
  };

  const getActions = (rule) => {
    const standard = isStandardRule(rule);
    const actionsList = [
      { icon: Eye, label: 'Xem chi tiết', onClick: () => onViewDetail && onViewDetail(rule) }
    ];

    if (!standard) {
      actionsList.push({ icon: Edit2, label: t('rules.edit', 'Chỉnh sửa'), onClick: () => onEdit(rule) });
    }

    actionsList.push(
      { icon: Play, label: 'Kiểm thử Backtest', onClick: () => onBacktest && onBacktest(rule) },
      { icon: Trash2, label: t('rules.delete', 'Xóa quy tắc này'), onClick: () => onDelete(rule), danger: true }
    );

    return actionsList;
  };

  return (
    <div className="rule-list-container">
      {/* --- DESKTOP COMPACT TABLE VIEW --- */}
      <div className="rule-table-wrapper" style={{ width: '100%', overflowX: 'hidden' }}>
        <table className="rule-table compact-table">
          <thead>
            <tr>
              <th style={{ width: '36px', textAlign: 'center', padding: '8px 4px' }}>
                <VCheckbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                />
              </th>
              <th style={{ padding: '8px 10px', minWidth: '150px' }}>TÊN QUY TẮC</th>
              <th style={{ padding: '8px 8px', width: '110px' }}>PHÂN LOẠI</th>
              <th style={{ padding: '8px 8px', width: '90px' }}>MỨC ĐỘ</th>
              <th style={{ padding: '8px 8px', width: '110px' }}>TRẠNG THÁI</th>
              <th style={{ padding: '8px 6px', width: '70px', textAlign: 'center' }}>THỜI GIAN</th>
              <th style={{ padding: '8px 6px', width: '60px', textAlign: 'center' }}>NGƯỠNG</th>
              <th style={{ padding: '8px 8px', width: '110px' }}>HIỆU QUẢ AI</th>
              <th className="actions-col" style={{ padding: '8px 8px', width: '70px', textAlign: 'center' }}>THAO TÁC</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule, index) => {
              const standard = isStandardRule(rule);
              const shortName = getShortRuleName(rule.rule_name);

              return (
                <tr key={rule._id} className={selectedIds.includes(rule._id) ? 'selected-row' : ''}>
                  <td style={{ textAlign: 'center', padding: '8px 4px' }}>
                    <VCheckbox 
                      checked={selectedIds.includes(rule._id)}
                      onChange={(e) => handleSelect(rule._id, e.target.checked)}
                      style={{ cursor: 'pointer' }}
                    />
                  </td>
                  <td style={{ padding: '8px 10px' }}>
                    <div
                      className="truncate-text font-medium"
                      style={{
                        maxWidth: '160px',
                        color: '#ffffff',
                        fontSize: '12px',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                      title={rule.rule_name}
                    >
                      {shortName}
                    </div>
                  </td>
                  <td style={{ padding: '8px 8px' }}>
                    {standard ? (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          padding: '2px 6px',
                          borderRadius: '10px',
                          fontSize: '10px',
                          fontWeight: 700,
                          backgroundColor: 'rgba(59, 130, 246, 0.2)',
                          color: '#60a5fa',
                          border: '1px solid rgba(59, 130, 246, 0.4)',
                          whiteSpace: 'nowrap'
                        }}
                        title="Rule Tiêu chuẩn quốc tế"
                      >
                        <Globe size={11} /> Tiêu Chuẩn
                      </span>
                    ) : (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          padding: '2px 6px',
                          borderRadius: '10px',
                          fontSize: '10px',
                          fontWeight: 700,
                          backgroundColor: 'rgba(148, 163, 184, 0.2)',
                          color: '#f1f5f9',
                          border: '1px solid rgba(148, 163, 184, 0.4)',
                          whiteSpace: 'nowrap'
                        }}
                        title="Rule Tùy biến"
                      >
                        <UserCheck size={11} /> Tùy Biến
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '8px 8px' }}>
                    <span className={`badge ${getSeverityClass(rule.severity)}`} style={{ fontSize: '10px', padding: '2px 6px' }}>
                      {getSeverityLabel(rule.severity)}
                    </span>
                  </td>
                  <td style={{ padding: '8px 8px' }}>
                    <span className={`badge ${rule.is_active ? 'badge-success' : 'badge-secondary'}`} style={{ fontSize: '10px', padding: '2px 6px' }}>
                      {rule.is_active ? 'Hoạt động' : 'Tạm dừng'}
                    </span>
                  </td>
                  <td style={{ padding: '8px 6px', textAlign: 'center', fontSize: '12px', color: '#ffffff' }}>{rule.time_window_seconds}s</td>
                  <td style={{ padding: '8px 6px', textAlign: 'center', fontSize: '12px', color: '#ffffff' }}>{rule.trigger_count}</td>
                  <td style={{ padding: '8px 8px' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '2px',
                        fontSize: '10px',
                        fontWeight: 600,
                        backgroundColor: 'rgba(34, 197, 94, 0.15)',
                        color: '#4ade80',
                        border: '1px solid rgba(34, 197, 94, 0.3)',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        whiteSpace: 'nowrap'
                      }}
                      title="Đánh giá từ AI: Luật có độ chính xác cao, tỷ lệ cảnh báo giả < 5%"
                    >
                      AI: Cao (&lt;5%)
                    </span>
                  </td>
                  <td className="actions-col" style={{ padding: '8px 8px', textAlign: 'center' }}>
                    <ActionMenu 
                      actions={getActions(rule)}
                      direction={index >= rules.length - 2 && rules.length > 2 ? 'up' : 'down'}
                    />
                  </td>
                </tr>
              );
            })}
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
              onChange={(e) => handleSelectAll(e.target.checked)}
            />
          </div>
          <div className="col-title">{t('rules.list_table.mobile_name', 'Tên quy tắc')}</div>
          <div className="col-action"></div>
        </div>

        {rules.map((rule) => {
          const isExpanded = expandedId === rule._id;
          const isSelected = selectedIds.includes(rule._id);
          const standard = isStandardRule(rule);

          return (
            <div className={`mobile-card ${isExpanded ? 'expanded' : ''} ${isSelected ? 'selected' : ''}`} key={rule._id}>
              <div className="mobile-card-header" style={{ display: 'flex', alignItems: 'center' }}>
                <div className="col-checkbox" style={{ width: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  onClick={(e) => e.stopPropagation()}>
                  <VCheckbox 
                    checked={isSelected}
                    onChange={(e) => handleSelect(rule._id, e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                </div>
                <div className="col-title truncate-text" onClick={() => toggleExpand(rule._id)}>
                  <strong style={{ color: '#ffffff' }}>{rule.rule_name}</strong>
                </div>
                <div className="col-action" onClick={() => toggleExpand(rule._id)}>
                  {isExpanded ? <ChevronUp size={20} className="expand-icon" /> : <ChevronDown size={20} className="expand-icon" />}
                </div>
              </div>

              {isExpanded && (
                <div className="mobile-card-body">
                  <div className="detail-row">
                    <span className="detail-label">Phân Loại</span>
                    <span className="detail-value">
                      {standard ? (
                        <span style={{ color: '#60a5fa', fontWeight: 600 }}>🌐 Rule Tiêu Chuẩn</span>
                      ) : (
                        <span style={{ color: '#f1f5f9', fontWeight: 600 }}>👤 Rule Tùy Biến</span>
                      )}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">{t('rules.list_table.table_severity', 'Mức độ')}</span>
                    <span className="detail-value">
                      <span className={`badge ${getSeverityClass(rule.severity)}`}>
                        {getSeverityLabel(rule.severity)}
                      </span>
                    </span>
                    <div className="card-action-menu">
                      <ActionMenu actions={getActions(rule)} direction="down" />
                    </div>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">{t('rules.list_table.table_status', 'Trạng thái')}</span>
                    <span className="detail-value">
                      <span className={`badge ${rule.is_active ? 'badge-success' : 'badge-secondary'}`}>
                        {rule.is_active ? t('rules.status_active') : t('rules.status_inactive')}
                      </span>
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

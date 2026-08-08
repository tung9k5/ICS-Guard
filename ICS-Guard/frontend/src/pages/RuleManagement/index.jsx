import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, X, Trash2, Play, Layers, Sparkles, Eye, Globe, Search, Filter, ShieldAlert, RefreshCw, Radio, Wifi } from 'lucide-react';
import VButton from '@/components/VButton';
import rulesApi from '@/api/rules';
import RuleList from '@/sections/RuleManagement/RuleList';
import RuleForm from '@/sections/RuleManagement/RuleForm';
import DeleteConfirmModal from '@/components/dialogs/DeleteConfirmModal';
import VPagination from '@/components/VPagination';
import VHeaderPage from '@/components/VHeaderPage';
import VFilterPage from '@/components/VFilterPage';
import VDialog from '@/components/VDialog';
import { toast } from '@/utils/toast';
import { useTranslation } from 'react-i18next';
import { SEARCH_DEBOUNCE_MS, DEFAULT_PAGE_SIZE } from '@/constants/uiConstants';
import { RULE_SEVERITIES, RULE_STATUSES } from '@/constants/ruleConstants';
import './RuleManagement.scss';

const RuleManagement = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'templates'
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [severity, setSeverity] = useState('');
  const [status, setStatus] = useState('');
  const [order, setOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(DEFAULT_PAGE_SIZE);
  const [total, setTotal] = useState(0);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedRule, setSelectedRule] = useState(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [ruleToDelete, setRuleToDelete] = useState(null);

  const [selectedRuleIds, setSelectedRuleIds] = useState([]);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);

  // Backtest Sandbox Modal State
  const [isBacktestModalOpen, setIsBacktestModalOpen] = useState(false);
  const [backtestRuleData, setBacktestRuleData] = useState(null);
  const [backtestLoading, setBacktestLoading] = useState(false);
  const [backtestResults, setBacktestResults] = useState(null);

  // View Rule Detail Modal State
  const [selectedRuleDetail, setSelectedRuleDetail] = useState(null);

  // Rule Templates Online Sync State
  const [templates, setTemplates] = useState([]);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [isSyncingTemplates, setIsSyncingTemplates] = useState(false);
  const [templateSearch, setTemplateSearch] = useState('');
  const [templateProtocolFilter, setTemplateProtocolFilter] = useState('ALL');
  const [templateSeverityFilter, setTemplateSeverityFilter] = useState('ALL');
  const [selectedTemplateDetail, setSelectedTemplateDetail] = useState(null);
  const [togglingTemplateName, setTogglingTemplateName] = useState(null);

  const fetchRules = useCallback(async () => {
    try {
      setLoading(true);
      const res = await rulesApi.getAllRules({
        page,
        per_page: perPage,
        search,
        severity,
        is_active: status,
        order
      });
      if (res && (res.status === 'success' || Array.isArray(res.data))) {
        setRules(res.data || []);
        setTotal(res.pagination?.total || (res.data?.length || 0));
      }
    } catch (error) {
      console.error('fetchRules error:', error);
      if (error?.response && error.response.status >= 500) {
        toast.error(t('error_general', 'Có lỗi xảy ra khi tải danh sách quy tắc'));
      }
    } finally {
      setLoading(false);
    }
  }, [page, perPage, search, severity, status, order, t]);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await rulesApi.getRuleTemplates();
      if (res.status === 'success') {
        const rawTemplates = Array.isArray(res.data) ? res.data : (res.data?.templates || []);
        setTemplates(rawTemplates);
        setLastSyncedAt(res.data?.last_synced_at || new Date().toISOString());
      }
    } catch (e) {
      console.error('Fetch templates error:', e);
    }
  }, []);

  const handleSyncTemplates = async () => {
    try {
      setIsSyncingTemplates(true);
      const res = await rulesApi.syncRuleTemplates();
      if (res.status === 'success') {
        const updatedList = res.data?.templates || [];
        setTemplates(updatedList);
        setLastSyncedAt(res.data?.last_synced_at || new Date().toISOString());
        toast.success(res.data?.message || 'Đã đồng bộ quy tắc mới từ Thư viện Quốc tế thành công!');
      }
    } catch (error) {
      toast.error('Lỗi khi đồng bộ quy tắc từ server!');
    } finally {
      setIsSyncingTemplates(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchRules();
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [fetchRules]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleSearchChange = (e) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const handleCreate = () => {
    setSelectedRule(null);
    setIsFormOpen(true);
  };

  const handleEdit = (rule) => {
    setSelectedRule(rule);
    setIsFormOpen(true);
  };

  const handleSubmit = async (data) => {
    try {
      if (selectedRule) {
        await rulesApi.updateRule(selectedRule._id, data);
        toast.success(t('rules.update_success', 'Cập nhật thành công'));
      } else {
        await rulesApi.createRule(data);
        toast.success(t('rules.create_success', 'Tạo mới thành công'));
      }
      setIsFormOpen(false);
      fetchRules();
    } catch (error) {
      toast.error(error.response?.data?.message || t('error_general', 'Có lỗi xảy ra'));
    }
  };

  const confirmDelete = (rule) => {
    setRuleToDelete(rule);
    setIsDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!ruleToDelete) return;
    try {
      await rulesApi.deleteRule(ruleToDelete._id);
      toast.success(t('rules.delete_success', 'Xóa thành công'));
      setIsDeleteModalOpen(false);
      setSelectedRuleIds(selectedRuleIds.filter(id => id !== ruleToDelete._id));
      fetchRules();
    } catch (error) {
      toast.error(t('error_general', 'Có lỗi xảy ra'));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedRuleIds.length === 0) return;
    try {
      await rulesApi.bulkDeleteRules({ ids: selectedRuleIds });
      toast.success(t('rules.delete_success', 'Xóa thành công'));
      setSelectedRuleIds([]);
      setIsBulkDeleteModalOpen(false);
      fetchRules();
    } catch (error) {
      toast.error(t('error_general', 'Có lỗi xảy ra'));
    }
  };

  const handleRunBacktest = async (rule) => {
    setBacktestRuleData(rule);
    setIsBacktestModalOpen(true);
    setBacktestLoading(true);
    setBacktestResults(null);
    try {
      const res = await rulesApi.backtestRule({
        conditions: rule.conditions,
        time_window_seconds: rule.time_window_seconds || 60
      });
      if (res.status === 'success') {
        setBacktestResults(res.data);
      }
    } catch (e) {
      toast.error('Lỗi khi thực thi Backtest');
    } finally {
      setBacktestLoading(false);
    }
  };

  // Helper to check if a template rule is installed in rules list
  const getInstalledRuleForTemplate = (tpl) => {
    return rules.find(r => r.rule_name === tpl.rule_name || (r.mitre_technique && r.mitre_technique === tpl.mitre_technique));
  };

  // Toggle button handler: Install or Remove template rule directly in Tab 2 without tab switching
  const handleToggleTemplate = async (tpl) => {
    const installed = getInstalledRuleForTemplate(tpl);
    setTogglingTemplateName(tpl.rule_name);

    try {
      if (installed) {
        // Delete the rule
        await rulesApi.deleteRule(installed._id);
        toast.success(`Đã xóa quy tắc tiêu chuẩn "${tpl.rule_name}" khỏi bộ tác chiến!`);
      } else {
        // Create the rule as a standard rule
        const newRuleData = {
          rule_name: tpl.rule_name,
          description: tpl.description,
          severity: tpl.severity || 'HIGH',
          category: tpl.category || 'ICS_PROTOCOL',
          mitre_technique: tpl.mitre_technique || '',
          time_window_seconds: tpl.time_window_seconds || 30,
          trigger_count: tpl.trigger_count || 1,
          conditions: tpl.conditions || [],
          is_active: true,
          is_international: true
        };
        await rulesApi.createRule(newRuleData);
        toast.success(`Đã áp dụng quy tắc tiêu chuẩn "${tpl.rule_name}" vào bộ tác chiến!`);
      }
      await fetchRules();
    } catch (error) {
      console.error('Toggle template error:', error);
      toast.error(error.response?.data?.message || 'Có lỗi xảy ra khi cập nhật quy tắc');
    } finally {
      setTogglingTemplateName(null);
    }
  };

  // Filter templates list
  const filteredTemplates = useMemo(() => {
    const query = templateSearch.trim().toLowerCase();
    return templates.filter(tpl => {
      const nameMatches = !query || (tpl.rule_name || '').toLowerCase().includes(query) || (tpl.mitre_technique || '').toLowerCase().includes(query) || (tpl.description || '').toLowerCase().includes(query);
      const sevMatches = templateSeverityFilter === 'ALL' || String(tpl.severity || '').toUpperCase() === templateSeverityFilter;
      const protoMatches = templateProtocolFilter === 'ALL' || (tpl.category || '').toLowerCase().includes(templateProtocolFilter.toLowerCase()) || (tpl.rule_name || '').toLowerCase().includes(templateProtocolFilter.toLowerCase());
      return nameMatches && sevMatches && protoMatches;
    });
  }, [templates, templateSearch, templateSeverityFilter, templateProtocolFilter]);

  return (
    <div className="rules-page">
      <VHeaderPage
        title="Phòng Thí Nghiệm Quy Tắc Phát Hiện (Detection Engineering Lab)"
        action={
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {selectedRuleIds.length > 0 && (
              <VButton variant="danger" onClick={() => setIsBulkDeleteModalOpen(true)}>
                <Trash2 size={18} />
                {t('rules.delete_selected', { count: selectedRuleIds.length, defaultValue: `Xóa đã chọn (${selectedRuleIds.length})` })}
              </VButton>
            )}
          </div>
        }
      />

      {/* Mode Navigation Tabs - Placed directly above content with white bottom line */}
      <div className="rules-tab-nav" style={{ borderBottom: '1px solid #ffffff', marginBottom: '20px', paddingBottom: '0' }}>
        <button
          className={`rules-tab-btn ${activeTab === 'list' ? 'active' : ''}`}
          onClick={() => setActiveTab('list')}
        >
          <Layers size={18} /> Danh Sách Quy Tắc ({total})
        </button>

        <button
          className={`rules-tab-btn ${activeTab === 'templates' ? 'active' : ''}`}
          onClick={() => setActiveTab('templates')}
        >
          <Sparkles size={18} /> Thư Viện MITRE ATT&CK for ICS ({templates.length})
        </button>
      </div>

      {/* TAB 1: LIST VIEW */}
      {activeTab === 'list' && (
        <div className="rules-content">
          {isFormOpen && (
            <RuleForm
              initialData={selectedRule}
              onSubmit={handleSubmit}
              onCancel={() => setIsFormOpen(false)}
            />
          )}

          {/* Filter Bar with [+ Thêm quy tắc] button placed inside same row */}
          <VFilterPage
            searchPlaceholder={t('rules.search_placeholder', 'Tìm tên quy tắc...')}
            searchValue={search}
            onSearchChange={handleSearchChange}
          >
            <div className="filter-select-wrapper">
              <select 
                className="v-filter-select" 
                value={severity} 
                onChange={(e) => {
                  setSeverity(e.target.value);
                  setPage(1);
                }}
                style={{ paddingRight: severity ? '28px' : undefined }}
              >
                <option value="">{t('rules.filter_severity', 'Tất cả mức độ')}</option>
                {RULE_SEVERITIES.map(sev => (
                  <option key={sev.value} value={sev.value}>{sev.label}</option>
                ))}
              </select>
              {severity && (
                <X 
                  size={14} 
                  className="clear-icon"
                  onClick={() => { setSeverity(''); setPage(1); }}
                />
              )}
            </div>

            <div className="filter-select-wrapper">
              <select 
                className="v-filter-select" 
                value={status} 
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
                style={{ paddingRight: status ? '28px' : undefined }}
              >
                <option value="">{t('rules.filter_status', 'Tất cả trạng thái')}</option>
                {RULE_STATUSES.map(stat => (
                  <option key={stat.value} value={stat.value}>{stat.label}</option>
                ))}
              </select>
              {status && (
                <X 
                  size={14} 
                  className="clear-icon"
                  onClick={() => { setStatus(''); setPage(1); }}
                />
              )}
            </div>

            <select 
              className="v-filter-select" 
              value={order} 
              onChange={(e) => {
                setOrder(e.target.value);
                setPage(1);
              }}
            >
              <option value="desc">Mới nhất</option>
              <option value="asc">Cũ nhất</option>
            </select>

            {/* Nút [+ Thêm quy tắc] nằm cùng hàng với thanh tìm kiếm và bộ lọc */}
            <button
              className="btn-add-rule-black"
              onClick={handleCreate}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: 'var(--surface-secondary, #131d33)',
                color: 'var(--text-primary, #ffffff)',
                border: '1px solid var(--border-primary, #27354d)',
                padding: '8px 16px',
                borderRadius: 'var(--radius-md, 6px)',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
                marginLeft: 'auto'
              }}
            >
              <Plus size={16} />
              {t('rules.add', 'Thêm Quy tắc')}
            </button>
          </VFilterPage>

          {loading ? (
            <div className="user-loading">{t('common.loading', 'Đang tải danh sách quy tắc…')}</div>
          ) : (
            <>
              <RuleList
                rules={rules}
                onEdit={handleEdit}
                onDelete={confirmDelete}
                onBacktest={handleRunBacktest}
                onViewDetail={(rule) => setSelectedRuleDetail(rule)}
                selectedIds={selectedRuleIds}
                setSelectedIds={setSelectedRuleIds}
              />

              {rules && rules.length > 0 && (
                <VPagination
                  page={page}
                  perPage={perPage}
                  total={total}
                  dataLength={rules.length}
                  itemName="quy tắc"
                  onPageChange={(newPage) => setPage(newPage)}
                  onPerPageChange={(newPerPage) => {
                    setPerPage(newPerPage);
                    setPage(1);
                  }}
                />
              )}
            </>
          )}
        </div>
      )}

      {/* TAB 2: MITRE ATT&CK TEMPLATE MARKETPLACE */}
      {activeTab === 'templates' && (
        <div style={{ padding: '4px' }}>
          {/* Section Title placed directly below tab nav */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary, #ffffff)', fontSize: '1.2rem', fontWeight: 800 }}>
              <Sparkles size={22} color="#38bdf8" /> Mẫu Quy tắc Phát hiện Chuẩn Quốc Tế (Sigma & MITRE ATT&CK for ICS)
            </h3>
          </div>

          {/* Template Search & Filter Controls - Rendered in a single inline row matching Tab 1 */}
          <VFilterPage
            searchPlaceholder="Nhập mã MITRE (vd: T0855) hoặc tên kịch bản tấn công…"
            searchValue={templateSearch}
            onSearchChange={(e) => setTemplateSearch(e.target.value)}
          >
            <div className="filter-select-wrapper">
              <select
                className="v-filter-select"
                value={templateProtocolFilter}
                onChange={(e) => setTemplateProtocolFilter(e.target.value)}
                style={{ paddingRight: templateProtocolFilter !== 'ALL' ? '28px' : undefined }}
              >
                <option value="ALL">Tất cả Giao thức</option>
                <option value="modbus">Modbus TCP</option>
                <option value="s7">Siemens S7comm</option>
                <option value="dnp3">DNP3 Substation</option>
                <option value="cip">CIP / EtherNetIP</option>
              </select>
              {templateProtocolFilter !== 'ALL' && (
                <X
                  size={14}
                  className="clear-icon"
                  onClick={() => setTemplateProtocolFilter('ALL')}
                />
              )}
            </div>

            <div className="filter-select-wrapper">
              <select
                className="v-filter-select"
                value={templateSeverityFilter}
                onChange={(e) => setTemplateSeverityFilter(e.target.value)}
                style={{ paddingRight: templateSeverityFilter !== 'ALL' ? '28px' : undefined }}
              >
                <option value="ALL">Tất cả mức độ</option>
                <option value="CRITICAL">CRITICAL - Nghiêm trọng</option>
                <option value="HIGH">HIGH - Cao</option>
              </select>
              {templateSeverityFilter !== 'ALL' && (
                <X
                  size={14}
                  className="clear-icon"
                  onClick={() => setTemplateSeverityFilter('ALL')}
                />
              )}
            </div>
          </VFilterPage>

          {/* Templates Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '16px' }}>
            {filteredTemplates.map((tpl, idx) => {
              const installedRule = getInstalledRuleForTemplate(tpl);
              const isInstalled = Boolean(installedRule);
              const isToggling = togglingTemplateName === tpl.rule_name;

              return (
                <div
                  key={idx}
                  style={{
                    background: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '12px',
                    padding: '18px',
                    display: 'flex',
                    flexDirection: 'column',
                    justify: 'space-between',
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.3)',
                    color: '#f8fafc'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <span style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Globe size={12} /> {tpl.mitre_technique || 'MITRE ICS'}
                      </span>
                      <span className={`sev-${(tpl.severity || 'HIGH').toLowerCase()}`}>
                        {tpl.severity || 'HIGH'}
                      </span>
                    </div>

                    <h4 style={{ margin: '8px 0 6px', fontSize: '15px', color: '#f8fafc', fontWeight: 600 }}>
                      {tpl.rule_name}
                    </h4>
                    <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 10px', lineHeight: 1.5 }}>
                      {tpl.description}
                    </p>

                    <div style={{ fontSize: '11px', color: '#38bdf8', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.25)', padding: '2px 8px', borderRadius: '4px', display: 'inline-block', marginBottom: '12px' }}>
                      Nguồn Live Feed: <strong>{tpl.source_feed || 'SigmaHQ & MITRE ATT&CK for ICS'}</strong>
                    </div>
                  </div>

                  {/* Actions Row */}
                  <div style={{ display: 'flex', gap: '10px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #1e293b' }}>
                    <button
                      title="Xem chi tiết thông số quy tắc mẫu"
                      onClick={() => setSelectedTemplateDetail(tpl)}
                      style={{
                        padding: '8px 12px',
                        background: '#1e293b',
                        border: '1px solid #475569',
                        color: '#cbd5e1',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justify: 'center'
                      }}
                    >
                      <Eye size={16} />
                    </button>

                    <button
                      disabled={isToggling}
                      onClick={() => handleToggleTemplate(tpl)}
                      style={{
                        flex: 1,
                        padding: '8px 14px',
                        background: isInstalled ? 'rgba(239, 68, 68, 0.15)' : '#2563eb',
                        border: isInstalled ? '1px solid #ef4444' : '1px solid #3b82f6',
                        color: isInstalled ? '#f87171' : '#ffffff',
                        borderRadius: '6px',
                        cursor: isToggling ? 'not-allowed' : 'pointer',
                        fontWeight: 600,
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justify: 'center',
                        gap: '6px',
                        transition: 'all 0.2s'
                      }}
                    >
                      {isToggling ? (
                        'Đang xử lý…'
                      ) : isInstalled ? (
                        <>
                          <Trash2 size={15} /> Xóa quy tắc này
                        </>
                      ) : (
                        <>
                          <Plus size={15} /> Sử dụng quy tắc này
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {!filteredTemplates.length && (
            <p style={{ textAlign: 'center', color: '#64748b', padding: '40px 0' }}>
              Không tìm thấy mẫu quy tắc nào phù hợp với điều kiện tìm kiếm.
            </p>
          )}
        </div>
      )}

      {/* Active Rule Detail Modal */}
      {selectedRuleDetail && (
        <VDialog
          visible={Boolean(selectedRuleDetail)}
          onHide={() => setSelectedRuleDetail(null)}
          header={`Chi Tiết Quy Tắc: ${selectedRuleDetail.rule_name}`}
        >
          <div style={{ padding: '8px 0', color: '#f8fafc' }}>
            <p style={{ color: '#94a3b8', fontSize: '13px', margin: '0 0 14px' }}>
              {selectedRuleDetail.description || 'Không có mô tả chi tiết.'}
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', background: '#0f172a', padding: '12px', borderRadius: '8px', fontSize: '12px', marginBottom: '14px', border: '1px solid #334155' }}>
              <div><span style={{ color: '#94a3b8' }}>Tên đầy đủ:</span> <strong style={{ color: '#ffffff' }}>{selectedRuleDetail.rule_name}</strong></div>
              <div><span style={{ color: '#94a3b8' }}>Mã MITRE ICS:</span> <strong style={{ color: '#38bdf8' }}>{selectedRuleDetail.mitre_technique || 'N/A'}</strong></div>
              <div><span style={{ color: '#94a3b8' }}>Mức độ nghiêm trọng:</span> <span className={`sev-${(selectedRuleDetail.severity || 'HIGH').toLowerCase()}`}>{selectedRuleDetail.severity}</span></div>
              <div><span style={{ color: '#94a3b8' }}>Trạng thái:</span> <strong style={{ color: selectedRuleDetail.is_active ? '#34d399' : '#94a3b8' }}>{selectedRuleDetail.is_active ? 'Đang hoạt động' : 'Tạm dừng'}</strong></div>
              <div><span style={{ color: '#94a3b8' }}>Cửa sổ quan sát:</span> <strong style={{ color: '#f8fafc' }}>{selectedRuleDetail.time_window_seconds}s</strong></div>
              <div><span style={{ color: '#94a3b8' }}>Ngưỡng vi phạm:</span> <strong style={{ color: '#f8fafc' }}>{selectedRuleDetail.trigger_count} lần</strong></div>
            </div>

            <h4 style={{ fontSize: '13px', color: '#cbd5e1', marginBottom: '8px' }}>Biểu thức Điều kiện Vi phạm (Conditions):</h4>
            <div style={{ background: '#0f172a', border: '1px solid #1e293b', padding: '12px', borderRadius: '6px', fontSize: '12px' }}>
              {selectedRuleDetail.conditions && selectedRuleDetail.conditions.length > 0 ? (
                selectedRuleDetail.conditions.map((cond, i) => (
                  <div key={i} style={{ display: 'flex', gap: '8px', color: '#38bdf8', fontFamily: 'monospace' }}>
                    <span>Trường: <strong>{cond.field}</strong></span>
                    <span>{cond.operator}</span>
                    <span style={{ color: '#f43f5e' }}>{String(cond.value)}</span>
                  </div>
                ))
              ) : (
                <span style={{ color: '#94a3b8' }}>Không có điều kiện trường tùy chỉnh.</span>
              )}
            </div>
          </div>
        </VDialog>
      )}

      {/* Template Detail Modal */}
      {selectedTemplateDetail && (
        <VDialog
          visible={Boolean(selectedTemplateDetail)}
          onHide={() => setSelectedTemplateDetail(null)}
          header={`Thông số Quy Tắc Mẫu: ${selectedTemplateDetail.rule_name}`}
        >
          <div style={{ padding: '8px 0', color: '#f8fafc' }}>
            <p style={{ color: '#94a3b8', fontSize: '13px', margin: '0 0 14px' }}>
              {selectedTemplateDetail.description}
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', background: '#0f172a', padding: '12px', borderRadius: '8px', fontSize: '12px', marginBottom: '14px' }}>
              <div><span style={{ color: '#94a3b8' }}>Mã MITRE ICS:</span> <strong style={{ color: '#38bdf8' }}>{selectedTemplateDetail.mitre_technique || 'N/A'}</strong></div>
              <div><span style={{ color: '#94a3b8' }}>Mức độ:</span> <span className={`sev-${(selectedTemplateDetail.severity || 'HIGH').toLowerCase()}`}>{selectedTemplateDetail.severity}</span></div>
              <div><span style={{ color: '#94a3b8' }}>Cửa sổ quan sát (Window):</span> <strong style={{ color: '#cbd5e1' }}>{selectedTemplateDetail.time_window_seconds}s</strong></div>
              <div><span style={{ color: '#94a3b8' }}>Ngưỡng kích hoạt:</span> <strong style={{ color: '#cbd5e1' }}>{selectedTemplateDetail.trigger_count} lần</strong></div>
            </div>

            <h4 style={{ fontSize: '13px', color: '#cbd5e1', marginBottom: '8px' }}>Biểu thức Điều kiện Vi phạm (Conditions):</h4>
            <div style={{ background: '#0f172a', border: '1px solid #1e293b', padding: '12px', borderRadius: '6px', fontSize: '12px' }}>
              {selectedTemplateDetail.conditions?.map((cond, i) => (
                <div key={i} style={{ display: 'flex', gap: '8px', color: '#38bdf8', fontFamily: 'monospace' }}>
                  <span>Trường: <strong>{cond.field}</strong></span>
                  <span>{cond.operator}</span>
                  <span style={{ color: '#f43f5e' }}>{String(cond.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </VDialog>
      )}

      {/* Backtesting Sandbox Modal */}
      {isBacktestModalOpen && (
        <VDialog
          visible={isBacktestModalOpen}
          onHide={() => setIsBacktestModalOpen(false)}
          header={`Kiểm thử Quy tắc (Backtest Lab): ${backtestRuleData?.rule_name || ''}`}
        >
          <div style={{ padding: '12px 0' }}>
            {backtestLoading ? (
              <div style={{ textAlign: 'center', padding: '24px', color: '#94a3b8' }}>
                Đang chạy mô phỏng Backtest trên dữ liệu nhật ký quá khứ...
              </div>
            ) : backtestResults ? (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                  <div style={{ background: '#0f172a', border: '1px solid #1e293b', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>Số lần khớp mẫu</div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: '#f8fafc' }}>{backtestResults.hitsCount}</div>
                  </div>
                  <div style={{ background: '#0f172a', border: '1px solid #1e293b', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>Tỷ lệ báo động giả</div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: '#10b981' }}>{backtestResults.falsePositiveRate}</div>
                  </div>
                  <div style={{ background: '#0f172a', border: '1px solid #1e293b', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>Đánh giá độ tin cậy</div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#38bdf8', marginTop: '4px' }}>{backtestResults.status}</div>
                  </div>
                </div>

                <h4 style={{ fontSize: '14px', marginBottom: '8px', color: '#f8fafc' }}>Mẫu sự kiện lịch sử bị phát hiện:</h4>
                <div style={{ background: '#0f172a', color: '#38bdf8', padding: '12px', borderRadius: '6px', fontFamily: 'monospace', fontSize: '12px', maxHeight: '180px', overflowY: 'auto' }}>
                  {backtestResults.samples?.map((s, idx) => (
                    <div key={idx} style={{ marginBottom: '6px', borderBottom: '1px solid #1e293b', paddingBottom: '4px' }}>
                      [{s.timestamp}] Device: {s.device} | Metric: {s.metric} = {s.value}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </VDialog>
      )}

      {/* Delete Modals */}
      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDelete}
        title={t('rules.confirm_delete', 'Xóa quy tắc')}
        message={t('rules.confirm_delete_msg', 'Bạn có chắc chắn muốn xóa quy tắc này?')}
      />

      <DeleteConfirmModal
        isOpen={isBulkDeleteModalOpen}
        onClose={() => setIsBulkDeleteModalOpen(false)}
        onConfirm={handleBulkDelete}
        title={t('rules.confirm_delete_bulk', 'Xóa nhiều quy tắc')}
        message={t('rules.confirm_delete_bulk_msg', `Bạn có chắc chắn muốn xóa ${selectedRuleIds.length} quy tắc đã chọn?`)}
      />
    </div>
  );
};

export default RuleManagement;

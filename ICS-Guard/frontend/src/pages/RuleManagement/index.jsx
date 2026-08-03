import React, { useState, useEffect, useCallback } from 'react';
import { Plus, X, Trash2, Cpu, Play, Layers, Sparkles, CheckCircle, AlertTriangle, FileCode } from 'lucide-react';
import VButton from '@/components/VButton';
import VInput from '@/components/VInput';
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
  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'composer' | 'templates'
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

  // Rule Templates
  const [templates, setTemplates] = useState([]);

  // Visual Rule Composer Canvas Nodes State
  const [nodeProtocol, setNodeProtocol] = useState('MODBUS_TCP');
  const [nodeField, setNodeField] = useState('holding_register');
  const [nodeOperator, setNodeOperator] = useState('>');
  const [nodeValue, setNodeValue] = useState(100);
  const [nodeAction, setNodeAction] = useState('CREATE_CRITICAL_ALERT');
  const [composerName, setComposerName] = useState('');
  const [composerDesc, setComposerDesc] = useState('');

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
      if (res.status === 'success') {
        setRules(res.data);
        setTotal(res.pagination?.total || 0);
      }
    } catch (error) {
      toast.error(t('error_general', 'Có lỗi xảy ra'));
    } finally {
      setLoading(false);
    }
  }, [page, perPage, search, severity, status, order, t]);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await rulesApi.getRuleTemplates();
      if (res.status === 'success') {
        setTemplates(res.data);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

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

  const handleSaveComposerRule = async () => {
    if (!composerName) {
      toast.error('Vui lòng nhập tên quy tắc');
      return;
    }
    const newRuleData = {
      rule_name: composerName,
      description: composerDesc || `Dựng từ Visual Composer (${nodeProtocol})`,
      severity: 'HIGH',
      category: 'ICS_PROTOCOL',
      time_window_seconds: 60,
      trigger_count: 1,
      conditions: [{ field: nodeField, operator: nodeOperator, value: nodeValue }],
      logic_nodes: { protocol: nodeProtocol, action: nodeAction }
    };
    try {
      await rulesApi.createRule(newRuleData);
      toast.success('Đã lưu Quy tắc thành công từ Visual Composer!');
      setActiveTab('list');
      fetchRules();
    } catch (e) {
      toast.error('Lỗi tạo quy tắc');
    }
  };

  const handleApplyTemplate = (tpl) => {
    setSelectedRule({
      rule_name: tpl.rule_name,
      description: tpl.description,
      severity: tpl.severity,
      category: tpl.category,
      time_window_seconds: tpl.time_window_seconds,
      trigger_count: tpl.trigger_count,
      conditions: tpl.conditions
    });
    setIsFormOpen(true);
  };

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
            <VButton variant="primary" onClick={handleCreate} className="d-flex align-items-center gap-2">
              <Plus size={18} />
              {t('rules.add', 'Thêm Quy tắc')}
            </VButton>
          </div>
        }
      />

      {/* Mode Navigation Tabs */}
      <div className="rules-tab-nav">
        <button
          className={`rules-tab-btn ${activeTab === 'list' ? 'active' : ''}`}
          onClick={() => setActiveTab('list')}
        >
          <Layers size={18} /> Danh sách Quy tắc ({total})
        </button>

        <button
          className={`rules-tab-btn ${activeTab === 'composer' ? 'active' : ''}`}
          onClick={() => setActiveTab('composer')}
        >
          <Cpu size={18} /> Visual Node Composer (Kéo-Thả Logic)
        </button>

        <button
          className={`rules-tab-btn ${activeTab === 'templates' ? 'active' : ''}`}
          onClick={() => setActiveTab('templates')}
        >
          <Sparkles size={18} /> Thư viện MITRE ATT&CK for ICS
        </button>
      </div>

      {activeTab === 'list' && (
        <div className="rules-content">
          {isFormOpen && (
            <RuleForm
              initialData={selectedRule}
              onSubmit={handleSubmit}
              onCancel={() => setIsFormOpen(false)}
            />
          )}
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
          </VFilterPage>

          {loading ? (
            <div className="user-loading">{t('common.loading', 'Đang tải...')}</div>
          ) : (
            <>
              <RuleList
                rules={rules}
                onEdit={handleEdit}
                onDelete={confirmDelete}
                onBacktest={handleRunBacktest}
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

      {/* Visual Rule Node Composer */}
      {activeTab === 'composer' && (
        <div style={{ background: '#0f172a', padding: '24px', borderRadius: '12px', color: '#f8fafc', border: '1px solid #334155' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#38bdf8' }}>
                <Cpu size={22} /> Visual Block-Based Rule Composer
              </h3>
              <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: '14px' }}>
                Ghép nối các khối logic giao thức OT/ICS để khởi tạo luật phát hiện bất thường mà không cần viết mã.
              </p>
            </div>
            <VButton variant="primary" onClick={handleSaveComposerRule}>
              Lưu Quy Tắc Phát Hiện
            </VButton>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: '#cbd5e1', marginBottom: '6px' }}>Tên Quy tắc:</label>
              <input
                type="text"
                placeholder="VD: Modbus FC05 Unauthorized Single Coil Force"
                value={composerName}
                onChange={(e) => setComposerName(e.target.value)}
                style={{ width: '100%', padding: '10px', background: '#1e293b', border: '1px solid #475569', borderRadius: '6px', color: '#fff' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: '#cbd5e1', marginBottom: '6px' }}>Mô tả ngắn:</label>
              <input
                type="text"
                placeholder="VD: Giám sát gói tin Modbus TCP vi phạm quy trình ghi đè thanh ghi"
                value={composerDesc}
                onChange={(e) => setComposerDesc(e.target.value)}
                style={{ width: '100%', padding: '10px', background: '#1e293b', border: '1px solid #475569', borderRadius: '6px', color: '#fff' }}
              />
            </div>
          </div>

          {/* Node Graph Canvas */}
          <div style={{ background: '#1e293b', padding: '24px', borderRadius: '10px', border: '1px dashed #475569', display: 'flex', alignItems: 'center', justifyContent: 'space-around', position: 'relative' }}>
            {/* Node 1: Protocol */}
            <div style={{ background: '#0f172a', border: '2px solid #38bdf8', padding: '16px', borderRadius: '8px', minWidth: '180px', textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: '#38bdf8', fontWeight: 600 }}>1. GIAO THỨC ICS</div>
              <select
                value={nodeProtocol}
                onChange={(e) => setNodeProtocol(e.target.value)}
                style={{ marginTop: '8px', background: '#1e293b', color: '#fff', border: '1px solid #475569', padding: '6px', borderRadius: '4px', width: '100%' }}
              >
                <option value="MODBUS_TCP">Modbus TCP (Port 502)</option>
                <option value="SIEMENS_S7">Siemens S7comm (Port 102)</option>
                <option value="DNP3">DNP3 Substation</option>
                <option value="CIP_ETHERNETIP">EtherNet/IP (CIP)</option>
              </select>
            </div>

            <div style={{ color: '#38bdf8', fontSize: '20px', fontWeight: 700 }}>➔</div>

            {/* Node 2: Condition */}
            <div style={{ background: '#0f172a', border: '2px solid #eab308', padding: '16px', borderRadius: '8px', minWidth: '220px', textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: '#eab308', fontWeight: 600 }}>2. ĐIỀU KIỆN VI PHẠM</div>
              <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                <input
                  type="text"
                  value={nodeField}
                  onChange={(e) => setNodeField(e.target.value)}
                  style={{ background: '#1e293b', color: '#fff', border: '1px solid #475569', padding: '4px', borderRadius: '4px', width: '90px', fontSize: '12px' }}
                />
                <select
                  value={nodeOperator}
                  onChange={(e) => setNodeOperator(e.target.value)}
                  style={{ background: '#1e293b', color: '#fff', border: '1px solid #475569', padding: '4px', borderRadius: '4px', fontSize: '12px' }}
                >
                  <option value=">">&gt;</option>
                  <option value="==">==</option>
                  <option value="!=">!=</option>
                  <option value="<">&lt;</option>
                </select>
                <input
                  type="number"
                  value={nodeValue}
                  onChange={(e) => setNodeValue(Number(e.target.value))}
                  style={{ background: '#1e293b', color: '#fff', border: '1px solid #475569', padding: '4px', borderRadius: '4px', width: '60px', fontSize: '12px' }}
                />
              </div>
            </div>

            <div style={{ color: '#eab308', fontSize: '20px', fontWeight: 700 }}>➔</div>

            {/* Node 3: Action */}
            <div style={{ background: '#0f172a', border: '2px solid #ef4444', padding: '16px', borderRadius: '8px', minWidth: '180px', textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: '#ef4444', fontWeight: 600 }}>3. HÀNH ĐỘNG</div>
              <select
                value={nodeAction}
                onChange={(e) => setNodeAction(e.target.value)}
                style={{ marginTop: '8px', background: '#1e293b', color: '#fff', border: '1px solid #475569', padding: '6px', borderRadius: '4px', width: '100%' }}
              >
                <option value="CREATE_CRITICAL_ALERT">Tạo Cảnh báo CRITICAL</option>
                <option value="BLOCK_IP_CONTAINMENT">Chặn IP Nguồn (Containment)</option>
                <option value="TRIGGER_SOAR_PLAYBOOK">Kích hoạt SOAR Playbook</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* MITRE ATT&CK for ICS Template Marketplace */}
      {activeTab === 'templates' && (
        <div style={{ padding: '8px' }}>
          <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={20} color="#2563eb" /> Mẫu Quy tắc Phát hiện Chuẩn Quốc Tế (Sigma & MITRE ATT&CK for ICS)
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
            {templates.map((tpl, idx) => (
              <div key={idx} style={{ background: 'var(--white)', border: '1px solid var(--slate-200)', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <span style={{ background: '#eff6ff', color: '#2563eb', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600 }}>
                      {tpl.mitre_technique || 'MITRE ICS'}
                    </span>
                    <span className={`badge badge-${tpl.severity === 'CRITICAL' ? 'danger' : 'outline'}`}>
                      {tpl.severity}
                    </span>
                  </div>
                  <h4 style={{ margin: '8px 0', fontSize: '15px', color: 'var(--slate-900)' }}>{tpl.rule_name}</h4>
                  <p style={{ fontSize: '13px', color: 'var(--slate-600)', margin: '0 0 12px', lineHeight: 1.4 }}>{tpl.description}</p>
                </div>
                <VButton variant="primary" style={{ width: '100%' }} onClick={() => handleApplyTemplate(tpl)}>
                  Sử dụng Quy tắc mẫu này
                </VButton>
              </div>
            ))}
          </div>
        </div>
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
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--slate-600)' }}>
                Đang chạy mô phỏng Backtest trên dữ liệu nhật ký quá khứ...
              </div>
            ) : backtestResults ? (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>Số lần khớp mẫu</div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>{backtestResults.hitsCount}</div>
                  </div>
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>Tỷ lệ báo động giả</div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: '#16a34a' }}>{backtestResults.falsePositiveRate}</div>
                  </div>
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>Đánh giá độ tin cậy</div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#2563eb', marginTop: '4px' }}>{backtestResults.status}</div>
                  </div>
                </div>

                <h4 style={{ fontSize: '14px', marginBottom: '8px' }}>Mẫu sự kiện lịch sử bị phát hiện:</h4>
                <div style={{ background: '#0f172a', color: '#38bdf8', padding: '12px', borderRadius: '6px', fontFamily: 'monospace', fontSize: '12px', maxHeight: '180px', overflowY: 'auto' }}>
                  {backtestResults.samples?.map((s, idx) => (
                    <div key={idx} style={{ marginBottom: '6px', borderBottom: '1px solid #1e293b', pb: '4px' }}>
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

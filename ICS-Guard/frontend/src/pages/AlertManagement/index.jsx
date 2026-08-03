import React, { useState, useEffect, useCallback } from 'react';
import { Search, ShieldAlert, Cpu, Bot, Zap, CheckCircle, AlertTriangle, Layers, Radio, Shield, Trash2, X } from 'lucide-react';
import alertsApi from '@/api/alerts';
import AlertList from '@/sections/AlertManagement/AlertList';
import DeleteConfirmModal from '@/components/dialogs/DeleteConfirmModal';
import VPagination from '@/components/VPagination';
import VHeaderPage from '@/components/VHeaderPage';
import VFilterPage from '@/components/VFilterPage';
import VDialog from '@/components/VDialog';
import VButton from '@/components/VButton';
import { toast } from '@/utils/toast';
import { useTranslation } from 'react-i18next';
import { SEARCH_DEBOUNCE_MS, DEFAULT_PAGE_SIZE } from '@/constants/uiConstants';
import { ALERT_SEVERITIES, ALERT_STATUSES } from '@/constants/alertConstants';
import './AlertManagement.scss';

const AlertManagement = () => {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'clusters'
  const [alerts, setAlerts] = useState([]);
  const [clusters, setClusters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [severity, setSeverity] = useState('');
  const [status, setStatus] = useState('');
  const [order, setOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(DEFAULT_PAGE_SIZE);
  const [total, setTotal] = useState(0);

  const [selectedIds, setSelectedIds] = useState([]);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [alertToDelete, setAlertToDelete] = useState(null);
  const [isBulkDelete, setIsBulkDelete] = useState(false);

  // AI Triage Drawer Modal State
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [selectedAlertForAi, setSelectedAlertForAi] = useState(null);
  const [aiReport, setAiReport] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Containment Execution State
  const [containmentLoading, setContainmentLoading] = useState(false);

  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await alertsApi.getAllAlerts({
        page,
        per_page: perPage,
        search,
        severity,
        status,
        order
      });
      if (res.status === 'success') {
        setAlerts(res.data);
        setTotal(res.pagination?.total || 0);
      }
    } catch (error) {
      toast.error(t('error_general', 'Có lỗi xảy ra'));
    } finally {
      setLoading(false);
    }
  }, [page, perPage, search, severity, status, order, t]);

  const fetchClusters = useCallback(async () => {
    try {
      const res = await alertsApi.getCorrelatedAlerts();
      if (res.status === 'success') {
        setClusters(res.data);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchAlerts();
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [fetchAlerts]);

  useEffect(() => {
    if (viewMode === 'clusters') {
      fetchClusters();
    }
  }, [viewMode, fetchClusters]);

  const confirmDelete = (alert) => {
    setAlertToDelete(alert);
    setIsBulkDelete(false);
    setIsDeleteModalOpen(true);
  };

  const handleBulkDeleteClick = () => {
    if (selectedIds.length === 0) return;
    setIsBulkDelete(true);
    setIsDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    try {
      if (isBulkDelete) {
        await alertsApi.deleteMultipleAlerts(selectedIds);
        toast.success(t('alerts.bulk_delete_success', `Đã xóa ${selectedIds.length} cảnh báo`));
        setSelectedIds([]);
      } else {
        if (!alertToDelete) return;
        await alertsApi.deleteAlert(alertToDelete._id);
        toast.success(t('alerts.delete_success', 'Xóa thành công'));
      }
      setIsDeleteModalOpen(false);
      fetchAlerts();
    } catch (error) {
      toast.error(t('error_general', 'Có lỗi xảy ra'));
    }
  };

  const handleSelect = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedIds(alerts.map(a => a._id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleUpdateStatus = async (alert, status) => {
    try {
      await alertsApi.updateAlertStatus(alert._id, status);
      toast.success(t('alerts.update_success', 'Cập nhật trạng thái thành công'));
      fetchAlerts();
    } catch (error) {
      toast.error(t('error_general', 'Có lỗi xảy ra'));
    }
  };

  const handleOpenAiTriage = async (alert) => {
    setSelectedAlertForAi(alert);
    setIsAiModalOpen(true);
    setAiLoading(true);
    setAiReport(null);
    try {
      const res = await alertsApi.getAlertAiTriage(alert._id);
      if (res.status === 'success') {
        setAiReport(res.data);
      }
    } catch (e) {
      toast.error('Lỗi khi sinh báo cáo AI Triage');
    } finally {
      setAiLoading(false);
    }
  };

  const handleExecuteContainment = async (actionType) => {
    if (!selectedAlertForAi) return;
    setContainmentLoading(true);
    try {
      const res = await alertsApi.containAlertAsset(selectedAlertForAi._id, { action_type: actionType });
      if (res.status === 'success') {
        toast.success(res.data.message || 'Đã kích hoạt hành động chặn thành công!');
        fetchAlerts();
      }
    } catch (e) {
      toast.error('Lỗi khi thực thi phản ứng nhanh');
    } finally {
      setContainmentLoading(false);
    }
  };

  return (
    <div className="alerts-page">
      <VHeaderPage 
        title="Trung Tâm Xử Lý & Phân Tích Cảnh Báo Thời Gian Thực (Real-time Alert Triage Center)"
        action={
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {selectedIds.length > 0 && (
              <VButton variant="danger" onClick={handleBulkDeleteClick} style={{ flex: '1 1 auto', whiteSpace: 'nowrap' }}>
                <Trash2 size={18} />
                {t('incidents.btn_delete_selected', { count: selectedIds.length })}
              </VButton>
            )}
          </div>
        }
      />

      {/* Mode Switcher */}
      <div style={{ display: 'flex', gap: '12px', padding: '0 4px', borderBottom: '1px solid var(--slate-200)' }}>
        <button
          onClick={() => setViewMode('list')}
          style={{
            padding: '10px 18px',
            border: 'none',
            background: 'none',
            borderBottom: viewMode === 'list' ? '2px solid var(--primary-color, #2563eb)' : 'none',
            color: viewMode === 'list' ? 'var(--primary-color, #2563eb)' : 'var(--slate-600)',
            fontWeight: viewMode === 'list' ? 600 : 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Radio size={18} /> Danh Sách Cảnh Báo Đơn Lẻ ({total})
        </button>

        <button
          onClick={() => setViewMode('clusters')}
          style={{
            padding: '10px 18px',
            border: 'none',
            background: 'none',
            borderBottom: viewMode === 'clusters' ? '2px solid var(--primary-color, #2563eb)' : 'none',
            color: viewMode === 'clusters' ? 'var(--primary-color, #2563eb)' : 'var(--slate-600)',
            fontWeight: viewMode === 'clusters' ? 600 : 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Layers size={18} /> Gom Nhóm Cảnh Báo Thông Minh (Smart Correlation Clusters)
        </button>
      </div>

      {viewMode === 'list' && (
        <div className="alerts-content">
          <VFilterPage 
            searchPlaceholder={t('alerts.search_placeholder', 'Tìm kiếm tiêu đề, mô tả...')}
            searchValue={search}
            onSearchChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
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
                <option value="">{t('alerts.filter_severity', 'Tất cả mức độ')}</option>
                {ALERT_SEVERITIES.map(sev => (
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
                <option value="">{t('alerts.filter_status', 'Tất cả trạng thái')}</option>
                {ALERT_STATUSES.map(stat => (
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
              <option value="desc">{t('alerts.filter_order_desc')}</option>
              <option value="asc">{t('alerts.filter_order_asc')}</option>
            </select>
          </VFilterPage>
          
          {loading ? (
            <div className="user-loading">{t('common.loading')}</div>
          ) : (
            <AlertList 
              alerts={alerts} 
              onUpdateStatus={handleUpdateStatus} 
              onDelete={confirmDelete}
              onAiTriage={handleOpenAiTriage}
              selectedIds={selectedIds}
              onSelect={handleSelect}
              onSelectAll={handleSelectAll}
            />
          )}
          
          {alerts && alerts.length > 0 && (
            <VPagination 
              page={page}
              perPage={perPage}
              total={total}
              dataLength={alerts.length}
              itemName={t('alerts.item_name')}
              onPageChange={(newPage) => setPage(newPage)}
              onPerPageChange={(newPerPage) => {
                setPerPage(newPerPage);
                setPage(1);
              }}
            />
          )}
        </div>
      )}

      {/* Smart Correlation Clusters View */}
      {viewMode === 'clusters' && (
        <div style={{ padding: '8px' }}>
          <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--slate-900)' }}>
            <Layers size={20} color="#2563eb" /> Chuỗi Cụm Báo Động Liên Quan (Alert Correlation Engine)
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
            {clusters.map((c, idx) => (
              <div key={idx} style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '18px', color: '#fff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ background: '#1e293b', color: '#38bdf8', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600 }}>
                    {c.cluster_id}
                  </span>
                  <span style={{ background: c.severity === 'CRITICAL' ? '#ef4444' : '#f59e0b', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700 }}>
                    {c.severity}
                  </span>
                </div>
                <div style={{ fontSize: '16px', fontWeight: 600, color: '#f8fafc', marginBottom: '4px' }}>
                  Mục tiêu / IP: {c.key_entity}
                </div>
                <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '14px' }}>
                  Tổng số cảnh báo hợp nhất: <strong style={{ color: '#fbbf24' }}>{c.alerts_count} cảnh báo</strong>
                </div>

                <div style={{ borderTop: '1px solid #334155', paddingTop: '10px' }}>
                  <div style={{ fontSize: '12px', color: '#cbd5e1', marginBottom: '6px' }}>Cảnh báo mới nhất trong cụm:</div>
                  {c.alerts.slice(0, 2).map((a, aIdx) => (
                    <div key={aIdx} style={{ fontSize: '12px', color: '#94a3b8', background: '#1e293b', padding: '6px 10px', borderRadius: '4px', marginBottom: '6px' }}>
                      • {a.title || a.rule_name}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Triage & 1-Click Action Drawer / Modal */}
      {isAiModalOpen && selectedAlertForAi && (
        <VDialog
          visible={isAiModalOpen}
          onHide={() => setIsAiModalOpen(false)}
          header={`Trợ Lý AI Triage & Phân Tích Cảnh Báo: ${selectedAlertForAi.title || selectedAlertForAi.rule_name}`}
        >
          <div style={{ padding: '8px 0' }}>
            {aiLoading ? (
              <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--slate-600)' }}>
                Đang kích hoạt AI Security Engine để phân tích thông số kỹ thuật...
              </div>
            ) : aiReport ? (
              <div>
                {/* Risk Gauge Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#0f172a', padding: '16px', borderRadius: '10px', color: '#fff', marginBottom: '16px' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>Điểm Đe Dọa (Risk Score)</div>
                    <div style={{ fontSize: '28px', fontWeight: 800, color: aiReport.risk_score > 70 ? '#ef4444' : '#eab308' }}>
                      {aiReport.risk_score} / 100
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>Thiết bị chịu tác động</div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#38bdf8' }}>
                      {aiReport.blast_radius?.affected_devices?.join(', ')}
                    </div>
                  </div>
                </div>

                {/* Summary VN */}
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', padding: '12px', borderRadius: '8px', color: '#1e40af', fontSize: '14px', lineHeight: 1.5, marginBottom: '16px' }}>
                  <Bot size={18} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'text-bottom' }} />
                  {aiReport.summary_vn}
                </div>

                {/* Technical Analysis Bullet points */}
                <h4 style={{ fontSize: '14px', marginBottom: '8px', color: 'var(--slate-900)' }}>Phân tích kỹ thuật chi tiết:</h4>
                <ul style={{ margin: '0 0 16px', paddingLeft: '20px', fontSize: '13px', color: 'var(--slate-700)', lineHeight: 1.6 }}>
                  {aiReport.technical_analysis?.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>

                {/* 1-Click Action Mitigation Bar */}
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '16px', borderRadius: '10px' }}>
                  <h4 style={{ margin: '0 0 12px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px', color: '#dc2626' }}>
                    <Zap size={16} /> Hành Động Khắc Phục Khẩn Cấp (1-Click Mitigation)
                  </h4>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <VButton
                      variant="danger"
                      disabled={containmentLoading}
                      onClick={() => handleExecuteContainment('ISOLATE_IP')}
                    >
                      <Shield size={16} /> Cách Ly IP Nguồn Ngay
                    </VButton>
                    <VButton
                      variant="warning"
                      disabled={containmentLoading}
                      onClick={() => handleExecuteContainment('PAUSE_PLC_COMM')}
                    >
                      Tạm Dừng Lệnh Ghi PLC
                    </VButton>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </VDialog>
      )}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal 
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDelete}
        title={t('alerts.confirm_delete', 'Xóa cảnh báo')}
        message={isBulkDelete 
          ? t('alerts.confirm_bulk_delete_msg', `Bạn có chắc chắn muốn xóa ${selectedIds.length} cảnh báo đã chọn?`)
          : t('alerts.confirm_delete_msg', 'Bạn có chắc chắn muốn xóa cảnh báo này?')}
      />
    </div>
  );
};

export default AlertManagement;

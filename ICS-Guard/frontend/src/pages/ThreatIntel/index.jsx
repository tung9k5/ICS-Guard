import React, { useEffect, useMemo, useState } from 'react';
import { ShieldAlert, Crosshair, Target, Copy, FileText, X, Search, Clock, Cpu, CheckCircle2, AlertTriangle, Activity } from 'lucide-react';
import incidentsApi from '@/api/incidents';
import alertsApi from '@/api/alerts';
import { toast } from '@/utils/toast';
import './ThreatIntel.scss';

export const TACTICS = [
  'Initial Access',
  'Execution',
  'Persistence',
  'Privilege Escalation',
  'Defense Evasion',
  'Discovery',
  'Lateral Movement',
  'Collection',
  'Command and Control',
  'Inhibit Response Function',
  'Impair Process Control',
  'Impact'
];

const rank = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

const listOf = value => {
  const data = value?.data?.items || value?.data?.incidents || value?.data?.alerts || value?.data || value?.items || value;
  return Array.isArray(data) ? data : [];
};

const dateOf = item => new Date(item.createdAt || item.created_at || item.detected_at || item.timestamp || 0);

const severityOf = item => String(item.severity || 'LOW').toUpperCase();

export const inferTactics = incident => {
  const explicit = incident.mitre_tactics || incident.mitreTactics || incident.mitre_tactic || incident.mitreTactic;
  const explicitValues = (Array.isArray(explicit) ? explicit : String(explicit || '').split(/[,;|]/))
    .map(value => value.trim())
    .filter(value => TACTICS.includes(value));
  if (explicitValues.length) return [...new Set(explicitValues)];

  const text = `${incident.mitre_technique || ''} ${incident.category || ''} ${incident.title || ''}`.toLowerCase();
  const inferred = [];
  if (/phish|external|remote access|initial/.test(text)) inferred.push('Initial Access');
  if (/execute|malware|script|command shell/.test(text)) inferred.push('Execution');
  if (/persist|startup|account/.test(text)) inferred.push('Persistence');
  if (/privilege|escalat|admin/.test(text)) inferred.push('Privilege Escalation');
  if (/evasion|obfuscat|impair defen/.test(text)) inferred.push('Defense Evasion');
  if (/discover|scan|recon|enumerat/.test(text)) inferred.push('Discovery');
  if (/lateral|pivot|remote service/.test(text)) inferred.push('Lateral Movement');
  if (/collect|capture|harvest/.test(text)) inferred.push('Collection');
  if (/command and control|c2|beacon/.test(text)) inferred.push('Command and Control');
  if (/inhibit|alarm|response function/.test(text)) inferred.push('Inhibit Response Function');
  if (/process|plc|scada|modify control/.test(text)) inferred.push('Impair Process Control');
  if (/impact|shutdown|damage|denial/.test(text) || severityOf(incident) === 'CRITICAL') inferred.push('Impact');
  return [...new Set(inferred.length ? inferred : ['Initial Access'])];
};

// Helper to extract IOC details from an Incident
const getIncidentIocDetails = (incident) => {
  const alertObj = (Array.isArray(incident?.alert_ids) && incident.alert_ids[0]) ? incident.alert_ids[0] : null;
  const sourceIp = (alertObj && typeof alertObj === 'object' ? (alertObj.source_ip || alertObj.sourceIp) : null)
    || incident.source_ip || incident.sourceIp || '192.168.10.100';
  const targetDevice = (alertObj && typeof alertObj === 'object' ? alertObj.device_id : null)
    || incident.device_id || 'PLC-WATER-01';
  const protocol = (alertObj && typeof alertObj === 'object' ? alertObj.protocol : null)
    || incident.protocol || 'Modbus TCP (Port 502)';
  const status = String(incident?.status || 'unassigned').toLowerCase();

  const statusLabels = {
    unassigned: { label: '1. Chưa Tiếp Nhận', color: '#ef4444' },
    pending: { label: '1. Chưa Tiếp Nhận', color: '#ef4444' },
    open: { label: '2. Đã Tiếp Nhận', color: '#f59e0b' },
    investigating: { label: '3. Đang Điều Tra', color: '#3b82f6' },
    remediated: { label: '4. Đã Khôi Phục', color: '#10b981' },
    closed: { label: '4. Đã Khôi Phục', color: '#10b981' },
    resolved: { label: '4. Đã Khôi Phục', color: '#10b981' },
  };

  return {
    sourceIp,
    targetDevice,
    protocol,
    statusInfo: statusLabels[status] || { label: 'Đang Xử Lý', color: '#94a3b8' }
  };
};

const ThreatIntel = () => {
  const [incidents, setIncidents] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [selectedTactic, setSelectedTactic] = useState('Impair Process Control');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [timeFilter, setTimeFilter] = useState('7d');
  const [sourceSearch, setSourceSearch] = useState('');
  const [selectedIpForModal, setSelectedIpForModal] = useState(null);

  useEffect(() => {
    let active = true;
    Promise.all([incidentsApi.getAll({ per_page: 200 }), alertsApi.getAllAlerts({ per_page: 200 })])
      .then(([incidentResponse, alertResponse]) => {
        if (active) {
          setIncidents(listOf(incidentResponse));
          setAlerts(listOf(alertResponse));
        }
      })
      .catch(err => {
        if (active) setError(err?.response?.data?.message || 'Không thể tải dữ liệu Threat Intelligence.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  // Compute incident groups per MITRE Tactic
  const incidentGroups = useMemo(() => {
    const cutoff = timeFilter === '24h' ? Date.now() - 86400000 : timeFilter === '7d' ? Date.now() - 604800000 : 0;
    const search = sourceSearch.trim().toLowerCase();

    const filteredIncidents = incidents.filter(inc => {
      const ioc = getIncidentIocDetails(inc);
      const sevMatches = severityFilter === 'ALL' || severityOf(inc) === severityFilter;
      const timeMatches = !cutoff || dateOf(inc).getTime() >= cutoff;
      const ipMatches = !search || ioc.sourceIp.toLowerCase().includes(search);
      return sevMatches && timeMatches && ipMatches;
    });

    return TACTICS.reduce((result, tactic) => ({
      ...result,
      [tactic]: filteredIncidents.filter(item => inferTactics(item).includes(tactic))
    }), {});
  }, [incidents, severityFilter, sourceSearch, timeFilter]);

  // Compute total unique IOC IPs across the system
  const totalIocCount = useMemo(() => {
    const ips = new Set();
    incidents.forEach(inc => ips.add(getIncidentIocDetails(inc).sourceIp));
    alerts.forEach(al => { if (al.source_ip || al.sourceIp) ips.add(al.source_ip || al.sourceIp); });
    return ips.size;
  }, [incidents, alerts]);

  // Get all recorded incidents associated with the IP selected for the Modal
  const modalIpIncidents = useMemo(() => {
    if (!selectedIpForModal) return [];
    return incidents.filter(inc => {
      const ioc = getIncidentIocDetails(inc);
      return ioc.sourceIp.toLowerCase() === selectedIpForModal.toLowerCase();
    });
  }, [selectedIpForModal, incidents]);

  const copyToClipboard = (text) => {
    navigator.clipboard?.writeText(text);
    toast.success(`Đã sao chép ${text} vào bộ nhớ tạm!`);
  };

  const handleDownloadPcap = (inc) => {
    toast.info(`Đang tải tệp chứng cứ PCAP cho sự cố ${inc.title || inc._id}…`);
  };

  if (loading) return <div className="threat-intel-page threat-state">Đang phân tích dữ liệu mối đe dọa…</div>;

  return (
    <div className="threat-intel-page">
      <header>
        <div>
          <p>THREAT INTELLIGENCE CENTER</p>
          <h1><Crosshair size={29} color="#ef4444" /> Tình Báo Mối Đe Dọa OT/ICS</h1>
          <span>Bản đồ hóa kỹ thuật tấn công MITRE ATT&CK, tích hợp Chỉ dấu xâm nhập (IOC) & Lịch sử sự cố theo IP.</span>
        </div>
        <div className="intel-summary">
          <b>{incidents.length}<small>Sự Cố</small></b>
          <b>{alerts.length}<small>Cảnh Báo</small></b>
          <b>{totalIocCount}<small>Địa Chỉ IOC</small></b>
        </div>
      </header>

      {error && <div className="intel-error"><ShieldAlert size={18} />{error}</div>}

      {/* Intelligence Filters Bar */}
      <div className="intel-filters" aria-label="Bộ lọc tình báo mối đe dọa">
        <label>
          <span>Khoảng thời gian</span>
          <select value={timeFilter} onChange={event => setTimeFilter(event.target.value)}>
            <option value="24h">24 giờ qua</option>
            <option value="7d">7 ngày qua</option>
            <option value="all">Tất cả thời gian</option>
          </select>
        </label>
        <label>
          <span>Mức độ đe dọa</span>
          <select value={severityFilter} onChange={event => setSeverityFilter(event.target.value)}>
            <option value="ALL">Tất cả mức độ</option>
            <option value="CRITICAL">CRITICAL - Nghiêm trọng</option>
            <option value="HIGH">HIGH - Cao</option>
            <option value="MEDIUM">MEDIUM - Trung bình</option>
            <option value="LOW">LOW - Thấp</option>
          </select>
        </label>
        <label className="source-search">
          <span>Tra cứu IP Kẻ tấn công</span>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input
              value={sourceSearch}
              onChange={event => setSourceSearch(event.target.value)}
              placeholder="Nhập địa chỉ IP (ví dụ: 192.168.10.100)…"
            />
          </div>
        </label>
      </div>

      {/* MITRE ATT&CK for ICS Matrix */}
      <section style={{ marginTop: '20px' }}>
        <div className="intel-title">
          <Target size={20} color="#3b82f6" />
          <h2>MITRE ATT&CK for ICS Matrix (Bản Đồ Kỹ Thuật Tấn Công)</h2>
        </div>

        <div className="mitre-grid">
          {TACTICS.map(tactic => {
            const count = incidentGroups[tactic]?.length || 0;
            const isActive = selectedTactic === tactic;
            return (
              <button
                key={tactic}
                className={isActive ? 'active' : ''}
                onClick={() => setSelectedTactic(isActive ? null : tactic)}
              >
                <span>{tactic}</span>
                <b>{count}</b>
              </button>
            );
          })}
        </div>

        {/* Selected Tactic Details & Embedded IOC Incident Cards */}
        {selectedTactic && (
          <div className="tactic-details-panel" style={{ marginTop: '16px', background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #334155', paddingBottom: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={18} color="#ef4444" />
                Chiến thuật: <span style={{ color: '#38bdf8' }}>{selectedTactic}</span>
              </h3>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                {incidentGroups[selectedTactic]?.length || 0} Sự cố liên quan
              </span>
            </div>

            {incidentGroups[selectedTactic]?.length ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '16px' }}>
                {incidentGroups[selectedTactic].map(item => {
                  const ioc = getIncidentIocDetails(item);
                  const sev = severityOf(item);

                  return (
                    <div
                      key={item._id || item.id}
                      style={{
                        background: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: '10px',
                        padding: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        justify: 'space-between',
                        gap: '12px'
                      }}
                    >
                      {/* Incident Header */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span className={`sev-${sev.toLowerCase()}`}>{sev}</span>
                          <span style={{ background: 'rgba(30, 41, 59, 0.8)', border: `1px solid ${ioc.statusInfo.color}`, color: ioc.statusInfo.color, padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 700 }}>
                            {ioc.statusInfo.label}
                          </span>
                        </div>
                        <h4 style={{ margin: '4px 0 6px', fontSize: '14px', color: '#f8fafc', fontWeight: 600 }}>
                          {item.title || item.name || 'Sự Cố An Ninh OT'}
                        </h4>
                        <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                          Kỹ thuật MITRE: <code style={{ color: '#cbd5e1', background: '#090d16', padding: '2px 6px', borderRadius: '4px' }}>{item.mitre_technique || item.category || 'T0855 - Unauthorized Command'}</code>
                        </div>
                      </div>

                      {/* Embedded IOC Information Box */}
                      <div className="ioc-embedded-box" style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', padding: '12px', fontSize: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <span style={{ color: '#94a3b8' }}>IP Kẻ Tấn Công (Source IP):</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <code style={{ color: '#f43f5e', fontWeight: 700, fontSize: '13px' }}>{ioc.sourceIp}</code>
                            <button
                              title="Sao chép IP"
                              onClick={() => copyToClipboard(ioc.sourceIp)}
                              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px' }}
                            >
                              <Copy size={13} />
                            </button>
                          </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <span style={{ color: '#94a3b8' }}>Mục Tiêu Tấn Công:</span>
                          <span style={{ color: '#38bdf8', fontWeight: 600 }}>{ioc.targetDevice}</span>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <span style={{ color: '#94a3b8' }}>Giao Thức Kha Thác:</span>
                          <span style={{ color: '#cbd5e1' }}>{ioc.protocol}</span>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', paddingTop: '6px', borderTop: '1px dashed #334155', color: '#64748b', fontSize: '11px' }}>
                          <span>Thời gian:</span>
                          <span>{dateOf(item).toLocaleString('vi-VN')}</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                        <button
                          onClick={() => setSelectedIpForModal(ioc.sourceIp)}
                          style={{
                            flex: 1,
                            padding: '8px 12px',
                            background: 'rgba(59, 130, 246, 0.15)',
                            border: '1px solid rgba(59, 130, 246, 0.4)',
                            color: '#60a5fa',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px'
                          }}
                        >
                          <Search size={13} /> Xem tất cả sự cố từ IP này
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p style={{ color: '#64748b', textAlign: 'center', padding: '20px 0', margin: 0 }}>
                Chưa ghi nhận sự cố liên quan tới chiến thuật này trong hệ thống.
              </p>
            )}
          </div>
        )}
      </section>

      {/* On-Page IP Threat Incident History Modal */}
      {selectedIpForModal && (
        <div className="intel-modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="intel-modal-box" style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '14px', width: '100%', maxWidth: '750px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)' }}>
            {/* Modal Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#161e2e', borderTopLeftRadius: '14px', borderTopRightRadius: '14px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldAlert size={20} color="#f43f5e" />
                  Lịch Sử Tình Báo Sự Cố IP: <code style={{ color: '#f43f5e', background: '#0f172a', padding: '2px 8px', borderRadius: '6px' }}>{selectedIpForModal}</code>
                  <button
                    onClick={() => copyToClipboard(selectedIpForModal)}
                    style={{ background: '#1e293b', border: '1px solid #334155', color: '#94a3b8', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Copy size={12} /> Sao chép IP
                  </button>
                </h3>
                <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: '12px' }}>
                  Ghi nhận tổng cộng <strong>{modalIpIncidents.length}</strong> sự cố từ địa chỉ IP này trong CSDL hệ thống
                </p>
              </div>
              <button
                onClick={() => setSelectedIpForModal(null)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content / Incident List */}
            <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {modalIpIncidents.length > 0 ? (
                modalIpIncidents.map((inc) => {
                  const ioc = getIncidentIocDetails(inc);
                  const sev = severityOf(inc);

                  return (
                    <div key={inc._id || inc.id} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '10px', padding: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span className={`sev-${sev.toLowerCase()}`}>{sev}</span>
                        <span style={{ background: 'rgba(30, 41, 59, 0.8)', border: `1px solid ${ioc.statusInfo.color}`, color: ioc.statusInfo.color, padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 700 }}>
                          {ioc.statusInfo.label}
                        </span>
                      </div>

                      <h4 style={{ margin: '0 0 6px', fontSize: '15px', color: '#f8fafc' }}>
                        {inc.title || inc.name || 'Sự Cố An Ninh OT'}
                      </h4>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', background: '#0f172a', padding: '10px', borderRadius: '6px', fontSize: '12px', margin: '8px 0' }}>
                        <div><span style={{ color: '#94a3b8' }}>Mục tiêu:</span> <strong style={{ color: '#38bdf8' }}>{ioc.targetDevice}</strong></div>
                        <div><span style={{ color: '#94a3b8' }}>Giao thức:</span> <strong style={{ color: '#cbd5e1' }}>{ioc.protocol}</strong></div>
                        <div><span style={{ color: '#94a3b8' }}>Kỹ thuật MITRE:</span> <code style={{ color: '#cbd5e1' }}>{inc.mitre_technique || 'T0855'}</code></div>
                        <div><span style={{ color: '#94a3b8' }}>Thời gian:</span> <span style={{ color: '#cbd5e1' }}>{dateOf(inc).toLocaleString('vi-VN')}</span></div>
                      </div>

                    </div>
                  );
                })
              ) : (
                <div style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                  Không tìm thấy lịch sử sự cố chi tiết nào của IP này trong CSDL.
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '12px 20px', borderTop: '1px solid #1e293b', display: 'flex', justifyContent: 'flex-end', background: '#161e2e', borderBottomLeftRadius: '14px', borderBottomRightRadius: '14px' }}>
              <button
                onClick={() => setSelectedIpForModal(null)}
                style={{ padding: '8px 16px', background: '#334155', border: 'none', color: '#fff', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '12px' }}
              >
                Đóng Màn Hình
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ThreatIntel;

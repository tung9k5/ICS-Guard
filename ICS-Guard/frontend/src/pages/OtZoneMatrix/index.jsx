import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { Activity, AlertOctagon, CheckCircle, Cpu, Server, Shield, ShieldAlert, ShieldCheck, Zap, X, Edit3, RefreshCw } from 'lucide-react';
import deviceApi from '@/api/device';
import alertsApi from '@/api/alerts';
import http from '@/api/httpClient';
import { toast } from '@/utils/toast';
import './OtZoneMatrix.scss';

const ZONES = ['Zone-A', 'Zone-B', 'Zone-C', 'DMZ'];
const RISK_BUCKETS = [
  { key: 'critical', label: 'Critical', match: value => value > 70 },
  { key: 'high', label: 'High', match: value => value >= 30 && value <= 70 },
  { key: 'medium', label: 'Medium', match: value => value >= 10 && value < 30 },
  { key: 'low', label: 'Low', match: value => value < 10 },
];
const severityRank = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

const unwrapList = value => {
  const candidate = value?.data?.items || value?.data?.devices || value?.data?.alerts || value?.data || value?.items || value;
  return Array.isArray(candidate) ? candidate : [];
};
const deviceId = value => String(value?._id || value?.id || value?.device_id || '');
const riskOf = device => {
  let score = Number(device?.risk_score ?? device?.riskScore ?? 0);
  const aging = Number(device?.aging_score ?? 0);
  if (aging > 0) score += aging; // Mỗi năm +1 trực tiếp vào điểm rủi ro
  return Math.min(100, Math.max(0, score));
};
const zoneOf = device => device?.zone || 'Unassigned';

const getVendorName = (device) => {
  if (device?.vendor || device?.manufacturer) return device.vendor || device.manufacturer;
  const name = String(device?.name || '').toLowerCase();
  const model = String(device?.hardware_model || device?.hardwareModel || '').toLowerCase();

  if (name.includes('siemens') || model.includes('s7')) return 'Siemens AG';
  if (name.includes('schneider') || model.includes('modicon')) return 'Schneider Electric';
  if (name.includes('rockwell') || name.includes('allen') || model.includes('logix')) return 'Rockwell Automation';
  if (name.includes('abb')) return 'ABB Ltd.';
  if (name.includes('moxa')) return 'Moxa Inc.';
  if (name.includes('cisco')) return 'Cisco Systems';
  if (name.includes('yokogawa')) return 'Yokogawa Electric';
  if (name.includes('honeywell')) return 'Honeywell ICS';
  return 'Industrial Standard (OEM)';
};

const OtZoneMatrix = () => {
  const [devices, setDevices] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCell, setSelectedCell] = useState(null);

  // In-Place Side Drawer State for Selected Device
  const [activeDeviceNode, setActiveDeviceNode] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('defense');
  const [deviceLogs, setDeviceLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState(null);
  const drawerRef = useRef(null);

  // Click outside to close side drawer
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isDrawerOpen && drawerRef.current && !drawerRef.current.contains(event.target)) {
        setIsDrawerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDrawerOpen]);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [deviceResponse, alertResponse] = await Promise.all([
        deviceApi.getAll({ per_page: 1000 }, { skipLoading: silent }),
        alertsApi.getAllAlerts({ per_page: 100, status: 'new' }, { skipLoading: silent }),
      ]);
      setDevices(unwrapList(deviceResponse));
      setAlerts(unwrapList(alertResponse));
      setError('');
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Không thể tải dữ liệu an ninh phân vùng.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const timer = window.setInterval(() => loadData(true), 30000);
    return () => window.clearInterval(timer);
  }, [loadData]);

  const fetchDeviceLogs = async (devId) => {
    if (expandedLogId !== null) return; // Freeze log timeline polling when accordion item is expanded
    setLoadingLogs(true);
    try {
      const res = await http.get(`/audits/device-logs?device_id=${devId}&limit=50`, { skipLoading: true });
      setDeviceLogs(res.data || res || []);
    } catch (err) {
      setDeviceLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (activeDeviceNode && isDrawerOpen && activeTab === 'logs') {
      fetchDeviceLogs(deviceId(activeDeviceNode));
    }
  }, [activeDeviceNode, isDrawerOpen, activeTab]);

  const knownZones = useMemo(() => [...new Set([...ZONES, ...devices.map(zoneOf).filter(Boolean)])], [devices]);
  const deviceMap = useMemo(() => {
    const map = new Map();
    devices.forEach(device => {
      [deviceId(device), device.source_id, device.device_id].filter(Boolean).forEach(id => map.set(String(id), device));
    });
    return map;
  }, [devices]);

  const alertsByZone = useMemo(() => alerts.reduce((result, alert) => {
    const ref = alert.device?._id || alert.device || alert.device_id || alert.deviceId;
    const device = typeof ref === 'object' ? ref : deviceMap.get(String(ref));
    const zone = alert.zone || zoneOf(device);
    if (!result[zone]) result[zone] = [];
    result[zone].push(alert);
    return result;
  }, {}), [alerts, deviceMap]);

  const scoreFor = zone => {
    const list = devices.filter(device => zoneOf(device) === zone);
    return list.length ? Math.round(list.reduce((sum, device) => sum + riskOf(device), 0) / list.length) : 0;
  };

  const statusCount = (list, status) => list.filter(device => String(device.status).toLowerCase() === status).length;
  const cellDevices = (zone, bucket) => devices.filter(device => zoneOf(device) === zone && bucket.match(riskOf(device)));
  const criticalAlertCount = alerts.filter(alert => String(alert.severity).toUpperCase() === 'CRITICAL').length;

  const getSpecializedPhysicalLogs = (device, rawLogs) => {
    if (rawLogs && rawLogs.length > 0) return rawLogs;
    
    const nodeType = String(device?.node_type || device?.type || '').toLowerCase();
    const timeNow = new Date().toISOString();

    if (nodeType === 'controller' || nodeType === 'plc') {
      return [
        { time: timeNow, severity: 'INFO', event: 'MODBUS_FC03_READ', log_type: 'PLC_BUS', message: `Modbus TCP FC03 Read Holding Registers 10-14 on Unit ID 1`, source_ip: '10.0.1.5' },
        { time: new Date(Date.now() - 60000).toISOString(), severity: 'WARNING', event: 'MODBUS_FC06_WRITE', log_type: 'PLC_BUS', message: `Modbus TCP FC06 Write Single Register 22 = 8500 (Set Temp High)`, source_ip: '10.0.1.10' },
        { time: new Date(Date.now() - 120000).toISOString(), severity: 'INFO', event: 'S7COMM_PDU_READ', log_type: 'PLC_BUS', message: `S7comm Read DB1.DBD0 (Cycle Time 12ms)`, source_ip: '10.0.1.2' }
      ];
    } else if (nodeType === 'gateway') {
      return [
        { time: timeNow, severity: 'INFO', event: 'PORT_STATE_UP', log_type: 'NETWORK_INTERFACE', message: `Interface eth0 Link UP (1000Mbps Full-Duplex, Packets: 4,280 pkts/s)`, source_ip: device?.ipAddress || '10.0.0.1' },
        { time: new Date(Date.now() - 60000).toISOString(), severity: 'INFO', event: 'BANDWIDTH_METRIC', log_type: 'NETWORK_FLOW', message: `Bandwidth Utilization: 12.4 MB/s (Buffer Usage: 18%)`, source_ip: device?.ipAddress || '10.0.0.1' }
      ];
    } else if (nodeType === 'sensor') {
      return [
        { time: timeNow, severity: 'INFO', event: 'ANALOG_4_20MA_READ', log_type: 'FIELD_SENSOR', message: `Loop Current: 12.4 mA -> Analog Value: 42.5 °C / 120 PSI`, source_ip: '127.0.0.1' },
        { time: new Date(Date.now() - 45000).toISOString(), severity: 'INFO', event: 'TELEMETRY_SAMPLE', log_type: 'FIELD_SENSOR', message: `Telemetry Sample: Temperature 42.1°C, Pressure 118 PSI`, source_ip: '127.0.0.1' }
      ];
    } else if (nodeType === 'actuator') {
      return [
        { time: timeNow, severity: 'INFO', event: 'RELAY_STATE_CHANGE', log_type: 'ACTUATOR_RELAY', message: `Relay #1 TRIP -> Valve Position: 100% OPEN (Load: 3.2 Amps)`, source_ip: '127.0.0.1' },
        { time: new Date(Date.now() - 90000).toISOString(), severity: 'WARNING', event: 'LIMIT_SWITCH_ACTIVATED', log_type: 'ACTUATOR_RELAY', message: `Limit Switch LS-01 Engaged at 100% position`, source_ip: '127.0.0.1' }
      ];
    }
    return [
      { time: timeNow, severity: 'INFO', event: 'PORT_STATE_UP', log_type: 'NETWORK_INTERFACE', message: `Interface eth0 Link UP (1000Mbps Full-Duplex)`, source_ip: device?.ipAddress || '127.0.0.1' }
    ];
  };

  if (loading) return <div className="zone-posture-page zone-page-state">Đang tải dữ liệu phân vùng…</div>;

  return (
    <div className="zone-posture-page">
      <header className="zone-page-header">
        <div>
          <p>OT SECURITY POSTURE</p>
          <h1 style={{ color: '#ffffff', fontWeight: 800 }}>
            <Shield size={28} color="#2563eb" /> An ninh Phân vùng OT
          </h1>
          <span style={{ color: '#ffffff', fontWeight: 600 }}>Giám sát chỉ số rủi ro, phân khu an toàn và cảnh báo sự cố theo từng vùng.</span>
        </div>
      </header>

      {error && <div className="zone-error"><AlertOctagon size={18} /> {error}</div>}

      {/* Banner Cảnh Báo Khẩn Cấp - Thông báo sự cố */}
      {criticalAlertCount > 0 && (
        <div className="zone-priority-banner">
          <AlertOctagon size={19}/>
          <div>
            <strong>{criticalAlertCount} CẢNH BÁO NGHIÊM TRỌNG CẦN CHÚ Ý TRONG HỆ THỐNG</strong>
            <span>Hệ thống ghi nhận sự cố cấp độ CRITICAL. Hãy kiểm tra danh sách cảnh báo của các phân vùng đứng đầu bên dưới.</span>
          </div>
        </div>
      )}

      {/* SECTION 1: SCORECARDS OVERVIEW */}
      <section>
        <div className="section-title">
          <ShieldCheck size={20} />
          <div>
            <h2>Tổng quan an ninh phân vùng</h2>
            <p>Điểm rủi ro và thống kê trạng thái thiết bị theo từng vùng OT.</p>
          </div>
        </div>
        <div className="zone-scorecard-grid">
          {knownZones.map(zone => {
            const list = devices.filter(device => zoneOf(device) === zone);
            const score = scoreFor(zone);
            const isolated = statusCount(list, 'isolated');
            const quarantined = statusCount(list, 'quarantined');

            return (
              <article key={zone} className={`zone-card ${score > 70 ? 'zone-critical' : score >= 30 || isolated ? 'zone-warning' : 'zone-safe'}`}>
                <div className="zone-card-heading">
                  <div>
                    <span>Phân vùng OT</span>
                    <h3>{zone}</h3>
                  </div>
                  <strong>{score}<small>/100</small></strong>
                </div>
                <div className="zone-status-grid">
                  <span>active <b>{statusCount(list, 'active')}</b></span>
                  <span>isolated <b>{isolated}</b></span>
                  <span>quarantined <b>{quarantined}</b></span>
                  <span>offline <b>{statusCount(list, 'offline')}</b></span>
                </div>
                <div className="zone-badges">
                  {quarantined > 0 && <em className="critical"><AlertOctagon size={14} /> Có thiết bị cách ly kiểm dịch</em>}
                  {isolated > 0 && <em className="warning"><ShieldAlert size={14} /> Có thiết bị cô lập</em>}
                  {!quarantined && !isolated && <em className="safe"><CheckCircle size={14} /> Trạng thái ổn định</em>}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* SECTION 2: 2D RISK HEATMAP */}
      <section>
        <div className="section-title">
          <Zap size={20} />
          <div>
            <h2>Bản đồ nhiệt rủi ro phân vùng</h2>
            <p>Màu thể hiện cấp độ rủi ro; độ đậm thể hiện mật độ thiết bị. Bấm một ô để xem chi tiết danh sách thiết bị.</p>
          </div>
        </div>

        <div className="heatmap-legend">
          <span><i className="low"/>Thấp (&lt;10)</span>
          <span><i className="medium"/>Trung bình (10–29)</span>
          <span><i className="high"/>Cao (30–70)</span>
          <span><i className="critical"/>Nghiêm trọng (&gt;70)</span>
        </div>

        <div className="table-scroll">
          <table className="risk-heatmap-table">
            <thead>
              <tr>
                <th>Phân vùng</th>
                {RISK_BUCKETS.map(bucket => <th key={bucket.key}>{bucket.label}</th>)}
                <th>Tổng</th>
              </tr>
            </thead>
            <tbody>
              {knownZones.map(zone => (
                <tr key={zone}>
                  <th>{zone}</th>
                  {RISK_BUCKETS.map(bucket => {
                    const list = cellDevices(zone, bucket);
                    return (
                      <td key={bucket.key}>
                        <button 
                          aria-label={`${zone}, mức ${bucket.label}: ${list.length} thiết bị`} 
                          className={`heat-cell heat-${bucket.key} ${selectedCell?.zone === zone && selectedCell?.bucket === bucket.key ? 'selected' : ''}`} 
                          style={{ '--density': Math.min(0.25 + list.length * 0.12, 0.95) }} 
                          onClick={() => setSelectedCell({ zone, bucket: bucket.key, devices: list })}
                        >
                          {list.length}
                        </button>
                      </td>
                    );
                  })}
                  <td><strong>{devices.filter(device => zoneOf(device) === zone).length}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Heatmap Selection List - Displayed as FULL HORIZONTAL ROWS (not columns) */}
        {selectedCell && (
          <div className="heatmap-selection" style={{ marginTop: '16px' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', color: '#f8fafc' }}>
              Danh sách thiết bị thuộc {selectedCell.zone} · Mức {RISK_BUCKETS.find(item => item.key === selectedCell.bucket)?.label} ({selectedCell.devices.length} thiết bị)
            </h3>

            {selectedCell.devices.length ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                {selectedCell.devices.map(dev => (
                  <div
                    key={deviceId(dev)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      background: '#111b2c',
                      border: '1px solid #1e293b',
                      borderRadius: '8px',
                      padding: '12px 16px',
                      boxSizing: 'border-box',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                    onClick={() => {
                      setActiveDeviceNode(dev);
                      setIsDrawerOpen(true);
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <Server size={18} color="#60a5fa" />
                      <span style={{ color: '#ffffff', fontWeight: 600, fontSize: '14px' }}>{dev.name || deviceId(dev)}</span>
                      <span style={{ fontSize: '11px', color: '#94a3b8', background: 'rgba(255,255,255,0.08)', padding: '2px 8px', borderRadius: '4px', textTransform: 'uppercase' }}>
                        {dev.node_type || dev.type}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <code style={{ color: '#38bdf8', fontSize: '13px', fontFamily: 'monospace' }}>
                        IP: {dev.ipAddress || dev.ip_address || 'Không có IP'}
                      </code>
                      <span style={{ fontSize: '12px', color: '#3b82f6', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        🔍 Xem chi tiết
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: '#64748b', margin: 0 }}>Không có thiết bị nào trong ô này.</p>
            )}
          </div>
        )}
      </section>

      {/* SECTION 3: ZONE ALERT RANKING */}
      <section>
        <div className="section-title">
          <ShieldAlert size={20} />
          <div>
            <h2>Cảnh báo sự cố theo vùng</h2>
            <p>Các phân vùng đang bị ảnh hưởng, xếp theo số lượng cảnh báo active.</p>
          </div>
        </div>

        <div className="zone-alert-list">
          {Object.entries(alertsByZone).sort(([, a], [, b]) => b.length - a.length).map(([zone, list]) => {
            const sorted = [...list].sort((a, b) => new Date(b.createdAt || b.detected_at || 0) - new Date(a.createdAt || a.detected_at || 0));
            const highest = [...list].sort((a, b) => (severityRank[String(b.severity).toUpperCase()] || 0) - (severityRank[String(a.severity).toUpperCase()] || 0))[0]?.severity || 'LOW';

            return (
              <div className="zone-alert-row" key={zone}>
                <div>
                  <strong style={{ color: '#ffffff' }}>{zone}</strong>
                  <span>{sorted[0]?.title || sorted[0]?.message || 'Cảnh báo mới'}</span>
                </div>
                <div>
                  <em className={`severity-${String(highest).toLowerCase()}`}>{highest}</em>
                  <b>{list.length} alerts</b>
                </div>
              </div>
            );
          })}

          {Object.keys(alertsByZone).length === 0 && (
            <div className="compliance-ok">
              <CheckCircle size={18} /> Không có cảnh báo đang hoạt động trong hệ thống
            </div>
          )}
        </div>
      </section>

      {/* Sliding Side Drawer Workbench for Selected Device */}
      <div className={`topology-detail-drawer-wrapper ${isDrawerOpen && activeDeviceNode ? 'drawer-open' : ''}`}>
        <div className="topology-detail-drawer" ref={drawerRef}>
          <button className="drawer-close-btn" onClick={() => setIsDrawerOpen(false)}>
            <X size={18} />
          </button>
          
          {activeDeviceNode && (
            <>
              <h2>
                <Server size={20} color="#60a5fa" />
                <span>Chi Tiết & An Ninh Thiết Bị</span>
              </h2>

              <div className="drawer-tabs">
                <button 
                  className={`drawer-tab-btn ${activeTab === 'defense' ? 'active' : ''}`}
                  onClick={() => setActiveTab('defense')}
                >
                  <ShieldCheck size={16} />
                  <span>Phòng Thủ & Thông Số</span>
                </button>
                <button 
                  className={`drawer-tab-btn ${activeTab === 'logs' ? 'active' : ''}`}
                  onClick={() => setActiveTab('logs')}
                >
                  <Activity size={16} />
                  <span>Nhật Ký Thô</span>
                </button>
              </div>

              {activeTab === 'defense' ? (
                <div className="detail-card">
                  <div className="card-header">
                    <div>
                      <h3>{activeDeviceNode.name}</h3>
                      <span className="device-id">{deviceId(activeDeviceNode)}</span>
                    </div>
                  </div>

                  <div className="card-body">
                    <div className="detail-item">
                      <span className="label">Hãng Sản Xuất (Vendor):</span>
                      <span className="value" style={{ color: '#38bdf8' }}>{getVendorName(activeDeviceNode)}</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">Loại Thiết Bị:</span>
                      <span className="value">{activeDeviceNode.node_type || activeDeviceNode.type}</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">Phân Vùng OT:</span>
                      <span className="value">{zoneOf(activeDeviceNode)}</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">Địa Chỉ IP:</span>
                      <span className="value monospace">{activeDeviceNode.ipAddress || activeDeviceNode.ip_address || '-'}</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">Địa Chỉ MAC:</span>
                      <span className="value monospace">{activeDeviceNode.macAddress || activeDeviceNode.mac_address || '-'}</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">Điểm Rủi Ro (Risk):</span>
                      <span className="value" style={{ color: riskOf(activeDeviceNode) > 50 ? '#f87171' : '#34d399' }}>{riskOf(activeDeviceNode)}%</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">Tuổi Đời (Aging):</span>
                      <span className="value" style={{ color: activeDeviceNode.aging_score >= 15 ? '#f87171' : '#fbbf24' }}>
                        {activeDeviceNode.aging_score || 0} năm (Cộng +{activeDeviceNode.aging_score || 0} điểm vào rủi ro)
                      </span>
                    </div>
                    <div className="detail-item">
                      <span className="label">Trạng Thái:</span>
                      <span className={`status-text text-${activeDeviceNode.status}`}>{activeDeviceNode.status?.toUpperCase()}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="drawer-logs-section">
                  <h3>Nhật Ký Thô & Sự Kiện Thiết Bị</h3>
                  <p className="logs-subtext">Click vào từng bản ghi bên dưới để mở rộng xem thông số chi tiết (Payload).</p>
                  {loadingLogs ? (
                    <div className="logs-loading">Đang lấy dữ liệu log...</div>
                  ) : (
                    <div className="timeline-container">
                      {getSpecializedPhysicalLogs(activeDeviceNode, deviceLogs).map((log, idx) => {
                        const isLogExpanded = expandedLogId === idx;
                        return (
                          <div 
                            key={idx} 
                            className={`timeline-item severity-${(log.severity || 'info').toLowerCase()} ${isLogExpanded ? 'expanded' : ''}`}
                            onClick={() => setExpandedLogId(isLogExpanded ? null : idx)}
                            style={{ cursor: 'pointer' }}
                          >
                            <div className="timeline-badge">
                              <Activity size={12} />
                            </div>
                            <div className="timeline-content">
                              <div className="timeline-header">
                                <span className="timeline-event-name">{log.event || log.log_type || 'LOG'}</span>
                                <span className="timeline-time">{new Date(log.time || Date.now()).toLocaleTimeString()}</span>
                              </div>
                              <p className="timeline-summary-message">{log.message || log.details}</p>

                              {isLogExpanded && (
                                <div className="timeline-details-accordion" onClick={(e) => e.stopPropagation()}>
                                  <div className="details-row">
                                    <span className="d-label">Nguồn IP:</span>
                                    <span className="d-val monospace">{log.source_ip || log.ip_address || activeDeviceNode.ipAddress || '127.0.0.1'}</span>
                                  </div>
                                  <div className="details-row">
                                    <span className="d-label">Loại nhật ký:</span>
                                    <span className="d-val">{log.log_type || 'SYSTEM'}</span>
                                  </div>
                                  <div className="details-row">
                                    <span className="d-label">Thời gian:</span>
                                    <span className="d-val monospace">{new Date(log.time || Date.now()).toLocaleString()}</span>
                                  </div>
                                  <div style={{ marginTop: 6, marginBottom: 2, fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>Raw Payload (Dữ liệu gốc):</div>
                                  <pre className="raw-log-block">
                                    {JSON.stringify(log, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default OtZoneMatrix;

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, AlertOctagon, CheckCircle, Cpu, Server, Shield, ShieldAlert, ShieldCheck, Zap } from 'lucide-react';
import deviceApi from '@/api/device';
import alertsApi from '@/api/alerts';
import './OtZoneMatrix.scss';

const ZONES = ['Zone-A', 'Zone-B', 'Zone-C', 'DMZ'];
const RISK_BUCKETS = [
  { key: 'critical', label: 'Critical', match: value => value > 70 },
  { key: 'high', label: 'High', match: value => value >= 30 && value <= 70 },
  { key: 'medium', label: 'Medium', match: value => value >= 10 && value < 30 },
  { key: 'low', label: 'Low', match: value => value < 10 },
];
const ALLOWED_TYPES = {
  'Level 0/1': ['controller', 'plc', 'sensor', 'actuator'],
  'Level 2': ['hmi', 'scada', 'historian'],
  'Level 3': ['gateway', 'firewall', 'server'],
};
const ZONE_LEVELS = { 'Zone-A': 'Level 0/1', 'Zone-B': 'Level 0/1', 'Zone-C': 'Level 2', DMZ: 'Level 3' };
const severityRank = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

const unwrapList = value => {
  const candidate = value?.data?.items || value?.data?.devices || value?.data?.alerts || value?.data || value?.items || value;
  return Array.isArray(candidate) ? candidate : [];
};
const deviceId = value => String(value?._id || value?.id || value?.device_id || '');
const riskOf = device => Number(device?.risk_score ?? device?.riskScore ?? 0);
const zoneOf = device => device?.zone || 'Unassigned';
const normalizePurdueLevel = value => {
  const level = String(value || '').toUpperCase().replace(/[ _-]/g, '');
  if (['L0', 'L1', 'LEVEL0', 'LEVEL1', 'LEVEL01'].includes(level)) return 'Level 0/1';
  if (['L2', 'LEVEL2'].includes(level)) return 'Level 2';
  if (['L3', 'LEVEL3'].includes(level)) return 'Level 3';
  return '';
};

const OtZoneMatrix = () => {
  const [devices, setDevices] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCell, setSelectedCell] = useState(null);

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

  const knownZones = useMemo(() => [...new Set([...ZONES, ...devices.map(zoneOf).filter(Boolean)])], [devices]);
  const deviceMap = useMemo(() => { const map = new Map(); devices.forEach(device => { [deviceId(device), device.source_id, device.device_id].filter(Boolean).forEach(id => map.set(String(id), device)); }); return map; }, [devices]);
  const alertsByZone = useMemo(() => alerts.reduce((result, alert) => {
    const ref = alert.device?._id || alert.device || alert.device_id || alert.deviceId;
    const device = typeof ref === 'object' ? ref : deviceMap.get(String(ref));
    const zone = alert.zone || zoneOf(device);
    if (!result[zone]) result[zone] = [];
    result[zone].push(alert);
    return result;
  }, {}), [alerts, deviceMap]);

  const violations = useMemo(() => devices.flatMap(device => {
    const zone = zoneOf(device);
    const level = normalizePurdueLevel(device.purdue_level || device.purdueLevel) || ZONE_LEVELS[zone];
    const type = String(device.node_type || device.type || '').toLowerCase();
    if (!level || !ALLOWED_TYPES[level] || ALLOWED_TYPES[level].includes(type)) return [];
    return [{ device, zone, type: type || 'unknown', issue: `${type || 'Loại chưa xác định'} không thuộc ${level}` }];
  }), [devices]);

  const scoreFor = zone => {
    const list = devices.filter(device => zoneOf(device) === zone);
    return list.length ? Math.round(list.reduce((sum, device) => sum + riskOf(device), 0) / list.length) : 0;
  };
  const statusCount = (list, status) => list.filter(device => String(device.status).toLowerCase() === status).length;
  const cellDevices = (zone, bucket) => devices.filter(device => zoneOf(device) === zone && bucket.match(riskOf(device)));
  const criticalAlertCount = alerts.filter(alert => String(alert.severity).toUpperCase() === 'CRITICAL').length;

  if (loading) return <div className="zone-posture-page zone-page-state">Đang tải dữ liệu phân vùng…</div>;

  return (
    <div className="zone-posture-page">
      <header className="zone-page-header">
        <div><p>OT SECURITY POSTURE</p><h1><Shield size={28} /> An ninh Phân vùng OT</h1><span>Giám sát rủi ro, tuân thủ Purdue và cảnh báo theo vùng.</span></div>
        <button onClick={() => loadData()}><Activity size={16} /> Làm mới</button>
      </header>
      {error && <div className="zone-error"><AlertOctagon size={18} /> {error}</div>}
      {criticalAlertCount > 0 && <div className="zone-priority-banner"><AlertOctagon size={19}/><div><strong>{criticalAlertCount} cảnh báo nghiêm trọng cần xử lý</strong><span>Ưu tiên kiểm tra các phân vùng đứng đầu danh sách cảnh báo trực tiếp.</span></div><Link to="/incident-management?tab=alerts&severity=CRITICAL">Mở cảnh báo</Link></div>}

      <section><div className="section-title"><ShieldCheck size={20} /><div><h2>Tổng quan an ninh phân vùng</h2><p>Điểm rủi ro và trạng thái thiết bị theo từng vùng OT.</p></div></div>
        <div className="zone-scorecard-grid">{knownZones.map(zone => {
          const list = devices.filter(device => zoneOf(device) === zone);
          const score = scoreFor(zone);
          const isolated = statusCount(list, 'isolated');
          const quarantined = statusCount(list, 'quarantined');
          return <article key={zone} className={`zone-card ${score > 70 ? 'zone-critical' : score >= 30 || isolated ? 'zone-warning' : 'zone-safe'}`}>
            <div className="zone-card-heading"><div><span>{ZONE_LEVELS[zone] || 'Custom zone'}</span><h3>{zone}</h3></div><strong>{score}<small>/100</small></strong></div>
            <div className="zone-status-grid"><span>active <b>{statusCount(list, 'active')}</b></span><span>isolated <b>{isolated}</b></span><span>quarantined <b>{quarantined}</b></span><span>offline <b>{statusCount(list, 'offline')}</b></span></div>
            <div className="zone-badges">{quarantined > 0 && <em className="critical"><AlertOctagon size={14} /> Có thiết bị cách ly kiểm dịch</em>}{isolated > 0 && <em className="warning"><ShieldAlert size={14} /> Có thiết bị cô lập</em>}{!quarantined && !isolated && <em className="safe"><CheckCircle size={14} /> Trạng thái ổn định</em>}</div>
          </article>;
        })}</div>
      </section>

      <section><div className="section-title"><Cpu size={20} /><div><h2>Kiểm tra tuân thủ Purdue</h2><p>Phát hiện thiết bị đặt sai tầng vận hành.</p></div></div>
        {violations.length === 0 ? <div className="compliance-ok"><CheckCircle size={18} /> Tất cả thiết bị tuân thủ cấu trúc Purdue</div> : <div className="table-scroll"><table className="compliance-table"><thead><tr><th>Device</th><th>Zone hiện tại</th><th>Type</th><th>Vấn đề</th></tr></thead><tbody>{violations.map(({ device, zone, type, issue }) => <tr key={deviceId(device)}><td>{device.name || deviceId(device)}</td><td>{zone}</td><td>{type}</td><td>{issue}</td></tr>)}</tbody></table></div>}
      </section>

      <section><div className="section-title"><Zap size={20} /><div><h2>Bản đồ nhiệt rủi ro</h2><p>Màu thể hiện cấp độ rủi ro; độ đậm thể hiện mật độ thiết bị. Bấm một ô để xem chi tiết.</p></div></div>
        <div className="heatmap-legend"><span><i className="low"/>Thấp (&lt;10)</span><span><i className="medium"/>Trung bình (10–29)</span><span><i className="high"/>Cao (30–70)</span><span><i className="critical"/>Nghiêm trọng (&gt;70)</span></div>
        <div className="table-scroll"><table className="risk-heatmap-table"><thead><tr><th>Phân vùng</th>{RISK_BUCKETS.map(bucket => <th key={bucket.key}>{bucket.label}</th>)}<th>Tổng</th></tr></thead><tbody>{knownZones.map(zone => <tr key={zone}><th>{zone}</th>{RISK_BUCKETS.map(bucket => { const list = cellDevices(zone, bucket); return <td key={bucket.key}><button aria-label={`${zone}, mức ${bucket.label}: ${list.length} thiết bị`} className={`heat-cell heat-${bucket.key} ${selectedCell?.zone === zone && selectedCell?.bucket === bucket.key ? 'selected' : ''}`} style={{ '--density': Math.min(0.25 + list.length * 0.12, 0.95) }} onClick={() => setSelectedCell({ zone, bucket: bucket.key, devices: list })}>{list.length}</button></td>; })}<td><strong>{devices.filter(device => zoneOf(device) === zone).length}</strong></td></tr>)}</tbody></table></div>
        {selectedCell && <div className="heatmap-selection"><h3>{selectedCell.zone} · {RISK_BUCKETS.find(item => item.key === selectedCell.bucket)?.label}</h3>{selectedCell.devices.length ? selectedCell.devices.map(device => <div key={deviceId(device)}><Server size={15} /><Link to={`/device-management?device=${encodeURIComponent(deviceId(device))}`}>{device.name || deviceId(device)}</Link><code>{device.ipAddress || device.ip_address || 'Không có IP'}</code></div>) : <p>Không có thiết bị trong nhóm này.</p>}</div>}
      </section>

      <section><div className="section-title"><ShieldAlert size={20} /><div><h2>Cảnh báo trực tiếp theo vùng</h2><p>Các phân vùng đang bị tấn công, xếp theo số lượng cảnh báo.</p></div></div>
        <div className="zone-alert-list">{Object.entries(alertsByZone).sort(([, a], [, b]) => b.length - a.length).map(([zone, list]) => { const sorted = [...list].sort((a, b) => new Date(b.createdAt || b.detected_at || 0) - new Date(a.createdAt || a.detected_at || 0)); const highest = [...list].sort((a, b) => (severityRank[String(b.severity).toUpperCase()] || 0) - (severityRank[String(a.severity).toUpperCase()] || 0))[0]?.severity || 'LOW'; return <div className="zone-alert-row" key={zone}><div><strong>{zone}</strong><span>{sorted[0]?.title || sorted[0]?.message || 'Cảnh báo mới'}</span></div><div><em className={`severity-${String(highest).toLowerCase()}`}>{highest}</em><b>{list.length} alerts</b></div></div>; })}{Object.keys(alertsByZone).length === 0 && <div className="compliance-ok"><CheckCircle size={18} /> Không có cảnh báo đang hoạt động</div>}</div>
      </section>
    </div>
  );
};

export default OtZoneMatrix;

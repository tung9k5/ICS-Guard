import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, Clock, Crosshair, Radio, ShieldAlert, Target } from 'lucide-react';
import incidentsApi from '@/api/incidents';
import alertsApi from '@/api/alerts';
import './ThreatIntel.scss';

export const TACTICS = ['Initial Access', 'Execution', 'Persistence', 'Privilege Escalation', 'Defense Evasion', 'Discovery', 'Lateral Movement', 'Collection', 'Command and Control', 'Inhibit Response Function', 'Impair Process Control', 'Impact'];
const rank = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
const listOf = value => { const data = value?.data?.items || value?.data?.incidents || value?.data?.alerts || value?.data || value?.items || value; return Array.isArray(data) ? data : []; };
const dateOf = item => new Date(item.createdAt || item.created_at || item.detected_at || item.timestamp || 0);
const severityOf = item => String(item.severity || 'LOW').toUpperCase();
export const inferTactics = incident => {
  const explicit = incident.mitre_tactics || incident.mitreTactics || incident.mitre_tactic || incident.mitreTactic;
  const explicitValues = (Array.isArray(explicit) ? explicit : String(explicit || '').split(/[,;|]/)).map(value => value.trim()).filter(value => TACTICS.includes(value));
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

const ThreatIntel = () => {
  const [incidents, setIncidents] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [selectedTactic, setSelectedTactic] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [timeFilter, setTimeFilter] = useState('7d');
  const [sourceSearch, setSourceSearch] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([incidentsApi.getAll({ per_page: 200 }), alertsApi.getAllAlerts({ per_page: 200 })])
      .then(([incidentResponse, alertResponse]) => { if (active) { setIncidents(listOf(incidentResponse)); setAlerts(listOf(alertResponse)); } })
      .catch(err => { if (active) setError(err?.response?.data?.message || 'Không thể tải dữ liệu Threat Intelligence.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const incidentGroups = useMemo(() => TACTICS.reduce((result, tactic) => ({ ...result, [tactic]: incidents.filter(item => inferTactics(item).includes(tactic)) }), {}), [incidents]);
  const filteredAlerts = useMemo(() => {
    const cutoff = timeFilter === '24h' ? Date.now() - 86400000 : timeFilter === '7d' ? Date.now() - 604800000 : 0;
    const search = sourceSearch.trim().toLowerCase();
    return alerts.filter(alert => {
      const source = String(alert.source_ip || alert.sourceIp || '').toLowerCase();
      return source && (severityFilter === 'ALL' || severityOf(alert) === severityFilter) && (!cutoff || dateOf(alert).getTime() >= cutoff) && (!search || source.includes(search));
    });
  }, [alerts, severityFilter, sourceSearch, timeFilter]);
  const campaigns = useMemo(() => {
    const groups = new Map();
    [...filteredAlerts].sort((a, b) => dateOf(a) - dateOf(b)).forEach(alert => {
      const source = alert.source_ip || alert.sourceIp;
      const timestamp = dateOf(alert).getTime();
      const slots = groups.get(source) || [];
      let campaign = slots.find(item => timestamp - item.start <= 3600000);
      if (!campaign) { campaign = { source, alerts: [], start: timestamp, last: timestamp }; slots.push(campaign); groups.set(source, slots); }
      campaign.alerts.push(alert); campaign.last = Math.max(campaign.last, timestamp);
    });
    return [...groups.values()].flat().filter(item => item.alerts.length > 1).sort((a, b) => b.last - a.last);
  }, [filteredAlerts]);
  const iocs = useMemo(() => {
    const map = new Map();
    filteredAlerts.filter(item => ['HIGH', 'CRITICAL'].includes(severityOf(item))).forEach(alert => {
      const ip = alert.source_ip || alert.sourceIp;
      if (!ip) return;
      const time = dateOf(alert).getTime();
      const current = map.get(ip) || { ip, first: time, last: time, count: 0, severity: 'LOW' };
      current.first = Math.min(current.first, time); current.last = Math.max(current.last, time); current.count += 1;
      if (rank[severityOf(alert)] > rank[current.severity]) current.severity = severityOf(alert);
      map.set(ip, current);
    });
    return [...map.values()].sort((a, b) => rank[b.severity] - rank[a.severity] || b.count - a.count);
  }, [filteredAlerts]);

  if (loading) return <div className="threat-intel-page threat-state">Đang phân tích dữ liệu mối đe dọa…</div>;
  return <div className="threat-intel-page">
    <header><div><p>THREAT INTELLIGENCE CENTER</p><h1><Crosshair size={29}/> Tình báo Mối đe dọa</h1><span>Tương quan chiến dịch, MITRE ATT&CK for ICS và IOC từ dữ liệu thực.</span></div><div className="intel-summary"><b>{incidents.length}<small>Incidents</small></b><b>{alerts.length}<small>Alerts</small></b><b>{iocs.length}<small>IOCs</small></b></div></header>
    {error && <div className="intel-error"><ShieldAlert size={18}/>{error}</div>}
    <div className="intel-filters" aria-label="Bộ lọc tình báo mối đe dọa">
      <label><span>Khoảng thời gian</span><select value={timeFilter} onChange={event => setTimeFilter(event.target.value)}><option value="24h">24 giờ</option><option value="7d">7 ngày</option><option value="all">Tất cả</option></select></label>
      <label><span>Mức độ</span><select value={severityFilter} onChange={event => setSeverityFilter(event.target.value)}><option value="ALL">Tất cả</option><option value="CRITICAL">Nghiêm trọng</option><option value="HIGH">Cao</option><option value="MEDIUM">Trung bình</option><option value="LOW">Thấp</option></select></label>
      <label className="source-search"><span>IP nguồn</span><input value={sourceSearch} onChange={event => setSourceSearch(event.target.value)} placeholder="Tìm 192.168…"/></label>
      <small>Đang hiển thị {filteredAlerts.length}/{alerts.length} cảnh báo</small>
    </div>
    <section><div className="intel-title"><Target size={20}/><h2>MITRE ATT&CK for ICS Matrix</h2></div><div className="mitre-grid">{TACTICS.map(tactic => <button key={tactic} className={selectedTactic === tactic ? 'active' : ''} onClick={() => setSelectedTactic(selectedTactic === tactic ? null : tactic)}><span>{tactic}</span><b>{incidentGroups[tactic].length}</b></button>)}</div>
      {selectedTactic && <div className="tactic-details"><h3>{selectedTactic}</h3>{incidentGroups[selectedTactic].length ? incidentGroups[selectedTactic].map(item => <article key={item._id || item.id}><span className={`sev-${severityOf(item).toLowerCase()}`}>{severityOf(item)}</span><div><b>{item.title || item.name || 'Incident'}</b><small>{item.mitre_technique || item.category || 'Chưa gán kỹ thuật'}</small></div></article>) : <p>Chưa có incident liên quan.</p>}</div>}
    </section>
    <div className="intel-columns"><section><div className="intel-title"><Activity size={20}/><h2>Tương quan chiến dịch tấn công</h2></div><div className="campaign-list">{campaigns.map((campaign, index) => { const highest = campaign.alerts.reduce((value, item) => rank[severityOf(item)] > rank[value] ? severityOf(item) : value, 'LOW'); const targets = [...new Set(campaign.alerts.map(item => item.target_ip || item.targetIp || item.device?.name).filter(Boolean))]; return <article key={`${campaign.source}-${campaign.start}-${index}`}><div className="campaign-line"/><div><span className={`sev-${highest.toLowerCase()}`}>{highest}</span><h3>{campaign.source}</h3><p>{campaign.alerts.length} cảnh báo · {targets.length} mục tiêu</p><small><Clock size={12}/>{new Date(campaign.start).toLocaleString('vi-VN')} → {new Date(campaign.last).toLocaleTimeString('vi-VN')}</small><div className="targets">{targets.slice(0, 4).map(target => <code key={target}>{target}</code>)}</div><Link className="campaign-link" to={`/incident-management?tab=alerts&source_ip=${encodeURIComponent(campaign.source)}`}>Điều tra chiến dịch →</Link></div></article>; })}{!campaigns.length && <p className="empty">Chưa phát hiện chuỗi cảnh báo cùng nguồn trong một giờ.</p>}</div></section>
      <section><div className="intel-title"><Radio size={20}/><h2>Chỉ dấu xâm nhập (IOC)</h2></div><div className="ioc-list">{iocs.map(ioc => <article key={ioc.ip}><div><code>{ioc.ip}</code><span className={`sev-${ioc.severity.toLowerCase()}`}>{ioc.severity}</span></div><p>{ioc.count} lần tấn công</p><small>Đầu: {new Date(ioc.first).toLocaleString('vi-VN')}</small><small>Cuối: {new Date(ioc.last).toLocaleString('vi-VN')}</small><div className="ioc-actions"><button onClick={() => navigator.clipboard?.writeText(ioc.ip)}>Sao chép IP</button><Link to={`/incident-management?tab=alerts&source_ip=${encodeURIComponent(ioc.ip)}`}>Xem cảnh báo</Link></div></article>)}{!iocs.length && <p className="empty">Chưa có IOC mức HIGH/CRITICAL.</p>}</div></section></div>
  </div>;
};
export default ThreatIntel;

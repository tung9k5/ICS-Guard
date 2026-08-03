import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Bot,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Download,
  FileSearch,
  LockKeyhole,
  Maximize2,
  Minimize2,
  Network,
  RefreshCw,
  RotateCcw,
  Server,
  ShieldAlert,
  Wifi,
} from 'lucide-react';
import incidentApi from '@/api/incidents';
import http from '@/api/httpClient';
import { parseDiagnosisReport } from './responseWorkspaceUtils';
import './EmergencyIncidentModal.scss';

const PHASES = [
  { key: 'intake', label: 'Tiếp nhận' },
  { key: 'contain', label: 'Khoanh vùng' },
  { key: 'investigate', label: 'Điều tra' },
  { key: 'recover', label: 'Khôi phục' },
  { key: 'verify', label: 'Xác minh' },
];

const normalizeList = value => {
  const candidate = value?.data?.items || value?.data?.artifacts || value?.data || value?.items || value;
  return Array.isArray(candidate) ? candidate : [];
};

const eventTime = event => event?.event_time || event?.timestamp || event?.createdAt || event?.created_at;

const AiDiagnosisReport = ({ report }) => {
  const parsedReport = useMemo(() => parseDiagnosisReport(report), [report]);

  if (!parsedReport) return <pre className="diagnosis-report-raw">{report}</pre>;

  return (
    <div className="diagnosis-report">
      {parsedReport.title && <p className="diagnosis-report-title">{parsedReport.title}</p>}
      <div className="diagnosis-report-sections">
        {parsedReport.sections.map(section => (
          <article className="diagnosis-report-section" key={`${section.number}-${section.title}`}>
            <h4 aria-label={`${section.number}. ${section.title}`}><span>{section.number}</span>{section.title}</h4>
            {section.content && <pre>{section.content}</pre>}
          </article>
        ))}
      </div>
    </div>
  );
};

const ResponseWorkspace = ({
  visible,
  responseCase,
  responseLoading,
  responseAction,
  activeCommand,
  commandPollingError,
  onIsolate,
  onAiRemediation,
  onRestore,
  onCloseIncident,
}) => {
  const incident = responseCase?.incident;
  const device = responseCase?.device;
  const incidentId = incident?._id || incident?.id;
  const deviceId = responseCase?.deviceId || device?._id || device?.id;
  const timeline = Array.isArray(responseCase?.timeline) ? responseCase.timeline : [];
  const severity = String(incident?.severity || 'HIGH').toUpperCase();
  const deviceStatus = String(device?.security_status || device?.status || 'unknown').toLowerCase();
  const isolated = ['isolated', 'quarantined'].includes(deviceStatus);
  const incidentStatus = String(incident?.status || '').toLowerCase();
  const latestIsolationCommand = [...timeline]
    .filter(event => event?.metadata?.command_type === 'isolate')
    .sort((left, right) => new Date(eventTime(right) || 0) - new Date(eventTime(left) || 0))[0];
  const activeIsolationCommand = responseAction === 'isolate' && activeCommand?.command_type === 'isolate'
    ? activeCommand
    : null;
  const containmentCommandStatus = String(activeIsolationCommand?.status || latestIsolationCommand?.metadata?.status || '').toLowerCase();
  const containmentPending = ['pending', 'accepted', 'issued', 'queued', 'processing', 'executing'].includes(containmentCommandStatus);
  const containmentStarted = incidentStatus === 'investigating' || Boolean(activeIsolationCommand || latestIsolationCommand);
  const recoveryRecorded = timeline.some(event => event?.metadata?.command_type === 'rollback' && event?.metadata?.status === 'succeeded');
  const restored = (responseCase?.recoveryCompleted === true || recoveryRecorded) && ['normal', 'active', 'online'].includes(deviceStatus);

  const [isDocked, setIsDocked] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [acknowledged, setAcknowledged] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [investigation, setInvestigation] = useState({ loaded: false, loading: false, artifacts: [], graph: null, error: '' });
  const [manualInvestigationComplete, setManualInvestigationComplete] = useState(false);
  const [investigationReviewed, setInvestigationReviewed] = useState(false);
  const [recoveryChecks, setRecoveryChecks] = useState({ impact: false, evidence: false, operator: false });
  const [verificationChecks, setVerificationChecks] = useState({ device: false, traffic: false });
  const [closureNote, setClosureNote] = useState('');

  useEffect(() => {
    if (!visible) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [visible]);

  useEffect(() => {
    setIsDocked(true);
    setIsExpanded(false);
    setActiveTab('overview');
    setManualInvestigationComplete(false);
    setInvestigationReviewed(false);
    setAcknowledged(false);
    setInvestigation({ loaded: false, loading: false, artifacts: [], graph: null, error: '' });
    setRecoveryChecks({ impact: false, evidence: false, operator: false });
    setVerificationChecks({ device: false, traffic: false });
    setClosureNote('');
  }, [incidentId]);

  useEffect(() => {
    if (!visible || !incidentId || activeTab !== 'investigation' || investigation.loading || investigation.loaded) return;
    let active = true;
    setInvestigation(current => ({ ...current, loading: true, error: '' }));
    Promise.allSettled([
      incidentApi.getForensics(incidentId, { skipLoading: true }),
      incidentApi.getAttackGraph(incidentId, { skipLoading: true }),
    ]).then(([forensicsResult, graphResult]) => {
      if (!active) return;
      setInvestigation({
        loaded: true,
        loading: false,
        artifacts: forensicsResult.status === 'fulfilled' ? normalizeList(forensicsResult.value) : [],
        graph: graphResult.status === 'fulfilled' ? (graphResult.value?.data || graphResult.value) : null,
        error: forensicsResult.status === 'rejected' && graphResult.status === 'rejected'
          ? 'Chưa thể tải bằng chứng điều tra. Bạn vẫn có thể tiếp tục xử lý thủ công.'
          : '',
      });
    });
    return () => { active = false; };
  }, [activeTab, incidentId, investigation.loaded, investigation.loading, visible]);

  const currentPhase = useMemo(() => {
    if (restored) return 4;
    if (isolated && (investigationReviewed || manualInvestigationComplete)) return 3;
    if (isolated) return 2;
    if (incident && (acknowledged || containmentStarted)) return 1;
    return 0;
  }, [acknowledged, containmentStarted, incident, isolated, investigationReviewed, manualInvestigationComplete, restored]);

  const recoveryReady = Object.values(recoveryChecks).every(Boolean);
  const normalizedClosureNote = closureNote.trim();
  const verificationReady = Object.values(verificationChecks).every(Boolean) && normalizedClosureNote.length >= 10;
  const elapsed = Math.max(0, now - new Date(incident?.createdAt || incident?.created_at || now).getTime());
  const graphNodes = investigation.graph?.nodes || investigation.graph?.data?.nodes || [];
  const graphEdges = investigation.graph?.edges || investigation.graph?.data?.edges || [];

  const handleIsolate = () => {
    if (severity === 'CRITICAL' && !window.confirm('Cô lập khẩn cấp sẽ ngắt kết nối mạng của thiết bị. Bạn có chắc muốn tiếp tục?')) return;
    onIsolate?.();
  };

  const handleRestore = () => {
    if (!window.confirm('Bạn đã hoàn tất checklist. Tiếp tục khôi phục kết nối cho thiết bị?')) return;
    onRestore?.();
  };

  const handleCloseIncident = () => {
    onCloseIncident?.({
      device_id: deviceId,
      verification: {
        device_operational: verificationChecks.device,
        traffic_normal: verificationChecks.traffic,
        resolution_documented: normalizedClosureNote.length >= 10,
      },
      note: normalizedClosureNote,
    });
  };

  const downloadArtifact = async artifact => {
    try {
      let url = artifact?.download_url || `/incidents/${incidentId}/pcap`;
      if (/^https?:/i.test(url)) {
        const parsedUrl = new URL(url);
        url = `${parsedUrl.pathname}${parsedUrl.search}`;
      }
      if (url.startsWith('/api/')) url = url.slice(4);
      const blob = await http({ url, method: 'GET', responseType: 'blob', skipLoading: true });
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = artifact?.filename || artifact?.name || `incident-${incidentId}-evidence`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      setInvestigation(current => ({ ...current, error: error?.message || 'Không thể tải bằng chứng.' }));
    }
  };

  if (!visible) return null;

  if (isDocked) {
    return (
      <div className="incident-dock-wrap">
        <button className={`incident-dock severity-${severity.toLowerCase()}`} onClick={() => setIsDocked(false)} aria-expanded="false" aria-label={`Mở trung tâm ứng phó sự cố ${severity} trên ${device?.name || deviceId || 'thiết bị OT'}`}>
          <ShieldAlert size={20} />
          <span><strong>{severity}</strong><small>{device?.name || deviceId || 'Thiết bị OT'}</small></span>
          <em>Bước {currentPhase + 1}/5</em>
          <ChevronRight size={18} />
        </button>
      </div>
    );
  }

  const renderContextAction = () => {
    if (currentPhase === 0) {
      return <button className="response-primary acknowledge" onClick={() => setAcknowledged(true)}><CheckCircle2 size={16}/>Tiếp nhận sự cố</button>;
    }
    if (currentPhase === 1) {
      return <button className="response-primary danger" onClick={handleIsolate} disabled={!deviceId || isolated || containmentPending || Boolean(responseAction)}><LockKeyhole size={16}/>{containmentPending ? 'Đang chờ xác nhận cô lập…' : responseAction === 'isolate' ? 'Đang phát lệnh cô lập…' : 'Cô lập khẩn cấp'}</button>;
    }
    if (currentPhase === 2) {
      if (responseCase?.aiAdvice) {
        return <button className="response-primary ai" onClick={() => setActiveTab('investigation')}><FileSearch size={16}/>Xem chẩn đoán AI</button>;
      }
      return <button className="response-primary ai" onClick={onAiRemediation} disabled={Boolean(responseAction)}><Bot size={16}/>{responseAction === 'ai' ? 'Đang phân tích bằng chứng…' : 'Yêu cầu AI chẩn đoán'}</button>;
    }
    if (currentPhase === 3) {
      return <button className="response-primary restore" onClick={handleRestore} disabled={!recoveryReady || Boolean(responseAction)}><RotateCcw size={16}/>{responseAction === 'restore' ? 'Đang khôi phục…' : 'Khôi phục thiết bị'}</button>;
    }
    return <button className="response-primary close" onClick={handleCloseIncident} disabled={!verificationReady || Boolean(responseAction)}><CheckCircle2 size={16}/>{responseAction === 'close' ? 'Đang đóng sự cố…' : 'Xác minh & Đóng sự cố'}</button>;
  };

  return (
    <div className="response-workspace-wrap">
      <aside className={`response-workspace severity-${severity.toLowerCase()} ${isExpanded ? 'expanded' : ''}`} aria-label="Trung tâm ứng phó sự cố">
        <header className="response-workspace-header">
          <div className="response-title">
            <span><ShieldAlert size={15}/> TRUNG TÂM ỨNG PHÓ SỰ CỐ</span>
            <h2>{incident?.title || 'Sự cố thiết bị OT'}</h2>
            <div><em className={`severity-badge severity-${severity.toLowerCase()}`}>{severity}</em><code>#{String(incidentId || '').slice(-8)}</code><small><Clock3 size={13}/>{Math.floor(elapsed / 60000)}m {Math.floor((elapsed % 60000) / 1000)}s</small></div>
          </div>
          <div className="response-window-actions">
            <button onClick={() => setIsExpanded(value => !value)} aria-label={isExpanded ? 'Thu gọn workspace' : 'Mở rộng workspace'}>{isExpanded ? <Minimize2 size={18}/> : <Maximize2 size={18}/>}</button>
            <button onClick={() => setIsDocked(true)} aria-label="Thu nhỏ thành Incident Dock"><Minimize2 size={18}/></button>
          </div>
        </header>

        <div className="response-phase-strip" aria-label="Tiến trình xử lý sự cố">
          {PHASES.map((phase, index) => <div key={phase.key} className={index < currentPhase ? 'done' : index === currentPhase ? 'current' : ''}><i>{index < currentPhase ? <Check size={12}/> : index + 1}</i><span>{phase.label}</span></div>)}
        </div>

        <div className="response-asset-bar">
          <Server size={18}/><div><strong>{device?.name || deviceId || 'Thiết bị chưa xác định'}</strong><code>{device?.ip_address || device?.ipAddress || 'Không có IP'}</code></div>
          <span className={isolated ? 'asset-isolated' : 'asset-online'}><Wifi size={14}/>{isolated ? 'Đã cô lập' : restored ? 'Đã khôi phục' : deviceStatus}</span>
        </div>

        <nav className="response-tabs" role="tablist" aria-label="Nội dung xử lý sự cố">
          <button role="tab" aria-selected={activeTab === 'overview'} className={activeTab === 'overview' ? 'active' : ''} onClick={() => setActiveTab('overview')}>Tổng quan</button>
          <button role="tab" aria-selected={activeTab === 'investigation'} className={activeTab === 'investigation' ? 'active' : ''} onClick={() => setActiveTab('investigation')}>Điều tra</button>
          <button role="tab" aria-selected={activeTab === 'timeline'} className={activeTab === 'timeline' ? 'active' : ''} onClick={() => setActiveTab('timeline')}>Nhật ký <b>{timeline.length}</b></button>
        </nav>

        <main className="response-workspace-content">
          {activeTab === 'overview' && <>
            <section className="recommended-action">
              <div className="section-heading"><Activity size={18}/><div><h3>Hành động được đề xuất</h3><p>Hệ thống chỉ hiển thị bước cần thực hiện ngay lúc này.</p></div></div>
              {currentPhase === 0 && <div className="recommendation intake"><strong>Xác nhận tiếp nhận sự cố</strong><p>Kiểm tra đúng thiết bị và mức độ ảnh hưởng trước khi bắt đầu thao tác ứng phó.</p></div>}
              {currentPhase === 1 && <div className="recommendation danger"><strong>Khoanh vùng thiết bị ngay</strong><p>Ngắt thiết bị khỏi mạng OT để ngăn lan truyền, sau đó thu thập bằng chứng và xác định nguyên nhân.</p></div>}
              {currentPhase === 2 && <div className="recommendation investigate"><strong>Điều tra nguyên nhân và phạm vi ảnh hưởng</strong><p>AI là công cụ hỗ trợ. Bạn có thể xem bằng chứng và tiếp tục quy trình thủ công nếu AI không khả dụng.</p></div>}
              {currentPhase === 3 && <div className="recommendation recover"><strong>Chuẩn bị khôi phục có kiểm soát</strong><p>Hoàn tất checklist trước khi đưa thiết bị trở lại mạng vận hành.</p></div>}
              {currentPhase === 4 && <div className="recommendation verify"><strong>Xác minh hệ thống đã ổn định</strong><p>Chỉ đóng sự cố sau khi thiết bị, lưu lượng và ghi nhận vận hành đều đạt yêu cầu.</p></div>}
            </section>

            <section className="response-summary-grid">
              <article><small>Mức độ</small><strong>{severity}</strong></article>
              <article><small>Trạng thái incident</small><strong>{incident?.status || 'open'}</strong></article>
              <article><small>Số cảnh báo</small><strong>{incident?.alert_ids?.length || (responseCase?.alert ? 1 : 0)}</strong></article>
              <article><small>Sự kiện timeline</small><strong>{timeline.length}</strong></article>
            </section>

            {currentPhase === 3 && <section className="operator-checklist"><div className="section-heading"><ClipboardCheck size={18}/><div><h3>Checklist trước khôi phục</h3><p>AI không bắt buộc, nhưng người vận hành phải xác nhận ba điều kiện.</p></div></div>
              <label><input type="checkbox" checked={recoveryChecks.impact} onChange={event => setRecoveryChecks(value => ({ ...value, impact: event.target.checked }))}/><span><strong>Đã đánh giá phạm vi ảnh hưởng</strong><small>Không còn dấu hiệu tấn công đang lan rộng.</small></span></label>
              <label><input type="checkbox" checked={recoveryChecks.evidence} onChange={event => setRecoveryChecks(value => ({ ...value, evidence: event.target.checked }))}/><span><strong>Đã xem bằng chứng hoặc kết quả điều tra</strong><small>Đã hiểu nguyên nhân khả nghi và rủi ro còn lại.</small></span></label>
              <label><input type="checkbox" checked={recoveryChecks.operator} onChange={event => setRecoveryChecks(value => ({ ...value, operator: event.target.checked }))}/><span><strong>Người vận hành xác nhận có thể khôi phục</strong><small>Dây chuyền sẵn sàng tiếp nhận thiết bị trở lại.</small></span></label>
            </section>}

            {currentPhase === 4 && <section className="operator-checklist verification"><div className="section-heading"><CheckCircle2 size={18}/><div><h3>Checklist xác minh cuối</h3><p>Hoàn tất trước khi đóng incident.</p></div></div>
              <label><input type="checkbox" checked={verificationChecks.device} onChange={event => setVerificationChecks(value => ({ ...value, device: event.target.checked }))}/><span><strong>Thiết bị hoạt động bình thường</strong><small>Trạng thái kết nối và chức năng vận hành ổn định.</small></span></label>
              <label><input type="checkbox" checked={verificationChecks.traffic} onChange={event => setVerificationChecks(value => ({ ...value, traffic: event.target.checked }))}/><span><strong>Không còn lưu lượng bất thường</strong><small>Không phát sinh alert tương tự sau khôi phục.</small></span></label>
              <div className="closure-note-field"><label htmlFor={`closure-note-${incidentId}`}><strong>Ghi nhận kết quả xử lý</strong><small>Nêu ngắn gọn thao tác đã thực hiện và trạng thái sau khôi phục để phục vụ hậu kiểm.</small></label><textarea id={`closure-note-${incidentId}`} value={closureNote} onChange={event => setClosureNote(event.target.value)} rows={3} minLength={10} maxLength={1000} placeholder="Ví dụ: Đã đối chiếu cấu hình chuẩn; PLC-01 hoạt động ổn định trong 15 phút, không tái phát cảnh báo."/><small className={normalizedClosureNote.length > 0 && normalizedClosureNote.length < 10 ? 'invalid' : ''}>{normalizedClosureNote.length}/10 ký tự tối thiểu</small></div>
            </section>}
          </>}

          {activeTab === 'investigation' && <>
            <section className="ai-diagnosis-card">
              <div className="section-heading"><Bot size={18}/><div><h3>Chẩn đoán AI theo bằng chứng</h3><p>AI phải chỉ ra dữ kiện, nguyên nhân, tác động và hành động cụ thể.</p></div></div>
              {responseCase?.aiAdvice ? <><AiDiagnosisReport report={responseCase.aiAdvice}/><button className="diagnosis-reviewed" onClick={() => setInvestigationReviewed(true)} disabled={investigationReviewed}><CheckCircle2 size={15}/>{investigationReviewed ? 'Đã xác nhận đã đọc' : 'Tôi đã đọc và hiểu chẩn đoán'}</button></> : <div className="investigation-empty"><Bot size={26}/><strong>Chưa có kết quả chẩn đoán</strong><p>Yêu cầu AI phân tích hoặc tiếp tục điều tra thủ công bằng các bằng chứng bên dưới.</p><button onClick={onAiRemediation} disabled={Boolean(responseAction)}><Bot size={15}/>{responseAction === 'ai' ? 'Đang phân tích…' : 'Yêu cầu AI chẩn đoán'}</button></div>}
            </section>
            <section><div className="section-heading"><FileSearch size={18}/><div><h3>Bằng chứng số</h3><p>PCAP, log và dữ liệu phục vụ xác minh nguyên nhân.</p></div></div>
              {investigation.loading ? <div className="response-loading"><RefreshCw size={16}/>Đang tải bằng chứng…</div> : investigation.artifacts.length ? <div className="artifact-list">{investigation.artifacts.map((artifact, index) => <article key={artifact._id || artifact.sha256 || index}><FileSearch size={17}/><div><strong>{artifact.name || artifact.filename || `Bằng chứng ${index + 1}`}</strong><small>{artifact.type || 'ARTIFACT'} · {artifact.size || 'Không rõ dung lượng'}</small></div><button onClick={() => downloadArtifact(artifact)} aria-label="Tải bằng chứng"><Download size={16}/></button></article>)}</div> : <p className="response-muted">Chưa có artifact. Quá trình điều tra thủ công vẫn có thể tiếp tục.</p>}
              {investigation.error && <p className="response-error">{investigation.error}</p>}
            </section>
            <section><div className="section-heading"><Network size={18}/><div><h3>Phạm vi tấn công</h3><p>Tóm tắt quan hệ nguồn, mục tiêu và đường tấn công.</p></div></div><div className="graph-summary"><span><b>{Array.isArray(graphNodes) ? graphNodes.length : 0}</b> thực thể</span><span><b>{Array.isArray(graphEdges) ? graphEdges.length : 0}</b> liên kết</span></div></section>
          </>}

          {activeTab === 'timeline' && <section><div className="section-heading"><Clock3 size={18}/><div><h3>Nhật ký xử lý</h3><p>Dấu vết đầy đủ phục vụ bàn giao và hậu kiểm.</p></div></div>
            <div className="response-timeline">{[...timeline].sort((a, b) => new Date(eventTime(b) || 0) - new Date(eventTime(a) || 0)).map((event, index) => <article key={event._id || index}><i/><div><strong>{event.action_type || 'Sự kiện'}</strong><p>{event.description || 'Không có mô tả'}</p><small>{event.actor || 'system'} · {eventTime(event) ? new Date(eventTime(event)).toLocaleString('vi-VN') : 'Không rõ thời gian'}</small></div></article>)}{!timeline.length && <p className="response-muted">Chưa có sự kiện timeline.</p>}</div>
          </section>}
        </main>

        {(responseLoading || responseAction || activeCommand || commandPollingError) && <div className="response-command-status">
          {responseLoading && <span><RefreshCw size={14}/>Đang đồng bộ incident…</span>}
          {responseAction && <span><Activity size={14}/>Đang thực hiện: {responseAction}</span>}
          {activeCommand && <span>Lệnh {activeCommand.command_id}: <b>{activeCommand.status}</b></span>}
          {commandPollingError && <span className="error">{commandPollingError}</span>}
        </div>}

        <footer className="response-workspace-footer"><div><small>Bước hiện tại</small><strong>{PHASES[currentPhase]?.label}</strong></div>{currentPhase === 2 && <button className="manual-continue" onClick={() => { setManualInvestigationComplete(true); setActiveTab('overview'); }}>Đã điều tra thủ công</button>}{renderContextAction()}</footer>
      </aside>
    </div>
  );
};

export { ResponseWorkspace as SoarResponsePanel };
export default ResponseWorkspace;

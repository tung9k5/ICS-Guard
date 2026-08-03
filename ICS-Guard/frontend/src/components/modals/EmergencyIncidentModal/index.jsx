import React, { useEffect, useMemo, useState } from 'react';
import { Bot, Check, LockKeyhole, Minus, RotateCcw, ShieldAlert, Wifi, X } from 'lucide-react';
import './EmergencyIncidentModal.scss';

const DEFAULT_STEPS = ['Phát hiện', 'Tạo sự cố', 'Cô lập thiết bị', 'AI Diagnosis', 'Khôi phục'];
const normalizeStepStatus = status => {
  const value = String(status || '').toLowerCase();
  if (['done', 'completed', 'succeeded', 'success'].includes(value)) return 'done';
  if (['current', 'active', 'running', 'in_progress', 'pending_action'].includes(value)) return 'current';
  return 'pending';
};
const SoarResponsePanel = ({ visible, onHide, responseCase, responseLoading, responseAction, onIsolate, onAiRemediation, onRestore }) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { if (visible) setIsMinimized(false); }, [responseCase?.incident?._id, responseCase?.incident?.id, visible]);
  useEffect(() => { if (!visible) return undefined; const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, [visible]);
  useEffect(() => {
    if (!visible || isMinimized) { setIsPanelOpen(false); return undefined; }
    const frame = window.requestAnimationFrame(() => setIsPanelOpen(true));
    return () => window.cancelAnimationFrame(frame);
  }, [visible, isMinimized]);
  const incident = responseCase?.incident; const device = responseCase?.device;
  const status = String(device?.security_status || device?.status || '').toLowerCase();
  const isolated = ['isolated', 'quarantined'].includes(status);
  const elapsed = Math.max(0, now - new Date(incident?.createdAt || incident?.created_at || now).getTime());
  const targetDeviceId = responseCase?.deviceId || device?._id || device?.id;
  const handleIsolateClick = () => {
    if (String(incident?.severity).toUpperCase() === 'CRITICAL' && !window.confirm('Cô lập khẩn cấp sẽ ngắt kết nối mạng của thiết bị. Bạn có chắc muốn tiếp tục?')) return;
    onIsolate?.();
  };
  const timeline = useMemo(() => { const supplied = Array.isArray(responseCase?.timeline) ? responseCase.timeline : []; if (supplied.length) return supplied.map((item, index) => ({ label: item.label || item.title || item.action || `Bước ${index + 1}`, timestamp: item.timestamp || item.createdAt || item.created_at, status: item.status ? normalizeStepStatus(item.status) : (index < supplied.length - 1 ? 'done' : 'current') })); const completed = isolated ? (responseCase?.aiAdvice ? 4 : 3) : 2; return DEFAULT_STEPS.map((label, index) => ({ label, status: index < completed ? 'done' : index === completed ? 'current' : 'pending' })); }, [responseCase?.timeline, responseCase?.aiAdvice, isolated]);
  if (!visible) return null;
  if (isMinimized) return <div className="soar-panel-wrapper"><button className={`soar-mini-tab severity-${String(incident?.severity || 'high').toLowerCase()}`} onClick={() => setIsMinimized(false)} aria-label={`Mở bảng xử lý sự cố mức ${incident?.severity || 'HIGH'}`}><ShieldAlert size={17}/><span>{incident?.severity || 'SỰ CỐ'}</span></button></div>;
  return <div className="soar-panel-wrapper"><aside className={`soar-panel ${isPanelOpen ? 'panel-open' : ''}`} aria-label="SOAR Incident Response">
    <header className="soar-panel-header"><div><span>SỰ CỐ KHẨN CẤP</span><h2>{incident?.title || 'Phát hiện tấn công thiết bị OT'}</h2><em className={`severity-${String(incident?.severity || 'HIGH').toLowerCase()}`}>{incident?.severity || 'HIGH'}</em></div><div><button onClick={() => setIsMinimized(true)} aria-label="Thu nhỏ"><Minus size={18}/></button>{onHide && <button onClick={onHide} aria-label="Đóng"><X size={18}/></button>}</div></header>
    <div className="soar-metrics-bar"><span><b>MTTD</b>{Math.floor(elapsed / 60000)}m {Math.floor((elapsed % 60000) / 1000)}s</span><span><b>Thời gian</b>{new Date(now).toLocaleTimeString('vi-VN')}</span><span><b>Events</b>{timeline.length}</span></div>
    <section className="soar-device"><small>TRẠNG THÁI THIẾT BỊ</small><div><div><strong>{device?.name || responseCase?.deviceId || 'Thiết bị OT'}</strong><code>{device?.ip_address || device?.ipAddress || 'Không có IP'}</code></div><em className={isolated ? 'offline' : 'online'}><Wifi size={14}/>{isolated ? 'Đã cô lập' : status || 'Đang kết nối'}</em></div></section>
    <section><h3>SOAR PIPELINE</h3><div className="soar-timeline">{timeline.map((step, index) => <div className={`soar-timeline-step ${step.status}`} key={`${step.label}-${index}`}><i>{step.status === 'done' ? <Check size={13}/> : step.status === 'current' ? '⏳' : '○'}</i><div><strong>{index + 1}. {step.label}</strong>{step.timestamp && <small>{new Date(step.timestamp).toLocaleTimeString('vi-VN')}</small>}</div></div>)}</div></section>
    <section className="soar-ai"><h3><Bot size={17}/> AI DIAGNOSIS</h3><p>{responseCase?.aiAdvice || 'Chưa có chẩn đoán AI. Cô lập thiết bị trước, sau đó yêu cầu AI phân tích bằng chứng và đề xuất khắc phục.'}</p></section>
    {responseLoading && <div className="soar-loading">Đang đồng bộ trạng thái SOAR…</div>}
    <div className="soar-actions"><button className="isolate" onClick={handleIsolateClick} disabled={!targetDeviceId || isolated || Boolean(responseAction)} title="Ngắt kết nối mạng của thiết bị"><LockKeyhole size={15}/>{responseAction === 'isolate' ? 'Đang cô lập…' : 'Cô lập khẩn cấp'}</button><button className="ai" onClick={onAiRemediation} disabled={!isolated || Boolean(responseAction)} title="Phân tích bằng chứng và đề xuất khắc phục"><Bot size={15}/>{responseAction === 'ai' ? 'Đang phân tích…' : 'Phân tích AI'}</button><button className="restore" onClick={onRestore} disabled={!isolated || !responseCase?.aiAdvice || Boolean(responseAction)} title="Khôi phục kết nối sau khi đã có chẩn đoán"><RotateCcw size={15}/>{responseAction === 'restore' ? 'Đang khôi phục…' : 'Khôi phục'}</button></div>
  </aside></div>;
};
export { SoarResponsePanel };
export default SoarResponsePanel;

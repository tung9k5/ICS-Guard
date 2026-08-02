import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldAlert, Info, Tag, Calendar, Target, Activity, Loader2, Bot } from 'lucide-react';
import VDialog from '@/components/VDialog';
import VButton from '@/components/VButton';
import VStatus from '@/components/VStatus';
import { formatDate } from '@/utils/formatDate';
import {
  AI_STATUS,
  INCIDENT_STATUS,
  getIncidentSeverityStyle,
  getIncidentStatusLabel,
  getAiStatusLabel,
  getAiResult
} from '@/constants/incidentConstants';
import SeverityStepper from '@/components/SeverityStepper';
import incidentsApi from '@/api/incidents';

const AiResultCard = ({ aiResult, t }) => {
  if (!aiResult || !aiResult.log_summary) return null;
  return (
    <div style={{ backgroundColor: '#ffffff', borderRadius: '0.75rem', border: '1px solid var(--slate-200)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)', overflow: 'hidden' }}>
      
      {/* Header section */}
      <div style={{ backgroundColor: 'var(--slate-50)', padding: '1rem 1.5rem', borderBottom: '1px solid var(--slate-200)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ backgroundColor: 'var(--indigo-100)', color: 'var(--indigo-600)', padding: '0.5rem', borderRadius: '0.5rem' }}>
             <Bot size={20} />
          </div>
          <div>
            <h4 style={{ margin: 0, color: 'var(--slate-900)', fontSize: '1.05rem', fontWeight: 600 }}>
              {t('customer.incidents.ai.result_title', 'Kết quả Phân tích AI')}
            </h4>
            <div style={{ fontSize: '0.8rem', color: 'var(--slate-600)', marginTop: '0.125rem' }}>Được phân tích tự động bởi hệ thống ICS-Guard AI</div>
          </div>
        </div>
        
        {aiResult.risk_level && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'white', padding: '0.375rem 0.75rem', borderRadius: '2rem', border: '1px solid var(--slate-300)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--slate-700)', fontWeight: 600, textTransform: 'uppercase' }}>
              {t('customer.incidents.ai.risk_level', 'Mức rủi ro')}:
            </span>
            <span style={{ 
              fontWeight: 700, 
              color: aiResult.risk_level.toLowerCase() === 'critical' ? 'var(--red-600)' : 
                     aiResult.risk_level.toLowerCase() === 'high' ? 'var(--orange-600)' : 
                     aiResult.risk_level.toLowerCase() === 'medium' ? 'var(--amber-600)' : 'var(--green-600)' 
            }}>
              {aiResult.risk_level}
            </span>
          </div>
        )}
      </div>

      {/* Content section */}
      <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* Executive Summary */}
        <div>
           <h5 style={{ fontSize: '0.85rem', color: 'var(--slate-700)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
             <Info size={14} /> {t('customer.incidents.ai.log_summary', 'Tóm tắt sự kiện')}
           </h5>
           <div style={{ color: 'var(--slate-900)', fontSize: '0.95rem', lineHeight: '1.6', backgroundColor: 'var(--slate-50)', padding: '1rem', borderRadius: '0.5rem', borderLeft: '3px solid var(--indigo-400)' }}>
             {aiResult.log_summary}
           </div>
        </div>

        {/* Root Cause & Analysis */}
        {aiResult.attack_reasoning && (
          <div>
            <h5 style={{ fontSize: '0.85rem', color: 'var(--slate-700)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <Target size={14} /> {t('customer.incidents.ai.attack_reasoning', 'Phân tích nguyên nhân & Đánh giá')}
            </h5>
            <div style={{ color: 'var(--slate-900)', fontSize: '0.95rem', lineHeight: '1.6' }}>
              {aiResult.attack_reasoning}
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
           {/* Remediation Steps */}
           {aiResult.remediation_advice?.length > 0 && (
             <div>
               <h5 style={{ fontSize: '0.85rem', color: 'var(--slate-700)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.75rem 0', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                 <ShieldAlert size={14} /> {t('customer.incidents.ai.remediation_advice', 'Khuyến nghị xử lý')}
               </h5>
               <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                 {aiResult.remediation_advice.map((r, i) => (
                   <div key={i} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', padding: '0.75rem', backgroundColor: 'white', border: '1px solid var(--slate-300)', borderRadius: '0.5rem', transition: 'all 0.2s' }}>
                     <div style={{ backgroundColor: 'var(--indigo-50)', color: 'var(--indigo-700)', borderRadius: '0.375rem', width: '1.75rem', height: '1.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: '0.85rem', flexShrink: 0 }}>
                       {i + 1}
                     </div>
                     <div style={{ marginTop: '0.125rem' }}>
                       <div style={{ color: 'var(--slate-900)', fontSize: '0.9rem', fontWeight: 500, lineHeight: '1.5' }}>
                         {r.step}
                       </div>
                       {r.priority && (
                         <div style={{ fontSize: '0.75rem', color: 'var(--slate-700)', marginTop: '0.25rem', display: 'inline-flex', padding: '0.125rem 0.5rem', backgroundColor: 'var(--slate-100)', borderRadius: '1rem', fontWeight: 500 }}>
                           Ưu tiên: {r.priority}
                         </div>
                       )}
                     </div>
                   </div>
                 ))}
               </div>
             </div>
           )}

           {/* MITRE ATT&CK */}
           {aiResult.mitre_attack_mappings?.length > 0 && (
             <div>
               <h5 style={{ fontSize: '0.85rem', color: 'var(--slate-700)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.75rem 0', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                 <Tag size={14} /> {t('customer.incidents.ai.mitre_attack', 'Phân loại MITRE ATT&CK')}
               </h5>
               <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                 {aiResult.mitre_attack_mappings.map((m, i) => (
                   <div key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.375rem 0.75rem', backgroundColor: 'var(--slate-100)', border: '1px solid var(--slate-300)', borderRadius: '0.375rem', fontSize: '0.8rem' }}>
                     <span style={{ color: 'var(--slate-900)', fontWeight: 600 }}>{m.tactic}</span>
                     <span style={{ color: 'var(--slate-500)' }}>/</span>
                     <span style={{ color: 'var(--slate-800)' }}>{m.technique_name}</span>
                     {m.technique_id && <span style={{ color: 'var(--slate-500)', fontSize: '0.75rem' }}>({m.technique_id})</span>}
                   </div>
                 ))}
               </div>
             </div>
           )}
        </div>
      </div>
    </div>
  );
};

const IncidentDetailModal = ({ incident: incidentData, onClose, onRefresh }) => {
  const { t } = useTranslation();

  const [aiStatus, setAiStatus] = useState(AI_STATUS.IDLE);
  const [liveAiResult, setLiveAiResult] = useState(null);
  const pollingInterval = useRef(null);

  // the endpoint returns either incident object or { incident, timeline, deviceAlertHistory, history }
  const incident = incidentData?.incident || incidentData;
  const timeline = incidentData?.timeline || [];
  const deviceAlertHistory = incidentData?.deviceAlertHistory || [];
  const history = incidentData?.history || [];

  useEffect(() => {
    if (!incident) return;
    const status = incident.ai_status || AI_STATUS.IDLE;
    setAiStatus(status);
    setLiveAiResult(getAiResult(incident));
  }, [incident?._id, incident?.ai_status, incident?.ai_result]);

  useEffect(() => {
    // If we're not waiting for an ongoing analysis, stop polling.
    // Customers can't trigger AI Analysis, they only watch it.
    if (aiStatus !== AI_STATUS.PROCESSING || !incident?._id) {
      if (pollingInterval.current) clearInterval(pollingInterval.current);
      return;
    }

    pollingInterval.current = setInterval(async () => {
      try {
        const res = await incidentsApi.getAiAnalysisStatus(incident._id || incident.id, { hideLoading: true });
        const currentStatus = res.data?.data?.ai_status || res.data?.ai_status;

        if (currentStatus === AI_STATUS.COMPLETED || currentStatus === AI_STATUS.FAILED) {
          clearInterval(pollingInterval.current);
          setAiStatus(currentStatus);
          if (onRefresh) onRefresh(incident._id || incident.id);
        }
      } catch (error) {
        console.error('[IncidentDetailModal] Polling AI status failed:', error);
      }
    }, 3000);

    return () => {
      if (pollingInterval.current) clearInterval(pollingInterval.current);
    };
  }, [aiStatus, incident?._id, onRefresh]);

  if (!incidentData) return null;

  const header = (
    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <ShieldAlert size={20} className="text-danger" />
      {t('customer.incidents.detail.title', 'Chi tiết sự cố')}
    </span>
  );

  const footer = (
    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', width: '100%' }}>
      <VButton variant="outline" onClick={onClose}>
        {t('customer.incidents.detail.close_btn', 'Đóng')}
      </VButton>
    </div>
  );

  return (
    <VDialog
      visible={!!incident}
      onHide={onClose}
      header={header}
      footer={footer}
      style={{ width: '680px', maxWidth: '100%' }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* Severity Stepper */}
        <SeverityStepper severity={incident.severity} t={t} />

        {/* Basic Info Card */}
        <div style={{ backgroundColor: 'var(--slate-50)', padding: '1.25rem', borderRadius: '0.5rem', border: '1px solid var(--slate-200)' }}>
          <h4 style={{ margin: '0 0 1rem 0', color: 'var(--slate-800)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem' }}>
            <Info size={18} className="text-primary" />
            {t('customer.incidents.detail.basic_info', 'Thông tin cơ bản')}
          </h4>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)', fontWeight: 600, marginBottom: '0.25rem' }}>ID</div>
              <div style={{ color: 'var(--slate-800)', fontWeight: 500, fontFamily: 'monospace' }}>{incident.incident_code || incident._id}</div>
            </div>

            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)', fontWeight: 600, marginBottom: '0.25rem' }}>{t('customer.incidents.col_time', 'Thời gian phát hiện')}</div>
              <div style={{ color: 'var(--slate-800)', display: 'flex', alignItems: 'center', gap: '0.375rem', fontWeight: 500 }}>
                <Calendar size={14} className="text-slate-500" />
                {incident.createdAt ? formatDate(incident.createdAt) : '—'}
              </div>
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)', fontWeight: 600, marginBottom: '0.25rem' }}>{t('customer.incidents.col_title', 'Tiêu đề sự cố')}</div>
              <div style={{ color: 'var(--slate-800)', fontWeight: 600 }}>{incident.title}</div>
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)', fontWeight: 600, marginBottom: '0.25rem' }}>{t('customer.incidents.detail.description', 'Mô tả chi tiết')}</div>
              <div style={{ color: 'var(--slate-700)', backgroundColor: 'white', padding: '1rem', borderRadius: '0.375rem', border: '1px solid var(--slate-200)', lineHeight: '1.6' }}>
                {incident.description || '—'}
              </div>
            </div>
          </div>
        </div>

        {/* Classification and Impact */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div style={{ backgroundColor: 'var(--slate-50)', padding: '1.25rem', borderRadius: '0.5rem', border: '1px solid var(--slate-200)' }}>
            <h4 style={{ margin: '0 0 1rem 0', color: 'var(--slate-800)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem' }}>
              <Tag size={18} className="text-primary" />
              {t('customer.incidents.detail.classification', 'Phân loại')}
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)', fontWeight: 600, marginBottom: '0.375rem' }}>{t('customer.incidents.col_severity', 'Mức độ ảnh hưởng')}</div>
                <VStatus
                  label={t(`severity.${incident.severity?.toLowerCase()}`, incident.severity)}
                  style={getIncidentSeverityStyle(incident.severity)}
                  className="uppercase badge-outline"
                />
              </div>

              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)', fontWeight: 600, marginBottom: '0.375rem' }}>{t('customer.incidents.col_status', 'Trạng thái xử lý')}</div>
                <VStatus
                  label={getIncidentStatusLabel(incident.status, t)}
                  status={incident.status === INCIDENT_STATUS.OPEN ? 'inactive' : incident.status === INCIDENT_STATUS.CLOSED ? 'active' : 'default'}
                />
              </div>

              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)', fontWeight: 600, marginBottom: '0.375rem' }}>AI</div>
                <span style={{
                  fontSize: '0.8rem',
                  padding: '0.25rem 0.625rem',
                  borderRadius: '999px',
                  fontWeight: 600,
                  background: aiStatus === AI_STATUS.COMPLETED ? 'var(--green-100)' : aiStatus === AI_STATUS.PROCESSING ? 'var(--blue-50)' : aiStatus === AI_STATUS.FAILED ? 'var(--red-100)' : 'var(--slate-100)',
                  color: aiStatus === AI_STATUS.COMPLETED ? 'var(--green-700)' : aiStatus === AI_STATUS.PROCESSING ? 'var(--blue-600)' : aiStatus === AI_STATUS.FAILED ? 'var(--red-700)' : 'var(--slate-500)',
                }}>
                  {getAiStatusLabel(aiStatus, t)}
                </span>
              </div>
            </div>
          </div>

          <div style={{ backgroundColor: 'var(--slate-50)', padding: '1.25rem', borderRadius: '0.5rem', border: '1px solid var(--slate-200)' }}>
            <h4 style={{ margin: '0 0 1rem 0', color: 'var(--slate-800)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem' }}>
              <Target size={18} className="text-primary" />
              {t('customer.incidents.detail.related_info', 'Thông liên quan')}
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)', fontWeight: 600, marginBottom: '0.375rem' }}>{t('customer.incidents.detail.alerts_count', 'Số cảnh báo liên kết')}</div>
                <div style={{ color: 'var(--slate-800)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <Activity size={16} className="text-warning" />
                  {incident.alert_ids?.length || 0} {t('customer.incidents.detail.alerts', 'cảnh báo')}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Device Alert History */}
        {deviceAlertHistory.length > 0 && (
          <div style={{ backgroundColor: 'var(--slate-50)', padding: '1.25rem', borderRadius: '0.5rem', border: '1px solid var(--slate-200)' }}>
            <h4 style={{ margin: '0 0 1rem 0', color: 'var(--slate-800)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem' }}>
              <Activity size={18} className="text-primary" />
              {t('customer.incidents.detail.device_alert_history', 'Lịch sử Cảnh báo Thiết bị')}
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {deviceAlertHistory.map(alert => (
                <div key={alert._id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', backgroundColor: 'white', border: '1px solid var(--slate-200)', borderRadius: '0.375rem' }}>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--slate-800)' }}>{alert.title}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)' }}>{alert.rule_name} • {alert.device_id}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <VStatus label={alert.severity} style={getIncidentSeverityStyle(alert.severity)} className="badge-outline" />
                    <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)', marginTop: '0.25rem' }}>{formatDate(alert.detected_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI Result Block */}
        {aiStatus === AI_STATUS.COMPLETED && liveAiResult ? (
          <AiResultCard aiResult={liveAiResult} t={t} />
        ) : aiStatus === AI_STATUS.PROCESSING ? (
          <div style={{ backgroundColor: 'var(--slate-50)', padding: '1.25rem', borderRadius: '0.5rem', border: '1px solid #bee3f8', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Loader2 size={24} className="text-primary animate-spin" />
            <div>
              <div style={{ fontWeight: 600, color: 'var(--slate-800)' }}>{t('customer.incidents.ai.status_processing', 'Đang phân tích AI...')}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--slate-500)' }}>{t('customer.incidents.ai.analyzing_msg', 'Kết quả sẽ hiển thị ngay khi AI hoàn thành.')}</div>
            </div>
          </div>
        ) : aiStatus === AI_STATUS.FAILED ? (
          <div style={{ backgroundColor: 'var(--red-50)', padding: '1.25rem', borderRadius: '0.5rem', border: '1px solid var(--red-200)' }}>
            <div style={{ fontWeight: 600, color: 'var(--red-700)' }}>❌ {t('customer.incidents.ai.status_failed', 'Lỗi phân tích AI')}</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--red-500)', marginTop: '0.25rem' }}>{t('customer.incidents.ai.failed_msg', 'Phân tích AI thất bại. Vui lòng thử lại sau.')}</div>
          </div>
        ) : null}

        {/* Timeline */}
        {timeline.length > 0 && (
          <div style={{ backgroundColor: 'var(--slate-50)', padding: '1.25rem', borderRadius: '0.5rem', border: '1px solid var(--slate-200)' }}>
            <h4 style={{ margin: '0 0 1rem 0', color: 'var(--slate-800)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem' }}>
              <Target size={18} className="text-primary" />
              {t('customer.incidents.detail.timeline', 'Tiến trình xử lý')}
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {timeline.map((event, index) => (
                <div key={event._id || index} style={{ padding: '1rem', backgroundColor: 'white', border: '1px solid var(--slate-200)', borderRadius: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontWeight: 600, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      {event.action_type === 'ai_analysis' ? '🤖 AI Security Assistant' : event.actor}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>{formatDate(event.createdAt)}</span>
                  </div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--slate-700)', lineHeight: '1.6', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {event.description}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Simulation History */}
        {history.length > 1 && (
          <div style={{ backgroundColor: 'var(--slate-50)', padding: '1.25rem', borderRadius: '0.5rem', border: '1px solid var(--slate-200)' }}>
            <h4 style={{ margin: '0 0 1rem 0', color: 'var(--slate-800)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem' }}>
              <Activity size={18} className="text-primary" />
              {t('customer.incidents.detail.simulation_history', 'Lịch sử mô phỏng')}
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {history.map((h, index) => {
                if (h._id === incident._id) return null;
                const hResult = getAiResult(h);
                return (
                  <div key={h._id || index} style={{ padding: '0.875rem', backgroundColor: 'white', border: '1px solid var(--slate-200)', borderRadius: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ fontWeight: 600, color: 'var(--slate-700)' }}>
                        {t('customer.incidents.detail.simulation_history', 'Mô phỏng')} #{history.length - index}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>{formatDate(h.createdAt)}</span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--slate-600)' }}>
                      AI: <span style={{ fontWeight: 600 }}>{getAiStatusLabel(h.ai_status, t)}</span>
                    </div>
                    {hResult?.log_summary && (
                      <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--slate-600)', borderTop: '1px dashed var(--slate-200)', paddingTop: '0.5rem' }}>
                        {hResult.log_summary}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </VDialog>
  );
};

export default IncidentDetailModal;

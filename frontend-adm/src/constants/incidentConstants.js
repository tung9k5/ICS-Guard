import { SEVERITY, STATUS } from './statusConstants';

export const INCIDENT_SEVERITY = SEVERITY;

export const INCIDENT_STATUS = STATUS;

export const AI_STATUS = {
  IDLE: 'idle',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

export const getAiStatusLabel = (status, t) => {
  switch (status) {
    case AI_STATUS.IDLE: return t('incidents.ai.status_idle', 'Chưa phân tích');
    case AI_STATUS.PROCESSING: return t('incidents.ai.status_processing', 'Đang phân tích');
    case AI_STATUS.COMPLETED: return t('incidents.ai.status_completed', 'Đã phân tích');
    case AI_STATUS.FAILED: return t('incidents.ai.status_failed', 'Phân tích lỗi');
    default: return t('incidents.ai.status_unknown', 'Không rõ');
  }
};

/**
 * Get AI result from incident (handles both old and new schema formats)
 */
export const getAiResult = (incident) => {
  if (!incident?.ai_result) return null;
  const r = incident.ai_result;
  return {
    log_summary: r.log_summary || r.summary || null,
    attack_reasoning: r.attack_reasoning || r.mitigation || null,
    risk_level: r.risk_level || null,
    remediation_advice: Array.isArray(r.remediation_advice) ? r.remediation_advice : [],
    mitre_attack_mappings: Array.isArray(r.mitre_attack_mappings) ? r.mitre_attack_mappings : [],
    analysis_process: Array.isArray(r.analysis_process) ? r.analysis_process : [],
    model_used: r.model_used || null,
    error: r.error || null
  };
};

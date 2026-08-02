import i18n from '@/i18n/config';

export const INCIDENT_SEVERITY = {
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
  INFO: 'INFO'
};

export const INCIDENT_STATUS = {
  OPEN: 'open',
  INVESTIGATING: 'investigating',
  INVESTIGATED: 'investigated',
  REMEDIATED: 'remediated',
  CLOSED: 'closed'
};

export const AI_STATUS = {
  IDLE: 'idle',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

export const getIncidentSeverityStyle = (severity) => {
  switch (severity) {
    case INCIDENT_SEVERITY.CRITICAL: 
      return { backgroundColor: 'var(--red-100)', color: 'var(--red-700)', borderColor: 'var(--red-300)' };
    case INCIDENT_SEVERITY.HIGH: 
      return { backgroundColor: 'var(--orange-100)', color: 'var(--orange-700)', borderColor: 'var(--orange-300)' };
    case INCIDENT_SEVERITY.MEDIUM: 
      return { backgroundColor: 'var(--amber-100)', color: 'var(--amber-700)', borderColor: 'var(--amber-300)' };
    case INCIDENT_SEVERITY.LOW: 
      return { backgroundColor: 'var(--green-100)', color: 'var(--green-700)', borderColor: 'var(--green-300)' };
    case INCIDENT_SEVERITY.INFO:
      return { backgroundColor: 'var(--blue-50)', color: 'var(--blue-600)', borderColor: 'var(--blue-300)' };
    default: 
      return {};
  }
};

export const getIncidentStatusLabel = (status, t) => {
  const translationFn = t || i18n.t;
  switch (status) {
    case INCIDENT_STATUS.OPEN: 
      return translationFn('incidents.list.status_open', 'Mở');
    case INCIDENT_STATUS.INVESTIGATING: 
      return translationFn('incidents.list.status_investigating', 'Đang điều tra');
    case INCIDENT_STATUS.INVESTIGATED: 
      return translationFn('incidents.list.status_investigated', 'Đã điều tra');
    case INCIDENT_STATUS.REMEDIATED: 
      return translationFn('incidents.list.status_remediated', 'Đã xử lý');
    case INCIDENT_STATUS.CLOSED: 
      return translationFn('incidents.list.status_closed', 'Đóng');
    default: 
      return status;
  }
};

export const getAiStatusLabel = (aiStatus, t) => {
  const translationFn = t || i18n.t;
  switch (aiStatus) {
    case AI_STATUS.PROCESSING:
      return translationFn('incidents.ai.status_processing', 'Đang phân tích...');
    case AI_STATUS.COMPLETED:
      return translationFn('incidents.ai.status_completed', 'Đã phân tích');
    case AI_STATUS.FAILED:
      return translationFn('incidents.ai.status_failed', 'Lỗi phân tích');
    case AI_STATUS.IDLE:
    default:
      return translationFn('incidents.ai.status_idle', 'Chưa phân tích');
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

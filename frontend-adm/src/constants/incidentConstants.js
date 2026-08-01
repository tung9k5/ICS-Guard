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
      return translationFn('incidents.list.status_remediated', 'Đã xử lý (Remediated)');
    case INCIDENT_STATUS.CLOSED: 
      return translationFn('incidents.list.status_closed', 'Đóng');
    default: 
      return status;
  }
};

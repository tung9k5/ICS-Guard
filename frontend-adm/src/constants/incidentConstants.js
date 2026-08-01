import i18n from '@/i18n/config';

export const INCIDENT_SEVERITY = {
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW'
};

export const INCIDENT_STATUS = {
  OPEN: 'open',
  INVESTIGATING: 'investigating',
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
    default: 
      return {};
  }
};

export const getIncidentStatusLabel = (status, t) => {
  const translationFn = t || i18n.t;
  switch (status) {
    case INCIDENT_STATUS.OPEN: 
      return translationFn('incidents.list.status_open');
    case INCIDENT_STATUS.INVESTIGATING: 
      return translationFn('incidents.list.status_investigating');
    case INCIDENT_STATUS.REMEDIATED: 
      return translationFn('incidents.list.status_remediated');
    case INCIDENT_STATUS.CLOSED: 
      return translationFn('incidents.list.status_closed');
    default: 
      return status;
  }
};

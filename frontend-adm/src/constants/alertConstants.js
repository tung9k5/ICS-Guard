import { SEVERITY, STATUS } from './statusConstants';

export const ALERT_SEVERITIES = [
  { value: SEVERITY.INFO },
  { value: SEVERITY.LOW },
  { value: SEVERITY.MEDIUM },
  { value: SEVERITY.HIGH },
  { value: SEVERITY.CRITICAL }
];

export const ALERT_STATUSES = [
  { value: STATUS.NEW },
  { value: STATUS.ACKNOWLEDGED },
  { value: STATUS.RESOLVED },
  { value: STATUS.FALSE_POSITIVE }
];

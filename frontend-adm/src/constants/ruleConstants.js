import { SEVERITY, STATUS } from './statusConstants';

export const RULE_SEVERITIES = [
  { value: SEVERITY.INFO },
  { value: SEVERITY.LOW },
  { value: SEVERITY.MEDIUM },
  { value: SEVERITY.HIGH },
  { value: SEVERITY.CRITICAL }
];

export const RULE_STATUSES = [
  { value: STATUS.ACTIVE },
  { value: STATUS.INACTIVE }
];

import { STATUS, SEVERITY, DEVICE_TYPE, ROLE } from '@/constants/statusConstants';

// Default config
const DEFAULT_CONFIG = {
  label: 'status.unknown',
  color: 'var(--slate-500)',
  icon: 'HelpCircle',
  background: 'var(--slate-100)',
  textColor: 'var(--slate-700)',
  variant: 'neutral'
};

/**
 * Get config for general Status
 */
export const getStatusConfig = (status) => {
  const normalized = status?.toLowerCase();
  switch (normalized) {
    case STATUS.ACTIVE:
    case STATUS.ONLINE:
      return {
        label: `status.${normalized}`,
        color: 'var(--green-500)',
        icon: 'CheckCircle',
        background: 'var(--green-50)',
        textColor: 'var(--green-700)',
        variant: 'success'
      };
    case STATUS.INACTIVE:
    case STATUS.OFFLINE:
      return {
        label: `status.${normalized}`,
        color: 'var(--slate-500)',
        icon: 'MinusCircle',
        background: 'var(--slate-100)',
        textColor: 'var(--slate-700)',
        variant: 'neutral'
      };
    case STATUS.SUCCESS:
    case STATUS.RESOLVED:
    case STATUS.COMPLETED:
    case STATUS.REMEDIATED:
      return {
        label: `status.${normalized}`,
        color: 'var(--green-500)',
        icon: 'CheckCircle',
        background: 'var(--green-50)',
        textColor: 'var(--green-700)',
        variant: 'success'
      };
    case STATUS.ERROR:
    case STATUS.FAILED:
    case STATUS.BLOCKED:
      return {
        label: `status.${normalized}`,
        color: 'var(--red-500)',
        icon: 'XCircle',
        background: 'var(--red-50)',
        textColor: 'var(--red-700)',
        variant: 'danger'
      };
    case STATUS.PENDING:
    case STATUS.WARNING:
    case STATUS.INVESTIGATING:
    case STATUS.PROCESSING:
    case STATUS.ACKNOWLEDGED:
      return {
        label: `status.${normalized}`,
        color: 'var(--orange-500)',
        icon: 'AlertCircle',
        background: 'var(--orange-50)',
        textColor: 'var(--orange-700)',
        variant: 'warning'
      };
    case STATUS.NEW:
    case STATUS.OPEN:
      return {
        label: `status.${normalized}`,
        color: 'var(--red-500)',
        icon: 'AlertOctagon',
        background: 'var(--red-50)',
        textColor: 'var(--red-700)',
        variant: 'danger'
      };
    case STATUS.CLOSED:
    case STATUS.INVESTIGATED:
    case STATUS.FALSE_POSITIVE:
    case STATUS.IDLE:
      return {
        label: `status.${normalized}`,
        color: 'var(--slate-500)',
        icon: 'Info',
        background: 'var(--slate-100)',
        textColor: 'var(--slate-700)',
        variant: 'neutral'
      };
    default:
      if (status) {
        return {
          ...DEFAULT_CONFIG,
          labelFallback: status // In case we want to show original string if key not found
        };
      }
      return DEFAULT_CONFIG;
  }
};

/**
 * Get config for Severity
 */
export const getSeverityConfig = (severity) => {
  const normalized = severity?.toLowerCase();
  switch (normalized) {
    case SEVERITY.CRITICAL:
      return {
        label: `severity.${normalized}`,
        color: 'var(--red-500)',
        icon: 'AlertTriangle',
        background: 'var(--red-50)',
        textColor: 'var(--red-700)',
        variant: 'danger'
      };
    case SEVERITY.HIGH:
      return {
        label: `severity.${normalized}`,
        color: 'var(--orange-500)',
        icon: 'AlertCircle',
        background: 'var(--orange-50)',
        textColor: 'var(--orange-700)',
        variant: 'warning'
      };
    case SEVERITY.MEDIUM:
      return {
        label: `severity.${normalized}`,
        color: 'var(--yellow-500)',
        icon: 'AlertCircle',
        background: 'var(--yellow-50)',
        textColor: 'var(--yellow-700)',
        variant: 'warning'
      };
    case SEVERITY.LOW:
      return {
        label: `severity.${normalized}`,
        color: 'var(--green-500)',
        icon: 'Info',
        background: 'var(--green-50)',
        textColor: 'var(--green-700)',
        variant: 'success'
      };
    case SEVERITY.INFO:
      return {
        label: `severity.${normalized}`,
        color: 'var(--blue-500)',
        icon: 'Info',
        background: 'var(--blue-50)',
        textColor: 'var(--blue-700)',
        variant: 'info' // custom variant, but UI handles based on colors mostly
      };
    default:
      if (severity) {
        return { ...DEFAULT_CONFIG, labelFallback: severity };
      }
      return DEFAULT_CONFIG;
  }
};

/**
 * Get config for Priority
 */
export const getPriorityConfig = (priority) => {
  const normalized = priority?.toLowerCase();
  switch (normalized) {
    case 'p1':
    case 'high':
      return {
        label: `priority.${normalized}`,
        color: 'var(--red-500)',
        icon: 'ArrowUpCircle',
        background: 'var(--red-50)',
        textColor: 'var(--red-700)',
        variant: 'danger'
      };
    case 'p2':
    case 'medium':
      return {
        label: `priority.${normalized}`,
        color: 'var(--orange-500)',
        icon: 'MinusCircle',
        background: 'var(--orange-50)',
        textColor: 'var(--orange-700)',
        variant: 'warning'
      };
    case 'p3':
    case 'low':
      return {
        label: `priority.${normalized}`,
        color: 'var(--green-500)',
        icon: 'ArrowDownCircle',
        background: 'var(--green-50)',
        textColor: 'var(--green-700)',
        variant: 'success'
      };
    default:
      if (priority) {
        return { ...DEFAULT_CONFIG, labelFallback: priority };
      }
      return DEFAULT_CONFIG;
  }
};

/**
 * Get config for Device Type
 */
export const getDeviceTypeConfig = (type) => {
  const normalized = type?.toUpperCase();
  switch (normalized) {
    case DEVICE_TYPE.PLC:
      return { label: `device_type.${normalized}`, color: 'var(--custom-color-6)', background: 'rgba(9, 159, 229, 0.15)', textColor: 'var(--custom-color-6)', variant: 'primary', icon: 'Cpu' };
    case DEVICE_TYPE.SENSOR:
      return { label: `device_type.${normalized}`, color: 'var(--custom-color-7)', background: 'rgba(28, 176, 246, 0.15)', textColor: 'var(--custom-color-7)', variant: 'primary', icon: 'Activity' };
    case DEVICE_TYPE.ACTUATOR:
      return { label: `device_type.${normalized}`, color: 'var(--custom-color-8)', background: 'rgba(56, 189, 248, 0.15)', textColor: 'var(--custom-color-8)', variant: 'primary', icon: 'Settings' };
    case DEVICE_TYPE.GATEWAY:
      return { label: `device_type.${normalized}`, color: 'var(--custom-color-9)', background: 'rgba(14, 165, 233, 0.15)', textColor: 'var(--custom-color-9)', variant: 'primary', icon: 'Server' };
    case DEVICE_TYPE.HMI:
      return { label: `device_type.${normalized}`, color: 'var(--custom-color-10)', background: 'rgba(2, 132, 199, 0.15)', textColor: 'var(--custom-color-10)', variant: 'primary', icon: 'Monitor' };
    case DEVICE_TYPE.CAMERA:
      return { label: `device_type.${normalized}`, color: 'var(--custom-color-11)', background: 'rgba(6, 182, 212, 0.15)', textColor: 'var(--custom-color-11)', variant: 'primary', icon: 'Camera' };
    case DEVICE_TYPE.CONTROLLER:
      return { label: `device_type.${normalized}`, color: 'var(--custom-color-12)', background: 'rgba(3, 105, 161, 0.15)', textColor: 'var(--custom-color-12)', variant: 'primary', icon: 'Cpu' };
    case DEVICE_TYPE.OTHER:
    default:
      if (type) {
        return { label: `device_type.${normalized || 'OTHER'}`, color: 'var(--custom-color-13)', background: 'rgba(125, 211, 252, 0.15)', textColor: 'var(--custom-color-13)', variant: 'primary', icon: 'Box', labelFallback: type };
      }
      return { ...DEFAULT_CONFIG, label: 'device_type.OTHER', icon: 'Box' };
  }
};

/**
 * Get config for Role
 */
export const getRoleConfig = (role) => {
  const normalized = role?.toLowerCase();
  switch (normalized) {
    case ROLE.ADMIN:
      return { label: `role.${normalized}`, color: 'var(--purple-500)', background: 'var(--purple-50)', textColor: 'var(--purple-700)', variant: 'danger', icon: 'Shield' };
    case ROLE.MANAGER:
      return { label: `role.${normalized}`, color: 'var(--blue-500)', background: 'var(--blue-50)', textColor: 'var(--blue-700)', variant: 'primary', icon: 'Users' };
    case ROLE.ANALYST:
      return { label: `role.${normalized}`, color: 'var(--green-500)', background: 'var(--green-50)', textColor: 'var(--green-700)', variant: 'success', icon: 'Activity' };
    case ROLE.VIEWER:
      return { label: `role.${normalized}`, color: 'var(--slate-500)', background: 'var(--slate-50)', textColor: 'var(--slate-700)', variant: 'neutral', icon: 'Eye' };
    default:
      if (role) {
        return { ...DEFAULT_CONFIG, labelFallback: role };
      }
      return DEFAULT_CONFIG;
  }
};

/**
 * Get config for Scenario (Simulator)
 */
export const getScenarioConfig = (scenario) => {
  const normalized = scenario?.toUpperCase();
  if (!scenario || normalized === 'NORMAL') {
    return { label: 'simulator.scenario_normal', color: 'var(--green-500)', background: 'var(--green-50)', textColor: 'var(--green-700)', variant: 'success', icon: 'CheckCircle' };
  }
  
  let labelKey = '';
  switch(normalized) {
    case 'FIRE': labelKey = 'simulator.scenario_fire'; break;
    case 'FLOOD': labelKey = 'simulator.scenario_flood'; break;
    case 'TRAFFIC_SPIKE': labelKey = 'simulator.scenario_traffic_spike'; break;
    case 'OVERHEAT': labelKey = 'simulator.scenario_overheat'; break;
    case 'OFFLINE': labelKey = 'simulator.scenario_offline'; break;
    default: labelKey = 'simulator.scenario_abnormal'; break;
  }
  
  return { 
    label: labelKey, 
    color: 'var(--orange-500)', 
    background: 'var(--orange-50)', 
    textColor: 'var(--orange-700)', 
    variant: 'warning', 
    icon: 'AlertTriangle' 
  };
};

/**
 * Fallback config generic generator
 */
export const getGenericConfig = (value, prefix = 'common') => {
  if (!value) return DEFAULT_CONFIG;
  const normalized = value.toLowerCase();
  return {
    ...DEFAULT_CONFIG,
    label: `${prefix}.${normalized}`,
    labelFallback: value
  };
};

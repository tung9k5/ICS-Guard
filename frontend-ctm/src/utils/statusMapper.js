export const getSeverityColor = (severity) => {
  const normalized = severity?.toLowerCase();
  switch (normalized) {
    case 'critical': return 'var(--red-500)';
    case 'high': return 'var(--orange-500)';
    case 'medium': return 'var(--yellow-500)';
    case 'low': return 'var(--green-500)';
    case 'info': return 'var(--blue-500)';
    default: return 'var(--slate-500)';
  }
};

export const getSeverityProps = (severity, t) => {
  const normalized = severity?.toLowerCase();
  switch (normalized) {
    case 'critical':
      return { label: t('customer.severity.critical', 'Nghiêm trọng'), status: 'danger' };
    case 'high':
      return { 
        label: t('customer.severity.high', 'Cao'), 
        style: { backgroundColor: '#fff7ed', color: 'var(--orange-500)', borderColor: 'var(--orange-500)' } 
      };
    case 'medium':
      return { label: t('customer.severity.medium', 'Trung bình'), status: 'warning' };
    case 'low':
      return { label: t('customer.severity.low', 'Thấp'), status: 'success' };
    case 'info':
      return { 
        label: t('customer.severity.info', 'Thông tin'), 
        style: { backgroundColor: 'var(--blue-50)', color: 'var(--blue-600)', borderColor: 'var(--blue-300)' } 
      };
    default:
      return { label: severity || 'N/A', status: 'neutral' };
  }
};

export const getAlertStatusProps = (status, t) => {
  const normalized = status?.toLowerCase();
  switch (normalized) {
    case 'new':
      return { label: t('customer.status.new', 'Mới'), status: 'danger' };
    case 'acknowledged':
      return { 
        label: t('customer.status.acknowledged', 'Đã tiếp nhận'), 
        style: { backgroundColor: '#fff7ed', color: 'var(--orange-500)', borderColor: 'var(--orange-500)' } 
      };
    case 'resolved':
      return { label: t('customer.status.resolved', 'Đã giải quyết'), status: 'success' };
    case 'false_positive':
      return { label: t('customer.status.false_positive', 'Báo động giả'), status: 'neutral' };
    default:
      return { label: status || 'N/A', status: 'neutral' };
  }
};

export const getIncidentStatusProps = (status, t) => {
  const normalized = status?.toLowerCase();
  switch (normalized) {
    case 'open':
      return { label: t('customer.status.open', 'Mở'), status: 'danger' };
    case 'investigating':
      return { 
        label: t('customer.status.investigating', 'Đang điều tra'), 
        style: { backgroundColor: '#fff7ed', color: 'var(--orange-500)', borderColor: 'var(--orange-500)' } 
      };
    case 'remediated':
    case 'resolved':
      return { label: t('customer.status.resolved', 'Đã giải quyết'), status: 'success' };
    case 'closed':
      return { label: t('customer.status.closed', 'Đóng'), status: 'neutral' };
    default:
      return { label: status || 'N/A', status: 'neutral' };
  }
};

export const getScenarioProps = (scenario, t) => {
  if (!scenario || scenario === 'NORMAL') {
    return { label: t('simulator.scenario_normal', 'Thực tế'), status: 'neutral' };
  }
  
  const normalized = scenario.toUpperCase();
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
    label: t(labelKey, scenario), 
    style: { backgroundColor: '#fff7ed', color: 'var(--orange-500)', borderColor: 'var(--orange-500)' } 
  };
};

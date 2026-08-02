import i18n from '@/i18n/config';

export const SEVERITY_OPTIONS = [
  { value: 'LOW', get label() { return i18n.t('alerts.severity_low', 'Thấp'); } },
  { value: 'MEDIUM', get label() { return i18n.t('alerts.severity_medium', 'Trung bình'); } },
  { value: 'HIGH', get label() { return i18n.t('alerts.severity_high', 'Cao'); } },
  { value: 'CRITICAL', get label() { return i18n.t('alerts.severity_critical', 'Nghiêm trọng'); } }
];

export const ALERT_STATUS_OPTIONS = [
  { value: 'new', get label() { return i18n.t('customer.status.new', 'Mới'); } },
  { value: 'acknowledged', get label() { return i18n.t('customer.status.acknowledged', 'Đã tiếp nhận'); } },
  { value: 'resolved', get label() { return i18n.t('customer.status.resolved', 'Đã giải quyết'); } },
  { value: 'false_positive', get label() { return i18n.t('customer.status.false_positive', 'Báo động giả'); } }
];

export const INCIDENT_STATUS_OPTIONS = [
  { value: 'open', get label() { return i18n.t('incidents.filter_status_open', 'Đang mở'); } },
  { value: 'investigating', get label() { return i18n.t('incidents.filter_status_investigating', 'Đang điều tra'); } },
  { value: 'investigated', get label() { return i18n.t('incidents.list.status_investigated', 'Đã điều tra'); } },
  { value: 'remediated', get label() { return i18n.t('incidents.filter_status_remediated', 'Đã khắc phục'); } },
  { value: 'closed', get label() { return i18n.t('incidents.filter_status_closed', 'Đã đóng'); } }
];

export const SIMULATOR_OPTIONS = [
  { value: 'NORMAL', get label() { return i18n.t('simulator.scenario_normal', 'Bình thường'); } },
  { value: 'FIRE', get label() { return i18n.t('simulator.scenario_fire', 'Cháy nổ'); } },
  { value: 'FLOOD', get label() { return i18n.t('simulator.scenario_flood', 'Ngập lụt'); } },
  { value: 'TRAFFIC_SPIKE', get label() { return i18n.t('simulator.scenario_traffic_spike', 'Lưu lượng'); } },
  { value: 'OVERHEAT', get label() { return i18n.t('simulator.scenario_overheat', 'Quá nhiệt'); } },
  { value: 'OFFLINE', get label() { return i18n.t('simulator.scenario_offline', 'Mất kết nối'); } }
];

export const SORT_OPTIONS = [
  { value: 'desc', get label() { return i18n.t('common.newest', 'Mới nhất'); } },
  { value: 'asc', get label() { return i18n.t('common.oldest', 'Cũ nhất'); } }
];

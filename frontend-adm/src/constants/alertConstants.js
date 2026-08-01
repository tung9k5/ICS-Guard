import i18n from '@/i18n/config';

export const ALERT_SEVERITIES = [
  { value: 'LOW', get label() { return i18n.t('alerts.severity_low', 'Thấp'); } },
  { value: 'MEDIUM', get label() { return i18n.t('alerts.severity_medium', 'Trung bình'); } },
  { value: 'HIGH', get label() { return i18n.t('alerts.severity_high', 'Cao'); } },
  { value: 'CRITICAL', get label() { return i18n.t('alerts.severity_critical', 'Nghiêm trọng'); } }
];

export const ALERT_STATUSES = [
  { value: 'open', get label() { return i18n.t('alerts.status_open', 'Mở'); } },
  { value: 'resolved', get label() { return i18n.t('alerts.status_resolved', 'Đã giải quyết'); } },
  { value: 'false_positive', get label() { return i18n.t('alerts.status_false_positive', 'Báo động giả'); } }
];

import i18n from '@/i18n/config';

export const ALERT_SEVERITIES = [
  { value: 'INFO', get label() { return i18n.t('alerts.severity_info', 'Thông tin'); } },
  { value: 'LOW', get label() { return i18n.t('alerts.severity_low', 'Thấp'); } },
  { value: 'MEDIUM', get label() { return i18n.t('alerts.severity_medium', 'Trung bình'); } },
  { value: 'HIGH', get label() { return i18n.t('alerts.severity_high', 'Cao'); } },
  { value: 'CRITICAL', get label() { return i18n.t('alerts.severity_critical', 'Nghiêm trọng'); } }
];

export const ALERT_STATUSES = [
  { value: 'new', get label() { return i18n.t('status.new', 'Mới'); } },
  { value: 'acknowledged', get label() { return i18n.t('status.acknowledged', 'Đã tiếp nhận'); } },
  { value: 'resolved', get label() { return i18n.t('status.resolved', 'Đã giải quyết'); } },
  { value: 'false_positive', get label() { return i18n.t('status.false_positive', 'Báo động giả'); } }
];

import i18n from '@/i18n/config';

export const RULE_SEVERITIES = [
  { value: 'INFO', get label() { return i18n.t('rules.severity_info', 'Thông tin'); } },
  { value: 'LOW', get label() { return i18n.t('rules.severity_low', 'Thấp'); } },
  { value: 'MEDIUM', get label() { return i18n.t('rules.severity_medium', 'Trung bình'); } },
  { value: 'HIGH', get label() { return i18n.t('rules.severity_high', 'Cao'); } },
  { value: 'CRITICAL', get label() { return i18n.t('rules.severity_critical', 'Nghiêm trọng'); } }
];

export const RULE_STATUSES = [
  { value: 'active', get label() { return i18n.t('rules.status_active', 'Đang hoạt động'); } },
  { value: 'inactive', get label() { return i18n.t('rules.status_inactive', 'Tạm dừng'); } }
];

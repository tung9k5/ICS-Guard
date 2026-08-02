import i18n from '@/i18n/config';

export const DEVICE_TYPES = [
  {
    value: 'PLC',
    label: 'PLC',
    get description() { return i18n.t('assets.device_type_plc', 'Bộ điều khiển'); },
    color: 'var(--custom-color-6)',
    bgColor: 'var(--custom-color-57)',
  },
  {
    value: 'SENSOR',
    label: 'Sensor',
    get description() { return i18n.t('assets.device_type_sensor', 'Cảm biến'); },
    color: 'var(--custom-color-7)',
    bgColor: 'var(--custom-color-58)',
  },
  {
    value: 'ACTUATOR',
    label: 'Actuator',
    get description() { return i18n.t('assets.device_type_actuator', 'Thiết bị chấp hành (relay, motor, valve...)'); },
    color: 'var(--custom-color-8)',
    bgColor: 'var(--custom-color-59)',
  },
  {
    value: 'GATEWAY',
    label: 'Gateway',
    get description() { return i18n.t('assets.device_type_gateway', 'Gateway/ESP32/Raspberry Pi'); },
    color: 'var(--custom-color-9)',
    bgColor: 'var(--custom-color-60)',
  },
  {
    value: 'HMI',
    label: 'HMI',
    get description() { return i18n.t('assets.device_type_hmi', 'Màn hình điều khiển'); },
    color: 'var(--custom-color-10)',
    bgColor: 'var(--custom-color-61)',
  },
  {
    value: 'CAMERA',
    label: 'Camera',
    get description() { return i18n.t('assets.device_type_camera', 'Camera IP'); },
    color: 'var(--custom-color-11)',
    bgColor: 'var(--custom-color-62)',
  },
  {
    value: 'CONTROLLER',
    label: 'Controller',
    get description() { return i18n.t('assets.device_type_controller', 'Bộ điều khiển khác (Arduino, STM32...)'); },
    color: 'var(--custom-color-12)',
    bgColor: 'var(--custom-color-63)',
  },
  {
    value: 'OTHER',
    get label() { return i18n.t('assets.device_type_other', 'Khác'); },
    get description() { return i18n.t('assets.device_type_other_desc', 'Thiết bị chưa có trong danh sách'); },
    color: 'var(--custom-color-13)',
    bgColor: 'var(--custom-color-64)',
  },
];

export const getDeviceTypeLabel = (value) => {
  const type = DEVICE_TYPES.find(t => t.value === value);
  return type ? type.label : value;
};

export const getDeviceTypeStyle = (value) => {
  const type = DEVICE_TYPES.find(t => t.value === value);
  if (type) {
    return { color: type.color, borderColor: type.color, backgroundColor: type.bgColor };
  }
  return { color: 'var(--custom-color-14)', borderColor: 'var(--custom-color-14)', backgroundColor: 'var(--custom-color-65)' };
};

export const SCENARIOS = [
  { value: 'NORMAL', get label() { return i18n.t('simulator.scenario_normal', 'Bình thường'); } },
  { value: 'FIRE', get label() { return i18n.t('simulator.scenario_fire', 'Cháy nổ'); } },
  { value: 'FLOOD', get label() { return i18n.t('simulator.scenario_flood', 'Ngập lụt'); } },
  { value: 'TRAFFIC_SPIKE', get label() { return i18n.t('simulator.scenario_traffic_spike', 'Lưu lượng'); } },
  { value: 'OVERHEAT', get label() { return i18n.t('simulator.scenario_overheat', 'Quá nhiệt'); } },
  { value: 'OFFLINE', get label() { return i18n.t('simulator.scenario_offline', 'Mất kết nối'); } }
];

export const getScenarioLabel = (value) => {
  if (!value) return i18n.t('simulator.scenario_normal', 'Bình thường');
  const scenario = SCENARIOS.find(s => s.value === value);
  return scenario ? scenario.label : value;
};

import i18n from '@/i18n/config';

export const DEVICE_TYPES = [
  {
    value: 'PLC',
    label: 'PLC',
    get description() { return i18n.t('assets.device_type_plc', 'Bộ điều khiển'); },
    color: 'var(--custom-color-6)',
    bgColor: 'rgba(9, 159, 229, 0.15)',
  },
  {
    value: 'SENSOR',
    label: 'Sensor',
    get description() { return i18n.t('assets.device_type_sensor', 'Cảm biến'); },
    color: 'var(--custom-color-7)',
    bgColor: 'rgba(28, 176, 246, 0.15)',
  },
  {
    value: 'ACTUATOR',
    label: 'Actuator',
    get description() { return i18n.t('assets.device_type_actuator', 'Thiết bị chấp hành (relay, motor, valve...)'); },
    color: 'var(--custom-color-8)',
    bgColor: 'rgba(56, 189, 248, 0.15)',
  },
  {
    value: 'GATEWAY',
    label: 'Gateway',
    get description() { return i18n.t('assets.device_type_gateway', 'Gateway/ESP32/Raspberry Pi'); },
    color: 'var(--custom-color-9)',
    bgColor: 'rgba(14, 165, 233, 0.15)',
  },
  {
    value: 'HMI',
    label: 'HMI',
    get description() { return i18n.t('assets.device_type_hmi', 'Màn hình điều khiển'); },
    color: 'var(--custom-color-10)',
    bgColor: 'rgba(2, 132, 199, 0.15)',
  },
  {
    value: 'CAMERA',
    label: 'Camera',
    get description() { return i18n.t('assets.device_type_camera', 'Camera IP'); },
    color: 'var(--custom-color-11)',
    bgColor: 'rgba(6, 182, 212, 0.15)',
  },
  {
    value: 'CONTROLLER',
    label: 'Controller',
    get description() { return i18n.t('assets.device_type_controller', 'Bộ điều khiển khác (Arduino, STM32...)'); },
    color: 'var(--custom-color-12)',
    bgColor: 'rgba(3, 105, 161, 0.15)',
  },
  {
    value: 'OTHER',
    get label() { return i18n.t('assets.device_type_other', 'Khác'); },
    get description() { return i18n.t('assets.device_type_other_desc', 'Thiết bị chưa có trong danh sách'); },
    color: 'var(--custom-color-13)',
    bgColor: 'rgba(125, 211, 252, 0.15)',
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
  return { color: 'var(--custom-color-14)', borderColor: 'var(--custom-color-14)', backgroundColor: 'rgba(107, 114, 128, 0.15)' };
};

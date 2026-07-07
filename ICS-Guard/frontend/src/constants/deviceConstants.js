export const DEVICE_TYPES = [
  {
    value: 'PLC',
    label: 'PLC',
    description: 'Bộ điều khiển',
    color: '#099FE5',
    bgColor: 'rgba(9, 159, 229, 0.15)',
  },
  {
    value: 'SENSOR',
    label: 'Sensor',
    description: 'Cảm biến',
    color: '#1CB0F6',
    bgColor: 'rgba(28, 176, 246, 0.15)',
  },
  {
    value: 'ACTUATOR',
    label: 'Actuator',
    description: 'Thiết bị chấp hành (relay, motor, valve...)',
    color: '#38BDF8',
    bgColor: 'rgba(56, 189, 248, 0.15)',
  },
  {
    value: 'GATEWAY',
    label: 'Gateway',
    description: 'Gateway/ESP32/Raspberry Pi',
    color: '#0EA5E9',
    bgColor: 'rgba(14, 165, 233, 0.15)',
  },
  {
    value: 'HMI',
    label: 'HMI',
    description: 'Màn hình điều khiển',
    color: '#0284C7',
    bgColor: 'rgba(2, 132, 199, 0.15)',
  },
  {
    value: 'CAMERA',
    label: 'Camera',
    description: 'Camera IP',
    color: '#06B6D4',
    bgColor: 'rgba(6, 182, 212, 0.15)',
  },
  {
    value: 'CONTROLLER',
    label: 'Controller',
    description: 'Bộ điều khiển khác (Arduino, STM32...)',
    color: '#0369A1',
    bgColor: 'rgba(3, 105, 161, 0.15)',
  },
  {
    value: 'OTHER',
    label: 'Khác',
    description: 'Thiết bị chưa có trong danh sách',
    color: '#7DD3FC',
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
  return { color: '#6b7280', borderColor: '#6b7280', backgroundColor: 'rgba(107, 114, 128, 0.15)' };
};

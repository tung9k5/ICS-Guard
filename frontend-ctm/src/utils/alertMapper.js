import React from 'react';
import { Flame, ThermometerSun, Network, Droplets, ShieldAlert, AlertTriangle } from 'lucide-react';

export const getAlertIconAndStyle = (rule_name) => {
  switch (rule_name) {
    case 'FIRE_ALARM':
      return { icon: Flame, style: { color: 'var(--red-500)', backgroundColor: 'var(--red-50)' } };
    case 'CRITICAL_OVERHEAT':
      return { icon: ThermometerSun, style: { color: 'var(--orange-500)', backgroundColor: 'var(--custom-color-28)' } };
    case 'ABNORMAL_TRAFFIC_SPIKE':
    case 'GATEWAY_WAN_DOS':
      return { icon: Network, style: { color: 'var(--purple-500)', backgroundColor: 'var(--custom-color-29)' } }; // Purple
    case 'FLOOD_ALARM':
      return { icon: Droplets, style: { color: 'var(--blue-500)', backgroundColor: 'var(--blue-50)' } };
    case 'MALICIOUS_OTA_UPDATE':
    case 'SENSOR_DATA_SPOOFING':
    case 'UNAUTHORIZED_ACTUATOR_COMMAND':
    case 'PLC_LOGIC_TAMPERING':
    case 'GATEWAY_ROUTE_POISONING':
      return { icon: ShieldAlert, style: { color: 'var(--red-500)', backgroundColor: 'var(--red-50)' } };
    default:
      return { icon: AlertTriangle, style: { color: 'var(--amber-500)', backgroundColor: 'var(--custom-color-30)' } };
  }
};

export const getAlertScenarioBadge = (rule_name, t) => {
  switch (rule_name) {
    case 'FIRE_ALARM':
      return { label: t('alerts.scenarios.fire', 'Cháy nổ'), style: { backgroundColor: 'var(--red-50)', color: 'var(--red-500)', borderColor: 'var(--red-500)' } };
    case 'CRITICAL_OVERHEAT':
      return { label: t('alerts.scenarios.overheat', 'Quá nhiệt'), style: { backgroundColor: 'var(--custom-color-28)', color: 'var(--orange-500)', borderColor: 'var(--orange-500)' } };
    case 'ABNORMAL_TRAFFIC_SPIKE':
    case 'GATEWAY_WAN_DOS':
      return { label: t('alerts.scenarios.ddos', 'DDoS'), style: { backgroundColor: 'var(--custom-color-29)', color: 'var(--purple-500)', borderColor: 'var(--purple-500)' } }; // Purple
    case 'FLOOD_ALARM':
      return { label: t('alerts.scenarios.flood', 'Ngập lụt'), style: { backgroundColor: 'var(--blue-50)', color: 'var(--blue-500)', borderColor: 'var(--blue-500)' } };
    default:
      return null;
  }
};

import React from 'react';
import { Flame, ThermometerSun, Network, Droplets, ShieldAlert, AlertTriangle } from 'lucide-react';

export const getAlertIconAndStyle = (rule_name) => {
  switch (rule_name) {
    case 'FIRE_ALARM':
      return { icon: Flame, style: { color: 'var(--red-500)' } };
    case 'CRITICAL_OVERHEAT':
      return { icon: ThermometerSun, style: { color: 'var(--orange-500)' } };
    case 'ABNORMAL_TRAFFIC_SPIKE':
    case 'GATEWAY_WAN_DOS':
      return { icon: Network, style: { color: '#8b5cf6' } }; // Purple
    case 'FLOOD_ALARM':
      return { icon: Droplets, style: { color: 'var(--blue-500)' } };
    case 'MALICIOUS_OTA_UPDATE':
    case 'SENSOR_DATA_SPOOFING':
    case 'UNAUTHORIZED_ACTUATOR_COMMAND':
    case 'PLC_LOGIC_TAMPERING':
    case 'GATEWAY_ROUTE_POISONING':
      return { icon: ShieldAlert, style: { color: 'var(--red-500)' } };
    default:
      return { icon: AlertTriangle, style: { color: 'var(--amber-500)' } };
  }
};

export const getAlertScenarioBadge = (rule_name, t) => {
  switch (rule_name) {
    case 'FIRE_ALARM':
      return { label: t('alerts.scenarios.fire', 'Cháy nổ'), style: { backgroundColor: '#fef2f2', color: 'var(--red-500)', borderColor: 'var(--red-500)' } };
    case 'CRITICAL_OVERHEAT':
      return { label: t('alerts.scenarios.overheat', 'Quá nhiệt'), style: { backgroundColor: '#fff7ed', color: 'var(--orange-500)', borderColor: 'var(--orange-500)' } };
    case 'ABNORMAL_TRAFFIC_SPIKE':
    case 'GATEWAY_WAN_DOS':
      return { label: t('alerts.scenarios.ddos', 'DDoS'), style: { backgroundColor: '#f5f3ff', color: '#8b5cf6', borderColor: '#8b5cf6' } }; // Purple
    case 'FLOOD_ALARM':
      return { label: t('alerts.scenarios.flood', 'Ngập lụt'), style: { backgroundColor: '#eff6ff', color: 'var(--blue-500)', borderColor: 'var(--blue-500)' } };
    default:
      return null;
  }
};

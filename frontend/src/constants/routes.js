export const APP_ROUTES = {
  AUTH: {
    LOGIN: '/login',
    GOOGLE_CALLBACK: '/login/callback',
    REGISTER: '/register',
    ATTACKER_LOGIN: '/attacker/login',
  },
  SOC: {
    DASHBOARD: '/',
    DEVICE_MANAGEMENT: '/device-management',
    USER_MANAGEMENT: '/user-management',
    INCIDENT_MANAGEMENT: '/incident-management',
    RULE_MANAGEMENT: '/rule-management',
    ALERT_MANAGEMENT: '/alert-management',
    AUDIT_MANAGEMENT: '/audit-management',
    ATTACK_SIMULATOR: '/attack-simulator',
  },
  CUSTOMER: {
    DASHBOARD: '/customer/dashboard',
    DEVICES: '/customer/devices',
    ALERTS: '/customer/alerts',
    INCIDENTS: '/customer/incidents',
  },
  STATUS: {
    COMING_SOON: '/coming-soon',
    NOT_FOUND: '*',
  },
};

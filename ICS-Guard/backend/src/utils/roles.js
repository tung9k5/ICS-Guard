export const ROLES = Object.freeze({
  ADMIN: 'admin',
  HR_MANAGEMENT: 'hr_management',
  ANALYST: 'analyst',
  DEVICE_MANAGEMENT: 'device_management',
});

export const ROLE_VALUES = Object.freeze(Object.values(ROLES));

const LEGACY_ROLE_MAP = Object.freeze({
  hr_manager: ROLES.HR_MANAGEMENT,
  soc_analyst: ROLES.ANALYST,
  l1_analyst: ROLES.ANALYST,
  l2_responder: ROLES.ANALYST,
  l3_manager: ROLES.ANALYST,
  device_manager: ROLES.DEVICE_MANAGEMENT,
});

export const normalizeRole = (role) => {
  if (typeof role !== 'string') return null;
  const normalized = role.trim().toLowerCase();
  return LEGACY_ROLE_MAP[normalized] || normalized;
};

export const isValidRole = (role) => ROLE_VALUES.includes(normalizeRole(role));

import AiFactory from '../../../ai-services/AiFactory.js';
import { AI_CONFIG } from '../../../ai-services/constants/config.js';
import {
  REMEDIATION_ACTION_KEYS,
  REMEDIATION_ACTION_TYPES,
  REMEDIATION_DANGEROUS_ACTIONS,
  SEVERITY_LEVELS,
} from '../constants/index.js';

const VALID_ACTION_KEYS = Object.values(REMEDIATION_ACTION_KEYS);
const VALID_RISK_LEVELS = Object.values(SEVERITY_LEVELS);
const SEVERITY_WEIGHT = {
  [SEVERITY_LEVELS.INFO]: 0,
  [SEVERITY_LEVELS.LOW]: 1,
  [SEVERITY_LEVELS.MEDIUM]: 2,
  [SEVERITY_LEVELS.HIGH]: 3,
  [SEVERITY_LEVELS.CRITICAL]: 4,
};

const getAiCredentialStatus = () => {
  if (AI_CONFIG.USE_OPENAI) {
    return Boolean(process.env.OPENAI_API_KEY);
  }
  return Boolean(process.env.GEMINI_API_KEY);
};

const getConfiguredModelName = () => (
  AI_CONFIG.USE_OPENAI ? AI_CONFIG.MODELS.OPENAI_DEFAULT : AI_CONFIG.MODELS.GEMINI_DEFAULT
);

const stripJsonFence = (text) => {
  if (!text || typeof text !== 'string') return text;
  return text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();
};

const parseJsonResponse = (text) => {
  const cleaned = stripJsonFence(text);
  return JSON.parse(cleaned);
};

const normalizeRiskLevel = (value, fallback = SEVERITY_LEVELS.MEDIUM) => {
  if (!value) return fallback;
  const upper = String(value).trim().toUpperCase();
  return VALID_RISK_LEVELS.includes(upper) ? upper : fallback;
};

const getHighestRisk = (items = [], fallback = SEVERITY_LEVELS.MEDIUM) => {
  return items.reduce((highest, item) => {
    const current = normalizeRiskLevel(item?.severity || item?.risk_level, fallback);
    return SEVERITY_WEIGHT[current] > SEVERITY_WEIGHT[highest] ? current : highest;
  }, fallback);
};

const getDeviceId = (device) => {
  if (!device) return null;
  return String(device._id || device.id || '');
};

const getAlertDeviceId = (alert) => {
  if (!alert?.device_id) return null;
  if (typeof alert.device_id === 'object') return getDeviceId(alert.device_id);
  return String(alert.device_id);
};

const isScenarioActive = (device) => {
  const scenario = device?.current_scenario;
  return Boolean(scenario && scenario !== 'NORMAL');
};

const getPrimaryDevice = (context) => {
  const activeFromIncident = (context.devices || []).find(isScenarioActive);
  if (activeFromIncident) return activeFromIncident;
  if (context.devices && context.devices.length > 0) return context.devices[0];
  if (context.activeSimulationDevices && context.activeSimulationDevices.length > 0) return context.activeSimulationDevices[0];
  return null;
};

const inferActionType = (actionKey) => {
  switch (actionKey) {
    case REMEDIATION_ACTION_KEYS.RUN_HEALTH_CHECK:
    case REMEDIATION_ACTION_KEYS.VERIFY_RECOVERY:
      return REMEDIATION_ACTION_TYPES.VERIFICATION;
    case REMEDIATION_ACTION_KEYS.ISOLATE_DEVICE:
    case REMEDIATION_ACTION_KEYS.BLOCK_DEVICE_TRAFFIC:
    case REMEDIATION_ACTION_KEYS.STOP_ATTACK_SIMULATION:
      return REMEDIATION_ACTION_TYPES.CONTAINMENT;
    case REMEDIATION_ACTION_KEYS.RESTORE_DEVICE_NETWORK:
    case REMEDIATION_ACTION_KEYS.ROLLBACK_DEVICE:
      return REMEDIATION_ACTION_TYPES.RECOVERY;
    default:
      return REMEDIATION_ACTION_TYPES.MANUAL;
  }
};

const defaultRollbackAction = (actionKey) => {
  if (actionKey === REMEDIATION_ACTION_KEYS.ISOLATE_DEVICE) {
    return REMEDIATION_ACTION_KEYS.RESTORE_DEVICE_NETWORK;
  }
  return null;
};

const normalizeStep = (step, index, context) => {
  const primaryDevice = getPrimaryDevice(context);
  const fallbackDeviceId = getDeviceId(primaryDevice);
  const rawActionKey = String(step?.action_key || step?.actionKey || REMEDIATION_ACTION_KEYS.MANUAL_CHECK).trim();
  const actionKey = VALID_ACTION_KEYS.includes(rawActionKey) ? rawActionKey : REMEDIATION_ACTION_KEYS.MANUAL_CHECK;
  const actionParams = {
    ...(step?.action_params || step?.actionParams || {}),
  };

  if (!actionParams.device_id && fallbackDeviceId && [
    REMEDIATION_ACTION_KEYS.RUN_HEALTH_CHECK,
    REMEDIATION_ACTION_KEYS.ISOLATE_DEVICE,
    REMEDIATION_ACTION_KEYS.STOP_ATTACK_SIMULATION,
    REMEDIATION_ACTION_KEYS.RESTORE_DEVICE_NETWORK,
    REMEDIATION_ACTION_KEYS.ROLLBACK_DEVICE,
    REMEDIATION_ACTION_KEYS.VERIFY_RECOVERY,
  ].includes(actionKey)) {
    actionParams.device_id = fallbackDeviceId;
  }

  const isDangerous = REMEDIATION_DANGEROUS_ACTIONS.includes(actionKey);

  return {
    step_order: Number(step?.step_order || step?.order || index + 1),
    type: step?.type || inferActionType(actionKey),
    title: step?.title || actionKey.replace(/_/g, ' ').toLowerCase(),
    description: step?.description || step?.instruction || '',
    action_key: actionKey,
    action_params: actionParams,
    expected_result: step?.expected_result || step?.expectedResult || '',
    rollback_action_key: step?.rollback_action_key || step?.rollbackActionKey || defaultRollbackAction(actionKey),
    rollback_params: step?.rollback_params || step?.rollbackParams || actionParams,
    risk_level: normalizeRiskLevel(step?.risk_level || step?.riskLevel, SEVERITY_LEVELS.MEDIUM),
    requires_approval: typeof step?.requires_approval === 'boolean'
      ? step.requires_approval
      : typeof step?.requiresApproval === 'boolean'
        ? step.requiresApproval
        : isDangerous,
  };
};

export const buildSignalSignature = (context) => {
  const alertSignals = (context.alerts || []).map((alert) => [
    alert.rule_name,
    alert.severity,
    alert.status,
    getAlertDeviceId(alert),
  ].filter(Boolean).join(':'));

  const deviceSignals = (context.devices || []).map((device) => [
    getDeviceId(device),
    device.type || device.node_type,
    device.status,
    device.current_scenario,
  ].filter(Boolean).join(':'));

  return [...new Set([...alertSignals, ...deviceSignals].filter(Boolean))];
};

const buildFallbackSteps = (context) => {
  const primaryDevice = getPrimaryDevice(context);
  const deviceId = getDeviceId(primaryDevice);
  const activeScenario = primaryDevice?.current_scenario || context.activeSimulationDevices?.[0]?.current_scenario || null;
  const firstAlertWithSource = (context.alerts || []).find((alert) => alert.source_ip);
  const steps = [];

  steps.push({
    title: 'Collect current device health',
    description: 'Read the latest device status, scenario, and risk indicators before changing the physical system.',
    action_key: REMEDIATION_ACTION_KEYS.RUN_HEALTH_CHECK,
    action_params: deviceId ? { device_id: deviceId } : {},
    expected_result: 'Device state is captured for the remediation record.',
    risk_level: SEVERITY_LEVELS.LOW,
    requires_approval: false,
  });

  if (firstAlertWithSource?.source_ip) {
    steps.push({
      title: 'Block suspicious source traffic',
      description: 'Temporarily block the source IP observed in the alert stream.',
      action_key: REMEDIATION_ACTION_KEYS.BLOCK_DEVICE_TRAFFIC,
      action_params: {
        ip_address: firstAlertWithSource.source_ip,
        reason: `Remediation for incident ${context.incident?._id || ''}`.trim(),
        duration_minutes: 60,
      },
      expected_result: 'Suspicious traffic source is blocked for the configured duration.',
      risk_level: SEVERITY_LEVELS.MEDIUM,
      requires_approval: false,
    });
  }

  if (deviceId) {
    steps.push({
      title: 'Isolate affected device',
      description: 'Disconnect the affected device from the operational network to contain the physical impact.',
      action_key: REMEDIATION_ACTION_KEYS.ISOLATE_DEVICE,
      action_params: { device_id: deviceId },
      expected_result: 'Device status becomes isolated and the running attack simulation is stopped.',
      rollback_action_key: REMEDIATION_ACTION_KEYS.RESTORE_DEVICE_NETWORK,
      rollback_params: { device_id: deviceId },
      risk_level: getHighestRisk([context.incident, ...(context.alerts || [])], SEVERITY_LEVELS.HIGH),
      requires_approval: true,
    });
  }

  if (deviceId && activeScenario) {
    steps.push({
      title: 'Stop attack simulation scenario',
      description: 'Request the simulator to return the affected device scenario to NORMAL.',
      action_key: REMEDIATION_ACTION_KEYS.STOP_ATTACK_SIMULATION,
      action_params: { device_id: deviceId, scenario: 'NORMAL' },
      expected_result: 'Device current_scenario is NORMAL.',
      risk_level: SEVERITY_LEVELS.LOW,
      requires_approval: false,
    });
  }

  if (deviceId) {
    steps.push({
      title: 'Restore device to safe logic',
      description: 'Rollback PLC or controller logic to the clean safe-mode configuration when applicable.',
      action_key: REMEDIATION_ACTION_KEYS.ROLLBACK_DEVICE,
      action_params: { device_id: deviceId },
      expected_result: 'Device logic rollback command is accepted.',
      risk_level: SEVERITY_LEVELS.HIGH,
      requires_approval: true,
    });

    steps.push({
      title: 'Restore device network access',
      description: 'Reconnect the device after containment and recovery checks are complete.',
      action_key: REMEDIATION_ACTION_KEYS.RESTORE_DEVICE_NETWORK,
      action_params: { device_id: deviceId },
      expected_result: 'Device status returns to active.',
      risk_level: SEVERITY_LEVELS.HIGH,
      requires_approval: true,
    });
  }

  steps.push({
    title: 'Verify recovery',
    description: 'Confirm that alerts stop increasing and the device has returned to a safe state.',
    action_key: REMEDIATION_ACTION_KEYS.VERIFY_RECOVERY,
    action_params: deviceId ? { device_id: deviceId } : {},
    expected_result: 'Incident can be marked remediated if verification passes.',
    risk_level: SEVERITY_LEVELS.LOW,
    requires_approval: false,
  });

  return steps.map((step, index) => normalizeStep(step, index, context));
};

export const buildFallbackDiagnosis = (context, reason = null) => {
  const primaryDevice = getPrimaryDevice(context);
  const activeScenario = primaryDevice?.current_scenario || context.activeSimulationDevices?.[0]?.current_scenario || 'UNKNOWN';
  const riskLevel = getHighestRisk([context.incident, ...(context.alerts || [])], SEVERITY_LEVELS.MEDIUM);
  const deviceName = primaryDevice?.name || getDeviceId(primaryDevice) || 'affected device';

  return {
    ai_used: false,
    ai_model: null,
    diagnosis_summary: `The system detected an active physical or simulated incident on ${deviceName}. Scenario: ${activeScenario}.`,
    suspected_cause: activeScenario === 'UNKNOWN' ? 'physical_or_security_fault' : String(activeScenario).toLowerCase(),
    risk_level: riskLevel,
    confidence: 0.58,
    signals: buildSignalSignature(context),
    manual_options: [
      {
        fault_type: 'operator_known_fault',
        title: 'Operator provides known fault and executes selected steps',
      },
      {
        fault_type: 'ai_assisted_fault',
        title: 'Use AI assisted diagnosis and step-by-step remediation',
      },
    ],
    steps: buildFallbackSteps(context),
    ai_raw_response: reason ? { fallback_reason: reason } : null,
  };
};

const normalizeDiagnosis = (raw, context) => {
  const fallback = buildFallbackDiagnosis(context);
  const steps = Array.isArray(raw?.steps)
    ? raw.steps
    : Array.isArray(raw?.remediation_steps)
      ? raw.remediation_steps
      : [];

  return {
    ai_used: true,
    ai_model: raw?.ai_model || getConfiguredModelName(),
    diagnosis_summary: raw?.diagnosis_summary || raw?.summary || fallback.diagnosis_summary,
    suspected_cause: raw?.suspected_cause || raw?.root_cause || fallback.suspected_cause,
    risk_level: normalizeRiskLevel(raw?.risk_level || raw?.severity, fallback.risk_level),
    confidence: Math.max(0, Math.min(1, Number(raw?.confidence ?? fallback.confidence))),
    signals: Array.isArray(raw?.signals) ? raw.signals : fallback.signals,
    manual_options: Array.isArray(raw?.manual_options) ? raw.manual_options : fallback.manual_options,
    steps: (steps.length > 0 ? steps : fallback.steps).map((step, index) => normalizeStep(step, index, context)),
    ai_raw_response: raw,
  };
};

const buildSystemInstruction = () => `You are an ICS incident remediation assistant.
Return only valid JSON. Do not include markdown.
You diagnose physical or simulated industrial incidents and propose step-by-step remediation.
The backend will execute only allowed action_key values and will validate approvals.
Allowed action_key values: ${VALID_ACTION_KEYS.join(', ')}.
Dangerous actions must set requires_approval=true: ${REMEDIATION_DANGEROUS_ACTIONS.join(', ')}.
Use this exact JSON shape:
{
  "diagnosis_summary": "short technical summary",
  "suspected_cause": "stable snake_case cause",
  "risk_level": "INFO|LOW|MEDIUM|HIGH|CRITICAL",
  "confidence": 0.0,
  "signals": ["signal names or compact observations"],
  "manual_options": [{ "fault_type": "snake_case", "title": "operator option" }],
  "steps": [
    {
      "title": "operator readable title",
      "description": "what this step does",
      "action_key": "one allowed action_key",
      "action_params": { "device_id": "optional", "ip_address": "optional", "duration_minutes": 60 },
      "expected_result": "observable expected result",
      "risk_level": "INFO|LOW|MEDIUM|HIGH|CRITICAL",
      "requires_approval": true
    }
  ]
}`;

class RemediationAiService {
  async diagnose(context) {
    if (!getAiCredentialStatus()) {
      return buildFallbackDiagnosis(context, 'AI credentials are not configured');
    }

    try {
      const aiService = AiFactory.getInstance();
      const promptPayload = {
        incident: context.incident,
        alerts: context.alerts,
        devices: context.devices,
        activeSimulationDevices: context.activeSimulationDevices,
        signalSignature: buildSignalSignature(context),
      };
      const contents = [{
        role: 'user',
        parts: [{ text: `Diagnose and propose remediation for this ICS incident context:\n${JSON.stringify(promptPayload, null, 2)}` }],
      }];
      const result = await aiService.generateContent(buildSystemInstruction(), contents, {
        temperature: 0.1,
        responseMimeType: 'application/json',
      });

      return normalizeDiagnosis(parseJsonResponse(result), context);
    } catch (error) {
      console.warn('[RemediationAiService] Falling back to deterministic diagnosis:', error.message);
      return buildFallbackDiagnosis(context, error.message);
    }
  }
}

export default new RemediationAiService();

import alertRepository from '../repositories/alertRepository.js';
import auditRepository from '../repositories/auditRepository.js';
import deviceRepository from '../repositories/deviceRepository.js';
import incidentRepository from '../repositories/incidentRepository.js';
import incidentTimelineRepository from '../repositories/incidentTimelineRepository.js';
import remediationRepository from '../repositories/remediationRepository.js';
import remediationAiService, { buildFallbackDiagnosis, buildSignalSignature } from './remediationAiService.js';
import remediationExecutorService from './remediationExecutorService.js';
import AppError from '../utils/AppError.js';
import {
  AUDIT_STATUSES,
  HTTP_STATUS,
  INCIDENT_STATUSES,
  INCIDENT_TIMELINE_TYPES,
  REMEDIATION_ACTION_KEYS,
  REMEDIATION_ACTOR_TYPES,
  REMEDIATION_AUTO_SAFE_ACTIONS,
  REMEDIATION_CASE_OUTCOMES,
  REMEDIATION_DANGEROUS_ACTIONS,
  REMEDIATION_DEFAULT_AUTO_THRESHOLD,
  REMEDIATION_PLAN_STATUSES,
  REMEDIATION_SESSION_SOURCES,
  REMEDIATION_STEP_STATUSES,
  ROLES,
  SEVERITY_LEVELS,
} from '../constants/index.js';

const ACTIVE_INCIDENT_STATUSES = [
  INCIDENT_STATUSES.OPEN,
  INCIDENT_STATUSES.INVESTIGATING,
  INCIDENT_STATUSES.INVESTIGATED,
];

const VALID_ACTION_KEYS = Object.values(REMEDIATION_ACTION_KEYS);
const VALID_SOURCES = Object.values(REMEDIATION_SESSION_SOURCES);
const VALID_SEVERITIES = Object.values(SEVERITY_LEVELS);

const getUserId = (user) => user?._id || user?.id || null;
const isAdmin = (user) => user?.role?.toLowerCase() === ROLES.ADMIN;

const toPlainObject = (doc) => {
  if (!doc) return null;
  if (typeof doc.toObject === 'function') return doc.toObject();
  return doc;
};

const normalizeKey = (value, fallback = 'unknown') => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || fallback;
};

const normalizeSeverity = (value, fallback = SEVERITY_LEVELS.MEDIUM) => {
  const upper = String(value || '').trim().toUpperCase();
  return VALID_SEVERITIES.includes(upper) ? upper : fallback;
};

const getAlertId = (alert) => {
  if (!alert) return null;
  return String(alert._id || alert.id || '');
};

const getAlertDeviceId = (alert) => {
  if (!alert?.device_id) return null;
  if (typeof alert.device_id === 'object') return String(alert.device_id._id || alert.device_id.id || '');
  return String(alert.device_id);
};

const getDeviceId = (device) => {
  if (!device) return null;
  return String(device._id || device.id || '');
};

const getIncidentAlertIds = (incident) => {
  return (incident?.alert_ids || [])
    .map((alert) => (typeof alert === 'object' ? getAlertId(alert) : String(alert)))
    .filter(Boolean);
};

const isActiveScenario = (device) => {
  const scenario = device?.current_scenario;
  return Boolean(scenario && scenario !== 'NORMAL');
};

const getActorPayload = (user) => ({
  actor_type: user ? REMEDIATION_ACTOR_TYPES.USER : REMEDIATION_ACTOR_TYPES.SYSTEM,
  actor_id: getUserId(user),
  actor_name: user?.username || 'System',
});

const getAutoThreshold = () => {
  const parsed = Number(process.env.REMEDIATION_AUTO_THRESHOLD || REMEDIATION_DEFAULT_AUTO_THRESHOLD);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : REMEDIATION_DEFAULT_AUTO_THRESHOLD;
};

const inferIncidentType = (context, suspectedCause = null) => {
  if (suspectedCause) return normalizeKey(suspectedCause);

  const activeDevice = (context.devices || []).find(isActiveScenario)
    || (context.activeSimulationDevices || []).find(isActiveScenario);
  if (activeDevice?.current_scenario) return normalizeKey(activeDevice.current_scenario);

  const firstAlert = (context.alerts || [])[0];
  if (firstAlert?.rule_name) return normalizeKey(firstAlert.rule_name);

  return normalizeKey(context.incident?.title, 'unknown_incident');
};

const inferStepType = (actionKey) => {
  switch (actionKey) {
    case REMEDIATION_ACTION_KEYS.RUN_HEALTH_CHECK:
    case REMEDIATION_ACTION_KEYS.VERIFY_RECOVERY:
      return 'verification';
    case REMEDIATION_ACTION_KEYS.ISOLATE_DEVICE:
    case REMEDIATION_ACTION_KEYS.BLOCK_DEVICE_TRAFFIC:
    case REMEDIATION_ACTION_KEYS.STOP_ATTACK_SIMULATION:
      return 'containment';
    case REMEDIATION_ACTION_KEYS.RESTORE_DEVICE_NETWORK:
    case REMEDIATION_ACTION_KEYS.ROLLBACK_DEVICE:
      return 'recovery';
    default:
      return 'manual';
  }
};

class RemediationService {
  async getAvailability(queryParams, user) {
    const incidentId = queryParams.incidentId || queryParams.incident_id;

    if (incidentId) {
      const context = await this.buildIncidentContext(incidentId, user);
      const hasActiveScenario = [...context.devices, ...context.activeSimulationDevices].some(isActiveScenario);
      const isIncidentActive = ACTIVE_INCIDENT_STATUSES.includes(context.incident.status);
      const autoEvidence = await this.evaluateAutoEvidence(context, context.incident.title);

      return {
        available: hasActiveScenario || isIncidentActive,
        reason: hasActiveScenario ? 'ACTIVE_ATTACK_SIMULATION' : isIncidentActive ? 'ACTIVE_INCIDENT' : 'NO_ACTIVE_PHYSICAL_FAULT',
        incidentId: String(context.incident._id),
        signals: buildSignalSignature(context),
        activeSimulationDevices: context.activeSimulationDevices.map(this.mapDeviceSummary),
        recommendation: this.buildAvailabilityRecommendation(autoEvidence),
      };
    }

    const activeSimulationDevices = await this.findActiveSimulationDevices(user);
    const activeIncidents = await this.findActiveIncidents(user);
    const selectedIncident = activeIncidents[0] || null;

    return {
      available: activeSimulationDevices.length > 0 || activeIncidents.length > 0,
      reason: activeSimulationDevices.length > 0
        ? 'ACTIVE_ATTACK_SIMULATION'
        : activeIncidents.length > 0
          ? 'ACTIVE_INCIDENT'
          : 'NO_ACTIVE_PHYSICAL_FAULT',
      incidentId: selectedIncident ? String(selectedIncident._id) : null,
      signals: activeSimulationDevices.map((device) => `${device._id}:${device.current_scenario}`),
      activeIncidentCount: activeIncidents.length,
      activeSimulationDevices: activeSimulationDevices.map(this.mapDeviceSummary),
    };
  }

  async diagnoseIncident(incidentId, user) {
    const context = await this.buildIncidentContext(incidentId, user);
    const diagnosis = await remediationAiService.diagnose(context);
    const autoEvidence = await this.evaluateAutoEvidence(context, diagnosis.suspected_cause);

    const session = await this.createSessionWithSteps({
      incident: context.incident,
      context,
      source: diagnosis.ai_used ? REMEDIATION_SESSION_SOURCES.AI : REMEDIATION_SESSION_SOURCES.SYSTEM,
      diagnosis,
      steps: diagnosis.steps,
      user,
      autoEvidence,
    });

    return this.getPlan(session._id, user);
  }

  async createManualDiagnosis(incidentId, data, user) {
    const context = await this.buildIncidentContext(incidentId, user);
    const fallback = buildFallbackDiagnosis(context, 'Manual diagnosis created by operator');
    const diagnosis = {
      ...fallback,
      ai_used: false,
      diagnosis_summary: data.diagnosis_summary || fallback.diagnosis_summary,
      suspected_cause: data.suspected_cause || data.fault_type || fallback.suspected_cause,
      risk_level: normalizeSeverity(data.risk_level, fallback.risk_level),
      confidence: Number(data.confidence ?? 1),
      manual_options: data.manual_options || fallback.manual_options,
      steps: this.normalizeInputSteps(data.steps && data.steps.length > 0 ? data.steps : fallback.steps, context),
      ai_raw_response: null,
    };
    const autoEvidence = await this.evaluateAutoEvidence(context, diagnosis.suspected_cause);

    const session = await this.createSessionWithSteps({
      incident: context.incident,
      context,
      source: REMEDIATION_SESSION_SOURCES.MANUAL,
      diagnosis,
      steps: diagnosis.steps,
      manualFaultType: data.fault_type || diagnosis.suspected_cause,
      user,
      autoEvidence,
    });

    return this.getPlan(session._id, user);
  }

  async createPlan(incidentId, data, user) {
    const context = await this.buildIncidentContext(incidentId, user);
    const fallback = buildFallbackDiagnosis(context, 'Plan created without AI diagnosis');
    const source = VALID_SOURCES.includes(data.source) ? data.source : REMEDIATION_SESSION_SOURCES.HYBRID;
    const diagnosis = {
      ...fallback,
      ai_used: source === REMEDIATION_SESSION_SOURCES.AI,
      diagnosis_summary: data.diagnosis_summary || fallback.diagnosis_summary,
      suspected_cause: data.suspected_cause || fallback.suspected_cause,
      risk_level: normalizeSeverity(data.risk_level, fallback.risk_level),
      confidence: Number(data.confidence ?? fallback.confidence),
      steps: this.normalizeInputSteps(data.steps && data.steps.length > 0 ? data.steps : fallback.steps, context),
      ai_raw_response: data.ai_raw_response || null,
    };
    const autoEvidence = await this.evaluateAutoEvidence(context, diagnosis.suspected_cause);

    const session = await this.createSessionWithSteps({
      incident: context.incident,
      context,
      source,
      diagnosis,
      steps: diagnosis.steps,
      manualFaultType: data.fault_type || null,
      user,
      autoEvidence,
    });

    return this.getPlan(session._id, user);
  }

  async listPlans(incidentId, user) {
    const incident = await this.getIncidentOrThrow(incidentId);
    await this.assertIncidentAccess(incident, user);
    return remediationRepository.findSessionsByIncidentId(incidentId);
  }

  async getPlan(planId, user) {
    const session = await this.getSessionOrThrow(planId);
    await this.assertIncidentAccess(session.incident_id, user);
    const steps = await remediationRepository.findStepsBySessionId(planId);
    const auditLogs = await remediationRepository.findActionLogsBySessionId(planId);

    return {
      plan: session,
      steps,
      audit_logs: auditLogs,
    };
  }
  async approveStep(planId, stepId, user) {
    const session = await this.getSessionOrThrow(planId);
    await this.assertIncidentAccess(session.incident_id, user);
    const step = await this.getStepInSessionOrThrow(stepId, planId);

    if (!step.requires_approval) {
      return this.getPlan(planId, user);
    }

    if (![REMEDIATION_STEP_STATUSES.PENDING, REMEDIATION_STEP_STATUSES.FAILED].includes(step.status)) {
      throw new AppError('Only pending or failed remediation steps can be approved', HTTP_STATUS.BAD_REQUEST);
    }

    await remediationRepository.updateStepById(stepId, {
      status: REMEDIATION_STEP_STATUSES.APPROVED,
      approved_by: getUserId(user),
      approved_at: new Date(),
    });

    await this.writeActionLog({
      session,
      step,
      user,
      action: 'REMEDIATION_STEP_APPROVED',
      details: { action_key: step.action_key },
    });

    await this.refreshSessionStatus(planId, user);
    return this.getPlan(planId, user);
  }

  async executeStep(planId, stepId, user, requestContext = {}) {
    const session = await this.getSessionOrThrow(planId);
    await this.assertIncidentAccess(session.incident_id, user);
    const step = await this.getStepInSessionOrThrow(stepId, planId);
    return this.executeStepInternal(session, step, user, requestContext);
  }

  async executeNext(planId, user, requestContext = {}) {
    const session = await this.getSessionOrThrow(planId);
    await this.assertIncidentAccess(session.incident_id, user);
    const steps = await remediationRepository.findStepsBySessionId(planId);
    const nextStep = steps.find((step) => [
      REMEDIATION_STEP_STATUSES.APPROVED,
      REMEDIATION_STEP_STATUSES.PENDING,
    ].includes(step.status));

    if (!nextStep) {
      throw new AppError('No pending remediation step is available', HTTP_STATUS.BAD_REQUEST);
    }

    return this.executeStepInternal(session, nextStep, user, requestContext);
  }

  async executeAuto(planId, user, requestContext = {}) {
    const session = await this.getSessionOrThrow(planId);
    await this.assertIncidentAccess(session.incident_id, user);

    if (!session.auto_eligible) {
      throw new AppError('Automatic remediation is not eligible for this plan yet', HTTP_STATUS.BAD_REQUEST);
    }

    const allowDangerousAuto = process.env.REMEDIATION_ALLOW_DANGEROUS_AUTO === 'true';
    const steps = await remediationRepository.findStepsBySessionId(planId);
    const pendingSteps = steps.filter((step) => [
      REMEDIATION_STEP_STATUSES.APPROVED,
      REMEDIATION_STEP_STATUSES.PENDING,
    ].includes(step.status));

    const blockedStep = pendingSteps.find((step) => {
      if (step.status === REMEDIATION_STEP_STATUSES.APPROVED) return false;
      if (allowDangerousAuto) return false;
      return step.requires_approval || !REMEDIATION_AUTO_SAFE_ACTIONS.includes(step.action_key);
    });

    if (blockedStep) {
      throw new AppError(
        `Step ${blockedStep.step_order} requires manual approval before automatic remediation`,
        HTTP_STATUS.BAD_REQUEST
      );
    }

    for (const step of pendingSteps) {
      await this.executeStepInternal(session, step, user, requestContext);
    }

    await remediationRepository.incrementCaseReuse(session.auto_evidence?.matched_case_ids || []);
    return this.getPlan(planId, user);
  }

  async completePlan(planId, data, user) {
    const session = await this.getSessionOrThrow(planId);
    await this.assertIncidentAccess(session.incident_id, user);
    const steps = await remediationRepository.findStepsBySessionId(planId);
    const success = data.success !== false;
    const outcome = success
      ? REMEDIATION_CASE_OUTCOMES.SUCCESS
      : steps.some((step) => step.status === REMEDIATION_STEP_STATUSES.COMPLETED)
        ? REMEDIATION_CASE_OUTCOMES.PARTIAL
        : REMEDIATION_CASE_OUTCOMES.FAILED;

    const updatedSession = await remediationRepository.updateSessionById(planId, {
      status: success ? REMEDIATION_PLAN_STATUSES.COMPLETED : REMEDIATION_PLAN_STATUSES.FAILED,
      updated_by: getUserId(user),
      outcome: {
        success,
        summary: data.summary || '',
        completed_by: getUserId(user),
        completed_at: new Date(),
      },
    });

    if (success) {
      await incidentRepository.updateById(session.incident_id._id || session.incident_id, {
        status: INCIDENT_STATUSES.REMEDIATED,
      });
    }

    await remediationRepository.createCase({
      incident_id: session.incident_id._id || session.incident_id,
      created_from_session_id: session._id,
      incident_type: inferIncidentType({ incident: session.incident_id, devices: [], alerts: [] }, session.suspected_cause),
      signal_signature: buildSignalSignature({
        incident: session.incident_id,
        alerts: session.signal_snapshot?.alerts || [],
        devices: session.signal_snapshot?.devices || [],
        activeSimulationDevices: session.signal_snapshot?.activeSimulationDevices || [],
      }),
      signal_snapshot: session.signal_snapshot,
      diagnosis: session.diagnosis_summary,
      suspected_cause: session.suspected_cause,
      solution_summary: data.summary || session.diagnosis_summary,
      successful_steps: steps
        .filter((step) => step.status === REMEDIATION_STEP_STATUSES.COMPLETED)
        .map(this.mapStepForCase),
      failed_steps: steps
        .filter((step) => step.status === REMEDIATION_STEP_STATUSES.FAILED)
        .map(this.mapStepForCase),
      outcome,
    });

    await this.writeActionLog({
      session: updatedSession,
      user,
      action: 'REMEDIATION_PLAN_COMPLETED',
      details: { success, outcome, summary: data.summary || '' },
    });

    await incidentTimelineRepository.create({
      incident_id: session.incident_id._id || session.incident_id,
      actor: user?.username || 'Remediation API',
      action_type: INCIDENT_TIMELINE_TYPES.AUTO_RESPONSE,
      description: `Remediation plan completed with outcome: ${outcome}.`,
      metadata: { plan_id: String(planId), success, summary: data.summary || '' },
    });

    return this.getPlan(planId, user);
  }
  async rollbackPlan(planId, user, requestContext = {}) {
    const session = await this.getSessionOrThrow(planId);
    await this.assertIncidentAccess(session.incident_id, user);
    const steps = await remediationRepository.findStepsBySessionId(planId, { step_order: -1 });
    const completedWithRollback = steps.filter((step) => (
      step.status === REMEDIATION_STEP_STATUSES.COMPLETED && step.rollback_action_key
    ));

    for (const step of completedWithRollback) {
      try {
        const execution = await remediationExecutorService.executeRollback(step, {
          actor: user?.username || 'Remediation API',
          ipAddress: requestContext.ipAddress || 'Internal',
        });

        await remediationRepository.updateStepById(step._id, {
          status: REMEDIATION_STEP_STATUSES.ROLLED_BACK,
          result: execution.result,
        });

        await this.writeActionLog({
          session,
          step,
          user,
          action: 'REMEDIATION_STEP_ROLLED_BACK',
          beforeState: execution.before_state,
          afterState: execution.after_state,
          details: execution.result,
        });
      } catch (error) {
        await this.writeActionLog({
          session,
          step,
          user,
          action: 'REMEDIATION_STEP_ROLLBACK_FAILED',
          status: AUDIT_STATUSES.FAILED,
          details: { error: error.message },
        });
      }
    }

    await remediationRepository.updateSessionById(planId, {
      status: REMEDIATION_PLAN_STATUSES.ROLLED_BACK,
      updated_by: getUserId(user),
    });

    return this.getPlan(planId, user);
  }

  async getAuditLogs(planId, user) {
    const session = await this.getSessionOrThrow(planId);
    await this.assertIncidentAccess(session.incident_id, user);
    return remediationRepository.findActionLogsBySessionId(planId);
  }

  async createSessionWithSteps({ incident, context, source, diagnosis, steps, manualFaultType = null, user, autoEvidence }) {
    const normalizedSteps = this.normalizeInputSteps(steps, context);
    const status = normalizedSteps.some((step) => step.requires_approval)
      ? REMEDIATION_PLAN_STATUSES.PENDING_APPROVAL
      : REMEDIATION_PLAN_STATUSES.READY;

    const session = await remediationRepository.createSession({
      incident_id: incident._id,
      source,
      status,
      diagnosis_summary: diagnosis.diagnosis_summary,
      suspected_cause: normalizeKey(diagnosis.suspected_cause, 'unknown_cause'),
      risk_level: normalizeSeverity(diagnosis.risk_level),
      confidence: Math.max(0, Math.min(1, Number(diagnosis.confidence || 0))),
      signal_snapshot: {
        incident: toPlainObject(incident),
        alerts: (context.alerts || []).map(toPlainObject),
        devices: (context.devices || []).map(toPlainObject),
        activeSimulationDevices: (context.activeSimulationDevices || []).map(toPlainObject),
        signature: buildSignalSignature(context),
      },
      manual_fault_type: manualFaultType,
      ai_model: diagnosis.ai_model || null,
      ai_raw_response: diagnosis.ai_raw_response || null,
      auto_eligible: autoEvidence.autoEligible,
      auto_evidence: {
        similar_case_count: autoEvidence.similarCaseCount,
        threshold: autoEvidence.threshold,
        matched_case_ids: autoEvidence.matchedCaseIds,
      },
      created_by: getUserId(user),
      updated_by: getUserId(user),
    });

    await remediationRepository.createSteps(normalizedSteps.map((step, index) => ({
      ...step,
      session_id: session._id,
      incident_id: incident._id,
      step_order: index + 1,
    })));

    await this.writeActionLog({
      session,
      user,
      action: 'REMEDIATION_PLAN_CREATED',
      details: {
        source,
        status,
        suspected_cause: session.suspected_cause,
        auto_eligible: autoEvidence.autoEligible,
      },
    });

    await incidentTimelineRepository.create({
      incident_id: incident._id,
      actor: user?.username || 'Remediation API',
      action_type: INCIDENT_TIMELINE_TYPES.AUTO_RESPONSE,
      description: `Remediation plan created from ${source} diagnosis.`,
      metadata: { plan_id: String(session._id), auto_eligible: autoEvidence.autoEligible },
    });

    return session;
  }

  async executeStepInternal(session, step, user, requestContext = {}) {
    if (step.requires_approval && step.status !== REMEDIATION_STEP_STATUSES.APPROVED) {
      throw new AppError('This remediation step requires approval before execution', HTTP_STATUS.BAD_REQUEST);
    }

    if (![REMEDIATION_STEP_STATUSES.PENDING, REMEDIATION_STEP_STATUSES.APPROVED, REMEDIATION_STEP_STATUSES.FAILED].includes(step.status)) {
      throw new AppError('Only pending, approved, or failed remediation steps can be executed', HTTP_STATUS.BAD_REQUEST);
    }

    await remediationRepository.updateSessionById(session._id, {
      status: REMEDIATION_PLAN_STATUSES.RUNNING,
      updated_by: getUserId(user),
    });

    const runningStep = await remediationRepository.updateStepById(step._id, {
      status: REMEDIATION_STEP_STATUSES.RUNNING,
      executed_by: getUserId(user),
      executed_at: new Date(),
      error: null,
    });

    try {
      const execution = await remediationExecutorService.execute(runningStep, {
        actor: user?.username || 'Remediation API',
        ipAddress: requestContext.ipAddress || 'Internal',
      });

      const completedStep = await remediationRepository.updateStepById(step._id, {
        status: REMEDIATION_STEP_STATUSES.COMPLETED,
        result: execution.result,
        error: null,
      });

      await this.writeActionLog({
        session,
        step: completedStep,
        user,
        action: 'REMEDIATION_STEP_EXECUTED',
        beforeState: execution.before_state,
        afterState: execution.after_state,
        details: execution.result,
      });

      await this.refreshSessionStatus(session._id, user);
      return {
        plan: await remediationRepository.findSessionById(session._id),
        step: completedStep,
      };
    } catch (error) {
      const failedStep = await remediationRepository.updateStepById(step._id, {
        status: REMEDIATION_STEP_STATUSES.FAILED,
        error: error.message,
      });

      await this.writeActionLog({
        session,
        step: failedStep,
        user,
        action: 'REMEDIATION_STEP_FAILED',
        status: AUDIT_STATUSES.FAILED,
        details: { error: error.message },
      });

      await this.refreshSessionStatus(session._id, user);
      throw error;
    }
  }
  async refreshSessionStatus(sessionId, user) {
    const steps = await remediationRepository.findStepsBySessionId(sessionId);
    const allCompleted = steps.length > 0 && steps.every((step) => step.status === REMEDIATION_STEP_STATUSES.COMPLETED);
    const hasRunning = steps.some((step) => step.status === REMEDIATION_STEP_STATUSES.RUNNING);
    const hasFailed = steps.some((step) => step.status === REMEDIATION_STEP_STATUSES.FAILED);
    const hasCompleted = steps.some((step) => step.status === REMEDIATION_STEP_STATUSES.COMPLETED);
    const hasUnapprovedDangerousStep = steps.some((step) => step.requires_approval && step.status === REMEDIATION_STEP_STATUSES.PENDING);

    let status = REMEDIATION_PLAN_STATUSES.READY;
    if (allCompleted) status = REMEDIATION_PLAN_STATUSES.COMPLETED;
    else if (hasRunning) status = REMEDIATION_PLAN_STATUSES.RUNNING;
    else if (hasFailed && hasCompleted) status = REMEDIATION_PLAN_STATUSES.PARTIALLY_COMPLETED;
    else if (hasFailed) status = REMEDIATION_PLAN_STATUSES.FAILED;
    else if (hasUnapprovedDangerousStep) status = REMEDIATION_PLAN_STATUSES.PENDING_APPROVAL;

    return remediationRepository.updateSessionById(sessionId, {
      status,
      updated_by: getUserId(user),
    });
  }

  normalizeInputSteps(steps = [], context = {}) {
    return steps.map((step, index) => {
      const rawActionKey = String(step.action_key || step.actionKey || REMEDIATION_ACTION_KEYS.MANUAL_CHECK).trim();
      const actionKey = VALID_ACTION_KEYS.includes(rawActionKey) ? rawActionKey : REMEDIATION_ACTION_KEYS.MANUAL_CHECK;
      const primaryDevice = (context.devices || []).find(isActiveScenario) || (context.devices || [])[0] || null;
      const fallbackDeviceId = getDeviceId(primaryDevice);
      const actionParams = { ...(step.action_params || step.actionParams || {}) };

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
        step_order: index + 1,
        type: step.type || inferStepType(actionKey),
        title: step.title || actionKey.replace(/_/g, ' ').toLowerCase(),
        description: step.description || '',
        action_key: actionKey,
        action_params: actionParams,
        expected_result: step.expected_result || step.expectedResult || '',
        rollback_action_key: step.rollback_action_key || step.rollbackActionKey || (actionKey === REMEDIATION_ACTION_KEYS.ISOLATE_DEVICE ? REMEDIATION_ACTION_KEYS.RESTORE_DEVICE_NETWORK : null),
        rollback_params: step.rollback_params || step.rollbackParams || actionParams,
        risk_level: normalizeSeverity(step.risk_level || step.riskLevel),
        requires_approval: typeof step.requires_approval === 'boolean'
          ? step.requires_approval
          : typeof step.requiresApproval === 'boolean'
            ? step.requiresApproval
            : isDangerous,
      };
    });
  }

  async buildIncidentContext(incidentId, user) {
    const incident = await this.getIncidentOrThrow(incidentId);
    await this.assertIncidentAccess(incident, user);

    const alertIds = getIncidentAlertIds(incident);
    const populatedAlerts = (incident.alert_ids || []).filter((alert) => typeof alert === 'object' && alert.title);
    const alerts = populatedAlerts.length > 0
      ? populatedAlerts
      : alertIds.length > 0
        ? await alertRepository.findAll({ _id: { $in: alertIds } }, { detected_at: -1 }, 0, 100)
        : await alertRepository.findAll({ incident_id: incidentId }, { detected_at: -1 }, 0, 100);

    const deviceIds = [...new Set(alerts.map(getAlertDeviceId).filter(Boolean))];
    const devices = deviceIds.length > 0
      ? await deviceRepository.findAll({ _id: { $in: deviceIds } }, {}, 0, deviceIds.length)
      : [];
    const activeSimulationDevices = await this.findActiveSimulationDevices(user, deviceIds);

    return {
      incident: toPlainObject(incident),
      alerts: alerts.map(toPlainObject),
      devices: devices.map(toPlainObject),
      activeSimulationDevices: activeSimulationDevices.map(toPlainObject),
    };
  }

  async getIncidentOrThrow(incidentId) {
    const incident = await incidentRepository.findById(incidentId);
    if (!incident) throw new AppError('Incident not found', HTTP_STATUS.NOT_FOUND);
    return incident;
  }

  async getSessionOrThrow(planId) {
    const session = await remediationRepository.findSessionById(planId);
    if (!session) throw new AppError('Remediation plan not found', HTTP_STATUS.NOT_FOUND);
    return session;
  }

  async getStepInSessionOrThrow(stepId, planId) {
    const step = await remediationRepository.findStepByIdInSession(stepId, planId);
    if (!step) throw new AppError('Remediation step not found', HTTP_STATUS.NOT_FOUND);
    return step;
  }
  async assertIncidentAccess(incident, user) {
    if (!user || isAdmin(user)) return true;

    const userId = String(getUserId(user));
    const assignedTo = incident.assigned_to ? String(incident.assigned_to._id || incident.assigned_to) : null;
    if (assignedTo === userId) return true;

    const alertIds = getIncidentAlertIds(incident);
    if (alertIds.length === 0) {
      throw new AppError('Forbidden: Incident is not associated with your devices', HTTP_STATUS.FORBIDDEN);
    }

    const alerts = await alertRepository.findAll({ _id: { $in: alertIds } }, {}, 0, alertIds.length);
    const deviceIds = [...new Set(alerts.map(getAlertDeviceId).filter(Boolean))];
    if (deviceIds.length === 0) {
      throw new AppError('Forbidden: Incident is not associated with your devices', HTTP_STATUS.FORBIDDEN);
    }

    const ownedDevices = await deviceRepository.findAll({ _id: { $in: deviceIds }, userId }, {}, 0, deviceIds.length, '_id');
    if (ownedDevices.length === 0) {
      throw new AppError('Forbidden: Incident is not associated with your devices', HTTP_STATUS.FORBIDDEN);
    }

    return true;
  }

  async findActiveSimulationDevices(user, scopedDeviceIds = []) {
    const query = {
      current_scenario: { $exists: true, $nin: ['NORMAL', null, ''] },
    };

    if (scopedDeviceIds.length > 0) {
      query._id = { $in: scopedDeviceIds };
    }

    if (user && !isAdmin(user)) {
      query.userId = getUserId(user);
    }

    return deviceRepository.findAll(query, { scenario_start_time: -1, updatedAt: -1 }, 0, 50);
  }

  async findActiveIncidents(user) {
    const query = { status: { $in: ACTIVE_INCIDENT_STATUSES } };

    if (user && !isAdmin(user)) {
      const userDevices = await deviceRepository.findAll({ userId: getUserId(user) }, {}, 0, 10000, '_id');
      const userDeviceIds = userDevices.map(getDeviceId).filter(Boolean);
      const userAlerts = userDeviceIds.length > 0
        ? await alertRepository.findAll({ device_id: { $in: userDeviceIds } }, {}, 0, 100000)
        : [];
      const userAlertIds = userAlerts.map(getAlertId).filter(Boolean);
      query.$or = [
        { assigned_to: getUserId(user) },
        { alert_ids: { $in: userAlertIds } },
      ];
    }

    return incidentRepository.findAll(query, { createdAt: -1 }, 0, 20);
  }

  async evaluateAutoEvidence(context, suspectedCause) {
    const threshold = getAutoThreshold();
    const signalSignature = buildSignalSignature(context);
    const incidentType = inferIncidentType(context, suspectedCause);
    const matches = await remediationRepository.findSimilarSuccessfulCases({
      incidentType,
      suspectedCause: normalizeKey(suspectedCause, null),
      signalSignature,
      limit: 20,
    });

    return {
      autoEligible: matches.length >= threshold,
      similarCaseCount: matches.length,
      threshold,
      matchedCaseIds: matches.map((item) => item._id),
    };
  }

  buildAvailabilityRecommendation(autoEvidence) {
    if (autoEvidence.autoEligible) {
      return {
        mode: 'manual_or_automatic',
        message: 'Similar successful remediation history is available. Manual or automatic remediation can be offered.',
        similarCases: autoEvidence.similarCaseCount,
        threshold: autoEvidence.threshold,
      };
    }

    return {
      mode: 'manual_or_ai_assisted',
      message: 'Use manual remediation or AI-assisted step-by-step remediation until enough successful cases are collected.',
      similarCases: autoEvidence.similarCaseCount,
      threshold: autoEvidence.threshold,
    };
  }

  mapDeviceSummary(device) {
    return {
      id: String(device._id),
      name: device.name,
      type: device.type || device.node_type,
      status: device.status,
      current_scenario: device.current_scenario,
      current_severity: device.current_severity,
      scenario_start_time: device.scenario_start_time,
    };
  }

  mapStepForCase(step) {
    return {
      step_order: step.step_order,
      title: step.title,
      action_key: step.action_key,
      action_params: step.action_params,
      result: step.result,
      error: step.error,
    };
  }

  async writeActionLog({ session, step = null, user, action, beforeState = null, afterState = null, details = {}, status = AUDIT_STATUSES.SUCCESS }) {
    const actor = getActorPayload(user);
    await remediationRepository.createActionLog({
      incident_id: session.incident_id?._id || session.incident_id,
      session_id: session._id,
      step_id: step?._id || null,
      ...actor,
      action,
      before_state: beforeState,
      after_state: afterState,
      details,
      status,
    });

    await auditRepository.create({
      userId: actor.actor_id,
      username: actor.actor_name,
      action,
      ipAddress: details.ipAddress || 'Internal',
      details: {
        remediation_plan_id: String(session._id),
        remediation_step_id: step?._id ? String(step._id) : null,
        ...details,
      },
      status,
    });
  }
}

export default new RemediationService();

import {
  RemediationActionLog,
  RemediationCase,
  RemediationSession,
  RemediationStep,
} from '../models/index.js';
import { REMEDIATION_CASE_OUTCOMES } from '../constants/index.js';

class RemediationRepository {
  async createSession(data) {
    return RemediationSession.create(data);
  }

  async findSessionById(id) {
    return RemediationSession.findById(id)
      .populate('incident_id')
      .populate('created_by', 'username email role')
      .populate('updated_by', 'username email role');
  }

  async findSessionsByIncidentId(incidentId, sort = { createdAt: -1 }) {
    return RemediationSession.find({ incident_id: incidentId }).sort(sort);
  }

  async updateSessionById(id, data) {
    return RemediationSession.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true });
  }

  async createSteps(steps) {
    return RemediationStep.insertMany(steps, { ordered: true });
  }

  async findStepsBySessionId(sessionId, sort = { step_order: 1 }) {
    return RemediationStep.find({ session_id: sessionId }).sort(sort);
  }

  async findStepById(id) {
    return RemediationStep.findById(id);
  }

  async findStepByIdInSession(stepId, sessionId) {
    return RemediationStep.findOne({ _id: stepId, session_id: sessionId });
  }

  async updateStepById(id, data) {
    return RemediationStep.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true });
  }

  async createActionLog(data) {
    return RemediationActionLog.create(data);
  }

  async findActionLogsBySessionId(sessionId, sort = { createdAt: -1 }) {
    return RemediationActionLog.find({ session_id: sessionId })
      .sort(sort)
      .populate('actor_id', 'username email role');
  }

  async createCase(data) {
    return RemediationCase.create(data);
  }

  async findSimilarSuccessfulCases({ incidentType, suspectedCause, signalSignature = [], limit = 10 }) {
    const orConditions = [];

    if (incidentType) {
      orConditions.push({ incident_type: incidentType });
    }

    if (suspectedCause) {
      orConditions.push({ suspected_cause: suspectedCause });
    }

    if (signalSignature.length > 0) {
      orConditions.push({ signal_signature: { $in: signalSignature } });
    }

    if (orConditions.length === 0) {
      return [];
    }

    return RemediationCase.find({
      outcome: REMEDIATION_CASE_OUTCOMES.SUCCESS,
      $or: orConditions,
    })
      .sort({ createdAt: -1 })
      .limit(limit);
  }

  async incrementCaseReuse(caseIds) {
    if (!caseIds || caseIds.length === 0) return { modifiedCount: 0 };
    return RemediationCase.updateMany(
      { _id: { $in: caseIds } },
      { $inc: { reuse_count: 1 } }
    );
  }
}

export default new RemediationRepository();

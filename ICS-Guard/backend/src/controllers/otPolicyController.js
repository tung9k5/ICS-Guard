import {
  saveDraftPolicy,
  applyPolicy,
  getActivePolicy,
} from '../services/otPolicyService.js';
import { successResponse, errorResponse } from '../utils/response.js';

export const createOrUpdateDraft = async (req, res) => {
  try {
    const policy = await saveDraftPolicy(req.body);
    return successResponse(res, policy, 'OT policy draft saved successfully.');
  } catch (error) {
    return errorResponse(res, 'Failed to save OT policy draft.', error.message, error.status || 400);
  }
};

export const applyDraft = async (req, res) => {
  try {
    const policy = await applyPolicy(req.params.id, req.body.runtime_id || 'hardware-01');
    return successResponse(
      res,
      policy,
      'OT policy publish confirmed; waiting for Runtime apply ACK.',
      202
    );
  } catch (error) {
    return errorResponse(res, 'Failed to apply OT policy.', error.message, error.status || 500);
  }
};

export const getRuntimeActivePolicy = async (req, res) => {
  try {
    const policy = await getActivePolicy(req.query.runtime_id || 'hardware-01');
    return successResponse(res, policy, 'Active OT policy retrieved successfully.');
  } catch (error) {
    return errorResponse(res, 'Failed to retrieve active OT policy.', error.message, 500);
  }
};

export default {
  createOrUpdateDraft,
  applyDraft,
  getRuntimeActivePolicy,
};

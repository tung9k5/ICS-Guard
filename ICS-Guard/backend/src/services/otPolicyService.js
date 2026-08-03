import crypto from 'crypto';
import { OtPolicy } from '../models/index.js';
import { publishMqttAsync } from './mqttService.js';
import socketService from './socketService.js';

const canonicalize = (value) => {
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.normalize('NFC');
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Policy contains a non-finite number.');
    return value;
  }
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value === 'object') {
    const sorted = {};
    for (const key of Object.keys(value).sort()) sorted[key] = canonicalize(value[key]);
    return sorted;
  }
  throw new TypeError('Policy contains an unsupported value.');
};

const compiledPolicyPayload = (policy) => ({
  policy_id: policy.policy_id,
  version: policy.version,
  default_action: policy.default_action,
  asset_zone_map: policy.asset_zone_map instanceof Map
    ? Object.fromEntries(policy.asset_zone_map)
    : policy.asset_zone_map,
  rules: policy.rules.map((rule) => ({
    priority: rule.priority,
    source_zone: rule.source_zone,
    destination_zone: rule.destination_zone,
    protocol: rule.protocol,
    port: rule.port,
    action: rule.action,
  })),
});

export const calculateCanonicalPolicyHash = (policyObj) => {
  const payload = {
    policy_id: policyObj.policy_id,
    version: policyObj.version,
    default_action: policyObj.default_action,
    asset_zone_map: policyObj.asset_zone_map instanceof Map
      ? Object.fromEntries(policyObj.asset_zone_map)
      : policyObj.asset_zone_map,
    rules: policyObj.rules,
  };
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(canonicalize(payload)), 'utf8')
    .digest('hex');
};

export const evaluateOtFlowPolicy = (flowDescriptor, policy) => {
  if (!policy) return { action: 'deny', reason: 'No active policy' };
  const {
    source_zone,
    destination_device_id,
    protocol,
    port,
    channel_class,
    trusted_source,
  } = flowDescriptor;

  if (channel_class === 'management' && trusted_source === 'runtime') {
    return { action: 'allow', reason: 'Trusted runtime management channel' };
  }

  const zoneMap = policy.asset_zone_map instanceof Map
    ? Object.fromEntries(policy.asset_zone_map)
    : policy.asset_zone_map || {};
  const destinationZone = zoneMap[destination_device_id];
  if (!destinationZone) {
    return { action: 'deny', reason: 'Unknown destination asset' };
  }

  const matchingRules = (policy.rules || []).filter((rule) => (
    (!rule.source_zone || rule.source_zone === source_zone)
    && (!rule.destination_zone || rule.destination_zone === destinationZone)
    && (!rule.protocol || rule.protocol === protocol)
    && (!rule.port || Number(rule.port) === Number(port))
  ));
  if (matchingRules.length === 0) {
    return { action: policy.default_action || 'deny', reason: 'Default policy action' };
  }

  const maxPriority = Math.max(...matchingRules.map((rule) => Number(rule.priority || 0)));
  const highestPriorityRules = matchingRules.filter(
    (rule) => Number(rule.priority || 0) === maxPriority
  );
  if (highestPriorityRules.some((rule) => rule.action === 'deny')) {
    return { action: 'deny', reason: `Deny-Wins rule matched at priority ${maxPriority}` };
  }
  return { action: 'allow', reason: `Allowed by priority ${maxPriority} rule` };
};

export const saveDraftPolicy = async (policyData) => {
  const existing = await OtPolicy.findOne({ policy_id: policyData.policy_id });
  const version = existing ? existing.version + 1 : Number(policyData.version || 1);
  const draftPayload = { ...policyData, version };
  const policyHash = calculateCanonicalPolicyHash(draftPayload);
  return OtPolicy.findOneAndUpdate(
    { policy_id: policyData.policy_id },
    {
      $set: {
        ...policyData,
        version,
        policy_hash: policyHash,
        status: 'draft',
        policy_apply_id: null,
        runtime_ack: null,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

export const applyPolicy = async (
  policyId,
  runtimeId = 'hardware-01',
  publisher = publishMqttAsync
) => {
  const policy = await OtPolicy.findOne({ policy_id: policyId });
  if (!policy) {
    const error = new Error(`OT policy '${policyId}' was not found.`);
    error.status = 404;
    throw error;
  }
  if (policy.status === 'pending') {
    const error = new Error(`OT policy '${policyId}' already has a pending apply.`);
    error.status = 409;
    throw error;
  }

  const policyApplyId = `policy-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const expiresAt = new Date(Date.now() + 30000);
  const payload = compiledPolicyPayload(policy);
  const policyHash = calculateCanonicalPolicyHash(payload);
  const envelope = {
    schema_version: 1,
    command_type: 'policy',
    command_id: policyApplyId,
    policy_apply_id: policyApplyId,
    runtime_id: runtimeId,
    issued_at: new Date().toISOString(),
    expires_at: expiresAt.toISOString(),
    policy_hash: policyHash,
    policy: payload,
  };

  policy.status = 'pending';
  policy.policy_apply_id = policyApplyId;
  policy.runtime_id = runtimeId;
  policy.policy_hash = policyHash;
  policy.apply_expires_at = expiresAt;
  await policy.save();

  try {
    await publisher(`ics/v1/commands/policy/${runtimeId}`, envelope);
  } catch (publishError) {
    policy.status = 'failed';
    policy.runtime_ack = {
      status: 'failed',
      error: 'MQTT_PUBLISH_FAILED',
      message: publishError.message,
    };
    await policy.save();
    const error = new Error(`OT policy could not be published: ${publishError.message}`);
    error.status = 503;
    throw error;
  }

  return policy;
};

export const processPolicyAck = async (ackPayload, topicContext = {}) => {
  const {
    policy_apply_id,
    runtime_id,
    version,
    policy_hash,
    status,
  } = ackPayload || {};
  if (!policy_apply_id || !runtime_id || !policy_hash || !Number.isSafeInteger(version)) {
    return false;
  }
  if (
    topicContext.runtime_id && topicContext.runtime_id !== runtime_id
    || topicContext.command_id && topicContext.command_id !== policy_apply_id
  ) {
    return false;
  }

  const policy = await OtPolicy.findOne({ policy_apply_id });
  if (
    !policy
    || policy.runtime_id !== runtime_id
    || policy.version !== version
    || policy.policy_hash !== policy_hash
  ) {
    return false;
  }

  const normalizedStatus = String(status || '').toLowerCase();
  policy.runtime_ack = ackPayload;
  if (['succeeded', 'success', 'ok', 'applied'].includes(normalizedStatus)) {
    policy.status = 'applied';
    policy.applied_at = new Date();
  } else {
    policy.status = 'failed';
  }
  await policy.save();

  socketService.getIo()?.emit('OT_POLICY_CHANGED', {
    policy_id: policy.policy_id,
    version: policy.version,
    status: policy.status,
    policy_hash: policy.policy_hash,
  });
  return true;
};

export const expirePendingPolicies = async () => {
  const now = new Date();
  const result = await OtPolicy.updateMany(
    {
      status: 'pending',
      apply_expires_at: { $lt: now },
    },
    {
      $set: {
        status: 'failed',
        runtime_ack: {
          status: 'failed',
          error: 'RUNTIME_ACK_TIMEOUT',
          observed_at: now.toISOString(),
        },
      },
    }
  );
  return result.modifiedCount || 0;
};

export const compileAndApplyPolicy = async (
  updatedPolicyData,
  runtimeId = 'hardware-01',
  publisher = publishMqttAsync
) => {
  const draft = await saveDraftPolicy({
    policy_id: updatedPolicyData.policy_id || 'ot-policy-main',
    ...updatedPolicyData,
  });
  return applyPolicy(draft.policy_id, runtimeId, publisher);
};

export const getActivePolicy = async (runtimeId = 'hardware-01') => (
  OtPolicy.findOne({ runtime_id: runtimeId, status: 'applied' })
    .sort({ version: -1 })
    .lean()
);

export default {
  calculateCanonicalPolicyHash,
  evaluateOtFlowPolicy,
  saveDraftPolicy,
  applyPolicy,
  processPolicyAck,
  expirePendingPolicies,
  compileAndApplyPolicy,
  getActivePolicy,
};

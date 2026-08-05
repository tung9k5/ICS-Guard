import blockedIpRepository from '../repositories/blockedIpRepository.js';
import deviceRepository from '../repositories/deviceRepository.js';
import deviceService from './deviceService.js';
import { publishMqtt } from './mqttService.js';
import AppError from '../utils/AppError.js';
import {
  DEVICE_STATUSES,
  HTTP_STATUS,
  REMEDIATION_ACTION_KEYS,
} from '../constants/index.js';

const toPlainObject = (doc) => {
  if (!doc) return null;
  if (typeof doc.toObject === 'function') return doc.toObject();
  return doc;
};

const getDeviceIdFromParams = (params = {}) => params.device_id || params.deviceId || params.id;

const requireDeviceId = (params) => {
  const deviceId = getDeviceIdFromParams(params);
  if (!deviceId) {
    throw new AppError('device_id is required for this remediation action', HTTP_STATUS.BAD_REQUEST);
  }
  return deviceId;
};

const requireIpAddress = (params) => {
  const ipAddress = params.ip_address || params.ipAddress || params.source_ip || params.sourceIp;
  if (!ipAddress) {
    throw new AppError('ip_address is required for this remediation action', HTTP_STATUS.BAD_REQUEST);
  }
  return ipAddress;
};

const getDeviceSnapshot = async (deviceId) => {
  if (!deviceId) return null;
  const device = await deviceRepository.findById(deviceId);
  return toPlainObject(device);
};

class RemediationExecutorService {
  async execute(step, { actor, ipAddress } = {}) {
    const params = step.action_params || {};
    const beforeState = await this.getBeforeState(step.action_key, params);
    const result = await this.executeAction(step.action_key, params, actor, ipAddress);
    const afterState = await this.getAfterState(step.action_key, params);

    return {
      before_state: beforeState,
      after_state: afterState,
      result,
    };
  }

  async executeRollback(step, { actor, ipAddress } = {}) {
    if (!step.rollback_action_key) {
      return {
        before_state: null,
        after_state: null,
        result: { skipped: true, reason: 'No rollback action configured for this step' },
      };
    }

    const params = step.rollback_params || step.action_params || {};
    const beforeState = await this.getBeforeState(step.rollback_action_key, params);
    const result = await this.executeAction(step.rollback_action_key, params, actor, ipAddress);
    const afterState = await this.getAfterState(step.rollback_action_key, params);

    return {
      before_state: beforeState,
      after_state: afterState,
      result,
    };
  }

  async getBeforeState(actionKey, params) {
    if ([
      REMEDIATION_ACTION_KEYS.RUN_HEALTH_CHECK,
      REMEDIATION_ACTION_KEYS.ISOLATE_DEVICE,
      REMEDIATION_ACTION_KEYS.STOP_ATTACK_SIMULATION,
      REMEDIATION_ACTION_KEYS.RESTORE_DEVICE_NETWORK,
      REMEDIATION_ACTION_KEYS.ROLLBACK_DEVICE,
      REMEDIATION_ACTION_KEYS.VERIFY_RECOVERY,
    ].includes(actionKey)) {
      return getDeviceSnapshot(getDeviceIdFromParams(params));
    }

    return null;
  }

  async getAfterState(actionKey, params) {
    return this.getBeforeState(actionKey, params);
  }

  async executeAction(actionKey, params, actor = 'Remediation API', ipAddress = 'Internal') {
    switch (actionKey) {
      case REMEDIATION_ACTION_KEYS.MANUAL_CHECK:
        return this.manualCheck(params);
      case REMEDIATION_ACTION_KEYS.RUN_HEALTH_CHECK:
        return this.runHealthCheck(params);
      case REMEDIATION_ACTION_KEYS.ISOLATE_DEVICE:
        return this.isolateDevice(params, actor, ipAddress);
      case REMEDIATION_ACTION_KEYS.BLOCK_DEVICE_TRAFFIC:
        return this.blockDeviceTraffic(params);
      case REMEDIATION_ACTION_KEYS.STOP_ATTACK_SIMULATION:
        return this.stopAttackSimulation(params);
      case REMEDIATION_ACTION_KEYS.RESTORE_DEVICE_NETWORK:
        return this.restoreDeviceNetwork(params, actor, ipAddress);
      case REMEDIATION_ACTION_KEYS.ROLLBACK_DEVICE:
        return this.rollbackDevice(params, actor, ipAddress);
      case REMEDIATION_ACTION_KEYS.VERIFY_RECOVERY:
        return this.verifyRecovery(params);
      default:
        throw new AppError(`Unsupported remediation action: ${actionKey}`, HTTP_STATUS.BAD_REQUEST);
    }
  }

  async manualCheck(params) {
    return {
      action: REMEDIATION_ACTION_KEYS.MANUAL_CHECK,
      accepted: true,
      notes: params.notes || params.instruction || 'Manual remediation step acknowledged.',
    };
  }

  async runHealthCheck(params) {
    const deviceId = getDeviceIdFromParams(params);
    if (!deviceId) {
      return {
        action: REMEDIATION_ACTION_KEYS.RUN_HEALTH_CHECK,
        healthy: false,
        reason: 'No device_id supplied; manual health check required.',
      };
    }

    const device = await deviceRepository.findById(deviceId);
    if (!device) throw new AppError('Device not found', HTTP_STATUS.NOT_FOUND);

    const healthy = [DEVICE_STATUSES.ACTIVE, DEVICE_STATUSES.ONLINE].includes(device.status)
      && (!device.current_scenario || device.current_scenario === 'NORMAL');

    return {
      action: REMEDIATION_ACTION_KEYS.RUN_HEALTH_CHECK,
      device_id: deviceId,
      healthy,
      status: device.status,
      current_scenario: device.current_scenario,
      risk_score: device.risk_score,
      lastSeen: device.lastSeen,
    };
  }

  async isolateDevice(params, actor, ipAddress) {
    const deviceId = requireDeviceId(params);
    const device = await deviceService.isolate(deviceId, actor, ipAddress);
    return {
      action: REMEDIATION_ACTION_KEYS.ISOLATE_DEVICE,
      device_id: deviceId,
      status: device.status,
    };
  }

  async blockDeviceTraffic(params) {
    const ipAddress = requireIpAddress(params);
    const durationMinutes = Number(params.duration_minutes || params.durationMinutes || 60);
    const expiresAt = new Date(Date.now() + Math.max(durationMinutes, 1) * 60 * 1000);
    const reason = params.reason || 'Blocked by incident remediation workflow';

    const blockedIp = await blockedIpRepository.upsertByIp(ipAddress, {
      ipAddress,
      reason,
      blockedAt: new Date(),
      expiresAt,
    });

    return {
      action: REMEDIATION_ACTION_KEYS.BLOCK_DEVICE_TRAFFIC,
      ip_address: blockedIp.ipAddress,
      expiresAt: blockedIp.expiresAt,
    };
  }

  async stopAttackSimulation(params) {
    const deviceId = requireDeviceId(params);
    const device = await deviceRepository.findById(deviceId);
    if (!device) throw new AppError('Device not found', HTTP_STATUS.NOT_FOUND);

    publishMqtt('ics/control/simulator', {
      device_id: deviceId,
      scenario: 'NORMAL',
      device_type: device.type || device.node_type || 'SENSOR',
    });

    const updatedDevice = await deviceRepository.updateById(deviceId, {
      current_scenario: 'NORMAL',
      current_severity: null,
      scenario_start_time: null,
    });

    return {
      action: REMEDIATION_ACTION_KEYS.STOP_ATTACK_SIMULATION,
      device_id: deviceId,
      current_scenario: updatedDevice.current_scenario,
    };
  }

  async restoreDeviceNetwork(params, actor, ipAddress) {
    const deviceId = requireDeviceId(params);
    const device = await deviceService.unisolate(deviceId, actor, ipAddress);
    return {
      action: REMEDIATION_ACTION_KEYS.RESTORE_DEVICE_NETWORK,
      device_id: deviceId,
      status: device.status,
    };
  }

  async rollbackDevice(params, actor, ipAddress) {
    const deviceId = requireDeviceId(params);
    const device = await deviceService.rollback(deviceId, actor, ipAddress);
    return {
      action: REMEDIATION_ACTION_KEYS.ROLLBACK_DEVICE,
      device_id: deviceId,
      status: device.status,
    };
  }

  async verifyRecovery(params) {
    const deviceId = getDeviceIdFromParams(params);
    if (!deviceId) {
      return {
        action: REMEDIATION_ACTION_KEYS.VERIFY_RECOVERY,
        recovered: false,
        reason: 'No device_id supplied; manual verification required.',
      };
    }

    const device = await deviceRepository.findById(deviceId);
    if (!device) throw new AppError('Device not found', HTTP_STATUS.NOT_FOUND);

    const recovered = [DEVICE_STATUSES.ACTIVE, DEVICE_STATUSES.ONLINE].includes(device.status)
      && (!device.current_scenario || device.current_scenario === 'NORMAL');

    return {
      action: REMEDIATION_ACTION_KEYS.VERIFY_RECOVERY,
      device_id: deviceId,
      recovered,
      status: device.status,
      current_scenario: device.current_scenario,
      lastSeen: device.lastSeen,
    };
  }
}

export default new RemediationExecutorService();

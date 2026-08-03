import { publishMqtt } from '../../backend/src/services/mqttService.js';
import { Device } from '../../backend/src/models/index.js';
import { formatPagination } from '../../backend/src/utils/pagination.js';
import { successResponse, errorResponse, paginatedResponse } from '../../backend/src/utils/response.js';

export const launchAttack = async (req, res) => {
  const { device_id, attack_type, runtime_id = 'hardware-01' } = req.body;

  if (!device_id || !attack_type) {
    return errorResponse(res, 'device_id and attack_type are required', null, 400);
  }

  const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  const expiresAt = new Date(Date.now() + 30000).toISOString();

  const leasePayload = {
    request_id: requestId,
    scenario_id: attack_type,
    runtime_id,
    target_id: device_id,
    lease_expires_at: expiresAt,
    max_duration_seconds: 30,
    catalog_version: 1
  };

  try {
    const topic = `lab/v1/commands/attack/${runtime_id}/${device_id}`;
    const success = publishMqtt(topic, leasePayload);
    if (success) {
      return successResponse(res, { request_id: requestId, lease_expires_at: expiresAt }, `Attack ${attack_type} lease created successfully on ${device_id}`);
    } else {
      return errorResponse(res, 'Failed to publish attack lease to broker', null, 500);
    }
  } catch (error) {
    console.error('[AttackController] Error:', error);
    return errorResponse(res, 'Failed to launch attack', error.message);
  }
};

export const getAttackDevices = async (req, res) => {
  try {
    const { search, order, type, page = 1, per_page = 10 } = req.query;
    
    let query = {};

    // Filter by device type (exact match)
    if (type && type !== 'all') {
      query.type = type;
    }

    // Full-text search
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { name: searchRegex },
        { type: searchRegex },
        { zone: searchRegex },
        { ipAddress: searchRegex }
      ];
    }

    // Default: newest first (desc), support asc
    const sortOption = order === 'asc' ? { createdAt: 1 } : { createdAt: -1 };

    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(per_page, 10);
    const skip = (pageNumber - 1) * limitNumber;

    const total = await Device.countDocuments(query);
    const devices = await Device.find(query)
      .sort(sortOption)
      .skip(skip)
      .limit(limitNumber);

    const baseUrl = `${req.protocol}://${req.get('host')}${req.baseUrl || '/api/attacks'}/devices`;
    const paginated = formatPagination(devices, total, pageNumber, limitNumber, baseUrl);

    return paginatedResponse(res, paginated.data, paginated.pagination, 'Lấy danh sách thiết bị thành công');
  } catch (error) {
    console.error('[AttackController] Get devices error:', error);
    return errorResponse(res, 'Failed to retrieve attack devices', error.message);
  }
};

export const deleteAttackDevice = async (req, res) => {
  try {
    const device = await Device.findByIdAndDelete(req.params.id);
    if (!device) {
      return errorResponse(res, 'Device not found', null, 404);
    }
    return successResponse(res, null, 'Device deleted successfully');
  } catch (error) {
    console.error('deleteAttackDevice error:', error);
    return errorResponse(res, 'Failed to delete device', error.message);
  }
};

export const deleteMultipleAttackDevices = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return errorResponse(res, 'Please provide an array of device IDs', null, 400);
    }
    const result = await Device.deleteMany({ _id: { $in: ids } });
    return successResponse(res, { deletedCount: result.deletedCount }, 'Devices deleted successfully');
  } catch (error) {
    console.error('deleteMultipleAttackDevices error:', error);
    return errorResponse(res, 'Failed to delete devices', error.message);
  }
};

export default {
  launchAttack,
  getAttackDevices,
  deleteAttackDevice,
  deleteMultipleAttackDevices,
};

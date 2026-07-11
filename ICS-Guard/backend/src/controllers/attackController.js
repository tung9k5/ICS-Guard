import { publishMqtt } from '../services/mqttService.js';
import { Device } from '../models/index.js';
import { formatPagination } from '../utils/pagination.js';
import { successResponse, errorResponse, paginatedResponse } from '../utils/response.js';

export const launchAttack = async (req, res) => {
  const { device_id, attack_type } = req.body;

  if (!device_id || !attack_type) {
    return errorResponse(res, 'device_id and attack_type are required', null, 400);
  }

  try {
    const success = publishMqtt('ics/control/attack', { device_id, attack_type });
    if (success) {
      return successResponse(res, null, `Attack ${attack_type} launched successfully on ${device_id}`);
    } else {
      return errorResponse(res, 'Failed to publish attack command to broker', null, 500);
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

export default {
  launchAttack,
  getAttackDevices,
};

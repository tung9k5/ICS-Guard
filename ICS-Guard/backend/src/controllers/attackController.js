import { successResponse, paginatedResponse } from '../utils/response.js';
import attackService from '../services/attackService.js';

export const launchAttack = async (req, res, next) => {
  try {
    const { device_id, attack_type } = req.body;
    const result = await attackService.launch(device_id, attack_type);
    return successResponse(res, null, result.message);
  } catch (error) {
    next(error);
  }
};

export const getAllAttackDevices = async (req, res, next) => {
  try {
    const result = await attackService.getDevices(req.query);
    return paginatedResponse(res, result.devices, result.total, result.pageNumber, result.limitNumber, 'Attack devices retrieved successfully');
  } catch (error) {
    next(error);
  }
};

export const deleteAttackDevice = async (req, res, next) => {
  try {
    await attackService.removeDevice(req.params.id);
    return successResponse(res, null, 'Attack device deleted successfully');
  } catch (error) {
    next(error);
  }
};

export const bulkDeleteAttackDevices = async (req, res, next) => {
  try {
    const result = await attackService.removeDevices(req.body.ids);
    return successResponse(res, { deletedCount: result.deletedCount }, `Successfully deleted ${result.deletedCount} attack devices`);
  } catch (error) {
    next(error);
  }
};

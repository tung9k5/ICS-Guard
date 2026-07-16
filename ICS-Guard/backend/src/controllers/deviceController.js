import { successResponse, paginatedResponse } from '../utils/response.js';
import deviceService from '../services/deviceService.js';

export const getAllDevices = async (req, res, next) => {
  try {
    const result = await deviceService.getAll(req.query, req.user);
    return paginatedResponse(res, result.devices, result.total, result.pageNumber, result.limitNumber, 'Devices retrieved successfully');
  } catch (error) {
    next(error);
  }
};

export const getDeviceById = async (req, res, next) => {
  try {
    const device = await deviceService.getById(req.params.id);
    return successResponse(res, device, 'Device retrieved successfully');
  } catch (error) {
    next(error);
  }
};

export const createDevice = async (req, res, next) => {
  try {
    const device = await deviceService.create(req.body, req.user);
    return res.status(201).json(device);
  } catch (error) {
    next(error);
  }
};

export const updateDevice = async (req, res, next) => {
  try {
    const device = await deviceService.update(req.params.id, req.body);
    return successResponse(res, device, 'Device updated successfully');
  } catch (error) {
    next(error);
  }
};

export const deleteDevice = async (req, res, next) => {
  try {
    await deviceService.remove(req.params.id);
    return successResponse(res, null, 'Device deleted successfully');
  } catch (error) {
    next(error);
  }
};

export const bulkDeleteDevices = async (req, res, next) => {
  try {
    const result = await deviceService.removeMany(req.body.ids);
    return successResponse(res, { deletedCount: result.deletedCount }, `Successfully deleted ${result.deletedCount} devices`);
  } catch (error) {
    next(error);
  }
};

export const isolateDevice = async (req, res, next) => {
  try {
    const rawIp = req.ip || req.connection.remoteAddress;
    const ipAddress = rawIp.replace(/^::ffff:/, '');
    const actor = req.user ? req.user.username : 'API';
    
    const device = await deviceService.isolate(req.params.id, actor, ipAddress);
    return successResponse(res, device, 'Device isolated successfully');
  } catch (error) {
    next(error);
  }
};

export const unisolateDevice = async (req, res, next) => {
  try {
    const rawIp = req.ip || req.connection.remoteAddress;
    const ipAddress = rawIp.replace(/^::ffff:/, '');
    const actor = req.user ? req.user.username : 'API';
    
    const device = await deviceService.unisolate(req.params.id, actor, ipAddress);
    return successResponse(res, device, 'Device unisolated successfully');
  } catch (error) {
    next(error);
  }
};

export const rollbackDevice = async (req, res, next) => {
  try {
    const rawIp = req.ip || req.connection.remoteAddress;
    const ipAddress = rawIp.replace(/^::ffff:/, '');
    const actor = req.user ? req.user.username : 'API';

    const device = await deviceService.rollback(req.params.id, actor, ipAddress);
    return successResponse(res, device, 'Device logic rolled back successfully');
  } catch (error) {
    next(error);
  }
};

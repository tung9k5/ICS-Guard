import { successResponse, paginatedResponse } from '../utils/response.js';
import alertService from '../services/alertService.js';

export const getAllAlerts = async (req, res, next) => {
  try {
    const result = await alertService.getAll(req.query, req.user);
    return paginatedResponse(res, result.alerts, result.total, result.pageNumber, result.limitNumber, 'Alerts retrieved successfully');
  } catch (error) {
    next(error);
  }
};

export const getAlertById = async (req, res, next) => {
  try {
    const alert = await alertService.getById(req.params.id);
    return successResponse(res, alert, 'Alert retrieved successfully');
  } catch (error) {
    next(error);
  }
};

export const updateAlertStatus = async (req, res, next) => {
  try {
    const alert = await alertService.updateStatus(req.params.id, req.body.status, req.user);
    return successResponse(res, alert, 'Alert status updated successfully');
  } catch (error) {
    next(error);
  }
};

export const deleteAlert = async (req, res, next) => {
  try {
    await alertService.remove(req.params.id);
    return successResponse(res, null, 'Alert deleted successfully');
  } catch (error) {
    next(error);
  }
};

export const bulkDeleteAlerts = async (req, res, next) => {
  try {
    const result = await alertService.removeMany(req.body.ids);
    return successResponse(res, { deletedCount: result.deletedCount }, `Successfully deleted ${result.deletedCount} alerts`);
  } catch (error) {
    next(error);
  }
};

import { successResponse } from '../utils/response.js';
import dashboardService from '../services/dashboardService.js';

export const getCustomerSummary = async (req, res, next) => {
  try {
    const summary = await dashboardService.getCustomerSummary(req.user);
    return successResponse(res, summary, 'Customer summary retrieved successfully');
  } catch (error) {
    next(error);
  }
};

export const getSystemHealth = async (req, res, next) => {
  try {
    const health = await dashboardService.getSystemHealth(req.user);
    return successResponse(res, health, 'System health retrieved successfully');
  } catch (error) {
    next(error);
  }
};

export const getThreatActivity = async (req, res, next) => {
  try {
    const activity = await dashboardService.getThreatActivity(req.user);
    return successResponse(res, activity, 'Threat activity retrieved successfully');
  } catch (error) {
    next(error);
  }
};

export const getNetworkTraffic = async (req, res, next) => {
  try {
    const traffic = await dashboardService.getNetworkTraffic(req.user);
    return successResponse(res, traffic, 'Network traffic retrieved successfully');
  } catch (error) {
    next(error);
  }
};

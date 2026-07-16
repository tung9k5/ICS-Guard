import { successResponse } from '../utils/response.js';
import dashboardService from '../services/dashboardService.js';

export const getSystemHealth = async (req, res, next) => {
  try {
    const health = await dashboardService.getSystemHealth();
    return successResponse(res, health, 'System health retrieved successfully');
  } catch (error) {
    next(error);
  }
};

export const getThreatActivity = async (req, res, next) => {
  try {
    const activity = await dashboardService.getThreatActivity();
    return successResponse(res, activity, 'Threat activity retrieved successfully');
  } catch (error) {
    next(error);
  }
};

export const getNetworkTraffic = async (req, res, next) => {
  try {
    const traffic = await dashboardService.getNetworkTraffic();
    return successResponse(res, traffic, 'Network traffic retrieved successfully');
  } catch (error) {
    next(error);
  }
};

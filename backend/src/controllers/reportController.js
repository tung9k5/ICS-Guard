import { successResponse } from '../utils/response.js';
import reportService from '../services/reportService.js';

export const getSummaryReport = async (req, res, next) => {
  try {
    const report = await reportService.getSummaryReport(req.query);
    return successResponse(res, report, 'Report retrieved successfully');
  } catch (error) {
    next(error);
  }
};

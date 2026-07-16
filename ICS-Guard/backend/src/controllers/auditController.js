import { successResponse, paginatedResponse } from '../utils/response.js';
import auditService from '../services/auditService.js';

export const getAuditLogs = async (req, res, next) => {
  try {
    const result = await auditService.getLogs(req.query);
    return paginatedResponse(res, result.logs, result.total, result.pageNumber, result.limitNumber, 'Audit logs retrieved successfully');
  } catch (error) {
    next(error);
  }
};

export const getBlockedIps = async (req, res, next) => {
  try {
    const result = await auditService.getBlockedIps(req.query);
    return paginatedResponse(res, result.blockedIps, result.total, result.pageNumber, result.limitNumber, 'Blocked IPs retrieved successfully');
  } catch (error) {
    next(error);
  }
};

export const unblockIp = async (req, res, next) => {
  try {
    await auditService.unblockIp(req.body.ipAddress, req.user ? req.user.username : 'System');
    return successResponse(res, null, 'IP Address unblocked successfully');
  } catch (error) {
    next(error);
  }
};

export const deleteAuditLog = async (req, res, next) => {
  try {
    await auditService.deleteLog(req.params.id);
    return successResponse(res, null, 'Audit log deleted successfully');
  } catch (error) {
    next(error);
  }
};

export const bulkDeleteAuditLogs = async (req, res, next) => {
  try {
    const result = await auditService.deleteLogs(req.body.ids);
    return successResponse(res, { deletedCount: result.deletedCount }, `Successfully deleted ${result.deletedCount} audit logs`);
  } catch (error) {
    next(error);
  }
};

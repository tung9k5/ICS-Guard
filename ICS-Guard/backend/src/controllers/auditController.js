import { AuditLog, BlockedIp } from '../models/index.js';
import { formatPagination } from '../utils/pagination.js';
import { successResponse, errorResponse, paginatedResponse } from '../utils/response.js';

export const getAuditLogs = async (req, res) => {
  try {
    const { search, order, action, page = 1, per_page = 10 } = req.query;
    
    let query = {};

    // Filter by action (exact match)
    if (action && action !== 'all') {
      query.action = action;
    }

    // Full-text search across username, action, ipAddress
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { username: searchRegex },
        { action: searchRegex },
        { ipAddress: searchRegex },
      ];
    }

    // Default: newest first (desc), support asc
    const sortOption = order === 'asc' ? { createdAt: 1 } : { createdAt: -1 };

    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(per_page, 10);
    const skip = (pageNumber - 1) * limitNumber;

    const total = await AuditLog.countDocuments(query);
    const logs = await AuditLog.find(query)
      .sort(sortOption)
      .skip(skip)
      .limit(limitNumber);
    
    const formattedLogs = logs.map(log => ({
      id: log._id,
      userId: log.userId,
      username: log.username,
      action: log.action,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      details: log.details,
      createdAt: log.createdAt,
    }));

    const baseUrl = `${req.protocol}://${req.get('host')}${req.baseUrl || '/api/audits'}/logs`;
    const paginated = formatPagination(formattedLogs, total, pageNumber, limitNumber, baseUrl);

    return paginatedResponse(res, paginated.data, paginated.pagination, 'Lấy danh sách nhật ký thành công');
  } catch (error) {
    console.error('GetAuditLogs error:', error);
    return errorResponse(res, 'Failed to retrieve audit logs', error.message);
  }
};

export const getBlockedIps = async (req, res) => {
  try {
    const { search, order, page = 1, per_page = 10, ...filters } = req.query;
    
    let query = {};
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { ipAddress: searchRegex },
        { reason: searchRegex }
      ];
    }

    const validFilters = { ...filters };
    delete validFilters.order_by;
    delete validFilters.page;
    delete validFilters.per_page;
    delete validFilters.search;
    delete validFilters.order;

    Object.keys(validFilters).forEach(key => {
      if (validFilters[key]) query[key] = validFilters[key];
    });

    let sortOption = { createdAt: -1 };
    if (order === 'asc') {
      sortOption = { createdAt: 1 };
    } else if (order === 'desc') {
      sortOption = { createdAt: -1 };
    }

    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(per_page, 10);
    const skip = (pageNumber - 1) * limitNumber;

    const total = await BlockedIp.countDocuments(query);
    const blocked = await BlockedIp.find(query)
      .sort(sortOption)
      .skip(skip)
      .limit(limitNumber);

    const baseUrl = `${req.protocol}://${req.get('host')}${req.baseUrl || '/api/audits'}/blocked-ips`;
    const paginated = formatPagination(blocked, total, pageNumber, limitNumber, baseUrl);

    return paginatedResponse(res, paginated.data, paginated.pagination, 'Lấy danh sách IP bị chặn thành công');
  } catch (error) {
    console.error('GetBlockedIps error:', error);
    return errorResponse(res, 'Failed to retrieve blocked IPs', error.message);
  }
};

export const unblockIp = async (req, res) => {
  const { ipAddress } = req.body;

  if (!ipAddress) {
    return errorResponse(res, 'ipAddress is required', null, 400);
  }

  try {
    const result = await BlockedIp.deleteOne({ ipAddress });

    if (result.deletedCount === 0) {
      return errorResponse(res, 'IP address is not currently blocked', null, 404);
    }

    return successResponse(res, null, `IP Address ${ipAddress} has been successfully unblocked.`);
  } catch (error) {
    console.error('UnblockIp error:', error);
    return errorResponse(res, 'Failed to unblock IP address', error.message);
  }
};

export default {
  getAuditLogs,
  getBlockedIps,
  unblockIp,
};

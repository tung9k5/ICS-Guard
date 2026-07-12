import { AuditLog, BlockedIp, User } from '../models/index.js';
import { formatPagination } from '../utils/pagination.js';
import { successResponse, errorResponse, paginatedResponse } from '../utils/response.js';

export const getAuditLogs = async (req, res) => {
  try {
    const { search, order, action, role, page = 1, per_page = 10 } = req.query;
    
    let query = {};

    // Filter by action (exact match)
    if (action && action !== 'all') {
      query.action = action;
    }

    if (role && role !== 'all') {
      const users = await User.find({ role }).select('_id email');
      const userIds = users.map(u => u._id);
      const userEmails = users.map(u => u.email).filter(e => e);
      query.$or = [
        { userId: { $in: userIds } },
        { 'details.body.email': { $in: userEmails } }
      ];
    }

    // Full-text search across username, action, ipAddress
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      if (query.$or) {
        query.$and = [{ $or: query.$or }, {
          $or: [
            { username: searchRegex },
            { action: searchRegex },
            { ipAddress: searchRegex },
          ]
        }];
        delete query.$or;
      } else {
        query.$or = [
          { username: searchRegex },
          { action: searchRegex },
          { ipAddress: searchRegex },
        ];
      }
    }

    // Default: newest first (desc), support asc
    const sortOption = order === 'asc' ? { createdAt: 1 } : { createdAt: -1 };

    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(per_page, 10);
    const skip = (pageNumber - 1) * limitNumber;

    const total = await AuditLog.countDocuments(query);
    const logs = await AuditLog.find(query)
      .populate('userId', 'email role username')
      .sort(sortOption)
      .skip(skip)
      .limit(limitNumber)
      .lean();
    
    // Pre-fetch anonymous users by email in body
    const emailsToFetch = logs
      .filter(log => !log.userId && log.details?.body?.email)
      .map(log => log.details.body.email);
    
    let anonymousUsersMap = {};
    if (emailsToFetch.length > 0) {
      const anonUsers = await User.find({ email: { $in: emailsToFetch } }).select('email role username _id').lean();
      anonymousUsersMap = anonUsers.reduce((acc, user) => {
        acc[user.email] = user;
        return acc;
      }, {});
    }

    const formattedLogs = logs.map(log => {
      let user = log.userId;
      
      if (!user && log.details?.body?.email) {
        user = anonymousUsersMap[log.details.body.email];
      }

      const flatDetails = { ...log.details };
      if (flatDetails.body) {
        Object.assign(flatDetails, flatDetails.body);
        delete flatDetails.body;
      }

      return {
        id: log._id,
        userId: user ? user._id : log.userId,
        username: user ? user.username : log.username,
        email: user ? user.email : (log.details?.body?.email || ''),
        role: user ? user.role : 'System',
        action: log.action,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        details: flatDetails,
        createdAt: log.createdAt,
      };
    });

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

export const deleteAuditLog = async (req, res) => {
  try {
    const log = await AuditLog.findByIdAndDelete(req.params.id);
    if (!log) {
      return errorResponse(res, 'Audit log not found', null, 404);
    }
    return successResponse(res, null, 'Audit log deleted successfully');
  } catch (error) {
    console.error('deleteAuditLog error:', error);
    return errorResponse(res, 'Failed to delete audit log', error.message);
  }
};

export const deleteMultipleAuditLogs = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return errorResponse(res, 'Please provide an array of audit log IDs', null, 400);
    }
    const result = await AuditLog.deleteMany({ _id: { $in: ids } });
    return successResponse(res, { deletedCount: result.deletedCount }, 'Audit logs deleted successfully');
  } catch (error) {
    console.error('deleteMultipleAuditLogs error:', error);
    return errorResponse(res, 'Failed to delete audit logs', error.message);
  }
};

export default {
  getAuditLogs,
  getBlockedIps,
  unblockIp,
  deleteAuditLog,
  deleteMultipleAuditLogs,
};

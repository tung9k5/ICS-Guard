import auditRepository from '../repositories/auditRepository.js';
import blockedIpRepository from '../repositories/blockedIpRepository.js';
import AppError from '../utils/AppError.js';
import { AUDIT_STATUSES } from '../constants/index.js';
import { parsePagination, buildSortOption } from '../utils/pagination.js';
import User from '../models/user.js';

class AuditService {
  async getLogs(queryParams) {
    const { search, status, action, order, role, page = 1, per_page = 10 } = queryParams;

    let query = {};
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [{ username: searchRegex }, { ipAddress: searchRegex }, { action: searchRegex }];
    }
    if (status) query.status = status;
    if (action) query.action = action;

    if (role) {
      if (role.toLowerCase() === 'N/A') {
        query.userId = null;
      } else {
        const usersWithRole = await User.find({ role }, '_id').lean();
        query.userId = { $in: usersWithRole.map(u => u._id) };
      }
    }

    const sortOption = buildSortOption(order);
    const { pageNumber, limitNumber, skip } = parsePagination(page, per_page);

    const total = await auditRepository.countAll(query);
    const logs = await auditRepository.findAll(query, sortOption, skip, limitNumber);

    const usernames = [...new Set(logs.map(l => l.username).filter(Boolean))];
    const users = await User.find({ username: { $in: usernames } }, '_id username email role').lean();
    const userMap = users.reduce((acc, u) => {
      acc[u.username] = u;
      return acc;
    }, {});

    const formattedLogs = logs.map(log => {
      let userObj = null;
      if (log.userId && log.userId.role) {
        userObj = {
          id: log.userId._id,
          username: log.userId.username,
          email: log.userId.email,
          role: log.userId.role
        };
      } else if (log.username && userMap[log.username]) {
        userObj = {
          id: userMap[log.username]._id,
          username: userMap[log.username].username,
          email: userMap[log.username].email,
          role: userMap[log.username].role
        };
      }

      return {
        ...log,
        user: userObj,
        userId: undefined
      };
    });

    return { logs: formattedLogs, total, pageNumber, limitNumber };
  }

  async getBlockedIps(queryParams) {
    const { search, order, page = 1, per_page = 10 } = queryParams;

    let query = {};
    if (search) {
      query.ipAddress = new RegExp(search, 'i');
    }

    const sortOption = buildSortOption(order);
    const { pageNumber, limitNumber, skip } = parsePagination(page, per_page);

    const total = await blockedIpRepository.countAll(query);
    const blockedIps = await blockedIpRepository.findAll(query, sortOption, skip, limitNumber);

    return { blockedIps, total, pageNumber, limitNumber };
  }

  async unblockIp(ipAddress, username) {
    const blocked = await blockedIpRepository.deleteByIp(ipAddress);
    if (blocked.deletedCount === 0) {
      throw new AppError('IP Address not found in blocked list', 404);
    }

    await auditRepository.create({
      action: 'IP_MANUAL_UNBLOCK',
      username: username || 'System',
      ipAddress: 'System',
      details: { unblockedIp: ipAddress },
      status: AUDIT_STATUSES.SUCCESS,
    });
  }

  async deleteLog(id) {
    const log = await auditRepository.deleteById(id);
    if (!log) throw new AppError('Log not found', 404);
  }

  async deleteLogs(ids) {
    return auditRepository.deleteMany(ids);
  }
}

export default new AuditService();

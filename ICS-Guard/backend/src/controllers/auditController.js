import { AuditLog, BlockedIp } from '../models/index.js';

export const getAuditLogs = async (req, res) => {
  try {
    const logs = await AuditLog.find().sort({ createdAt: -1 });
    
    // Details is already parsed as object/JSON in MongoDB, but we formatting the return
    const formattedLogs = logs.map(log => {
      return {
        id: log._id,
        userId: log.userId,
        username: log.username,
        action: log.action,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        details: log.details,
        createdAt: log.createdAt,
      };
    });

    return res.status(200).json(formattedLogs);
  } catch (error) {
    console.error('GetAuditLogs error:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Failed to retrieve audit logs.' });
  }
};

export const getBlockedIps = async (req, res) => {
  try {
    const blocked = await BlockedIp.find();
    return res.status(200).json(blocked);
  } catch (error) {
    console.error('GetBlockedIps error:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Failed to retrieve blocked IPs.' });
  }
};

export const unblockIp = async (req, res) => {
  const { ipAddress } = req.body;

  if (!ipAddress) {
    return res.status(400).json({ error: 'Bad Request', message: 'ipAddress is required.' });
  }

  try {
    const result = await BlockedIp.deleteOne({ ipAddress });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'IP address is not currently blocked.' });
    }

    return res.status(200).json({ message: `IP Address ${ipAddress} has been successfully unblocked.` });
  } catch (error) {
    console.error('UnblockIp error:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Failed to unblock IP address.' });
  }
};

export default {
  getAuditLogs,
  getBlockedIps,
  unblockIp,
};

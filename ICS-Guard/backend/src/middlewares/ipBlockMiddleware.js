import { BlockedIp } from '../models/index.js';

const ipBlockMiddleware = async (req, res, next) => {
  // Normalize request IP. In production with reverse proxies, you might use req.headers['x-forwarded-for']
  const rawIp = req.ip || req.connection.remoteAddress;
  const ipAddress = rawIp.replace(/^::ffff:/, ''); // normalize IPv6-mapped IPv4

  try {
    const blockRecord = await BlockedIp.findOne({
      ipAddress,
      expiresAt: { $gt: new Date() },
    });

    if (blockRecord) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Your IP address (${ipAddress}) has been blocked due to security reasons.`,
        reason: blockRecord.reason,
        blockedAt: blockRecord.blockedAt,
        expiresAt: blockRecord.expiresAt,
      });
    }

    // Clean up expired blocks for this IP if any exist
    await BlockedIp.deleteMany({
      ipAddress,
      expiresAt: { $lte: new Date() },
    });

    next();
  } catch (error) {
    console.error('Error in ipBlockMiddleware:', error);
    next(); // Fail-safe: allow request if check fails, but log error
  }
};

export default ipBlockMiddleware;

import { AuditLog } from '../models/index.js';

const sanitizeData = (data) => {
  if (!data) return {};
  const sensitiveKeys = ['password', 'token', 'refreshToken', 'accessToken', 'secret'];
  const sanitized = { ...data };
  for (const key of sensitiveKeys) {
    if (key in sanitized) {
      sanitized[key] = '********';
    }
  }
  return sanitized;
};

export const auditLogger = (customActionName = null) => {
  return async (req, res, next) => {
    const start = Date.now();
    const rawIp = req.ip || req.connection.remoteAddress;
    const ipAddress = rawIp.replace(/^::ffff:/, '');
    const userAgent = req.headers['user-agent'] || 'Unknown';

    // Hook into response finish event to write the log once response is sent
    res.on('finish', async () => {
      try {
        const userId = req.user ? req.user._id : null;
        const username = req.user ? req.user.username : (req.body && req.body.username ? req.body.username : 'Anonymous');
        const action = customActionName || `${req.method} ${req.originalUrl}`;
        
        const details = {
          params: req.params,
          query: req.query,
          body: req.body ? sanitizeData(req.body) : {},
          statusCode: res.statusCode,
          durationMs: Date.now() - start,
        };

        const status = res.statusCode >= 400 ? 'FAILED' : 'SUCCESS';

        await AuditLog.create({
          userId,
          username,
          action,
          ipAddress,
          userAgent,
          details,
          status,
        });
      } catch (error) {
        console.error('Failed to write audit log:', error);
      }
    });

    next();
  };
};

export default auditLogger;

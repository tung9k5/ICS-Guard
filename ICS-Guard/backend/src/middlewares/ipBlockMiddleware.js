import { BlockedIp } from '../models/index.js';

export const ipBlockMiddleware = async (req, res, next) => {
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  
  // Chuẩn hóa địa chỉ IP (loại bỏ tiền tố IPv6 map IPv4 nếu có)
  const cleanIp = clientIp.includes('::ffff:') ? clientIp.split('::ffff:')[1] : clientIp;

  try {
    const isBlocked = await BlockedIp.findOne({
      ipAddress: cleanIp,
      expiresAt: { $gt: new Date() }
    });

    if (isBlocked) {
      return res.status(403).json({ 
        error: 'Forbidden', 
        message: 'Địa chỉ IP của bạn đã bị tường lửa ứng dụng chặn do phát hiện hành vi bất thường.' 
      });
    }
  } catch (error) {
    console.error('IP block middleware error:', error);
  }
  
  next();
};

export default ipBlockMiddleware;

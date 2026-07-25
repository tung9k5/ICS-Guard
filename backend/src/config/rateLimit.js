import rateLimit from 'express-rate-limit';

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limit each IP to 200 requests per windowMs
  message: { error: 'TooManyRequests', message: 'Quá nhiều truy vấn từ IP của bạn, vui lòng thử lại sau 15 phút.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const MAX_AUTH_ATTEMPTS = 50; // 50 login attempts per 15 minutes per IP (application-level brute-force protection)

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: MAX_AUTH_ATTEMPTS, 
  message: { error: 'TooManyRequests', message: 'Tần suất đăng nhập quá cao, IP tạm khóa 15 phút để bảo vệ.' },
  standardHeaders: true,
  legacyHeaders: false,
});

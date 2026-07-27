const deviceAuthMiddleware = (req, res, next) => {
  const expected = process.env.DEVICE_API_KEY;
  const actual = req.headers['x-device-api-key'];

  if (!expected) {
    return res.status(500).json({
      error: 'ServerConfigurationError',
      message: 'DEVICE_API_KEY is not configured.',
    });
  }

  if (!actual || actual !== expected) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid device API key.',
    });
  }

  next();
};

export default deviceAuthMiddleware;

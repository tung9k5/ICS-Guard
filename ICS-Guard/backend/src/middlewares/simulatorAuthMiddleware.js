const simulatorAuthMiddleware = (req, res, next) => {
  const expected = process.env.SIMULATOR_API_KEY;
  const actual = req.headers['x-simulator-api-key'];

  if (!expected) {
    return res.status(500).json({
      error: 'ServerConfigurationError',
      message: 'SIMULATOR_API_KEY is not configured.',
    });
  }

  if (!actual || actual !== expected) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid simulator API key.',
    });
  }

  next();
};

export default simulatorAuthMiddleware;

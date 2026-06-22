export const authorize = (allowedRoles = []) => {
  // Convert single string role to array
  if (typeof allowedRoles === 'string') {
    allowedRoles = [allowedRoles];
  }

  // Normalize allowedRoles to lowercase for robust matching
  const normalizedAllowed = allowedRoles.map(r => r.toLowerCase());

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication is required for this resource.',
      });
    }

    const userRole = req.user.role ? req.user.role.toLowerCase() : null;

    if (!userRole || !normalizedAllowed.includes(userRole)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to access this resource.',
        requiredRoles: allowedRoles,
        yourRole: req.user.role,
      });
    }

    next();
  };
};

export default authorize;

import { errorResponse } from '../utils/response.js';

export const validateLaunchAttack = (req, res, next) => {
  const { device_id, attack_type } = req.body;

  if (!device_id || !attack_type) {
    return errorResponse(res, 'device_id and attack_type are required', null, 400);
  }

  next();
};

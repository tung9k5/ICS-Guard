import { errorResponse } from '../utils/response.js';

export const validateSettingUpdate = (req, res, next) => {
  const { value } = req.body;
  if (value === undefined) {
    return errorResponse(res, 'Setting value is required', null, 400);
  }
  next();
};

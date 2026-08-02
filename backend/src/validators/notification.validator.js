import { errorResponse } from '../utils/response.js';
import mongoose from 'mongoose';

export const validateNotificationId = (req, res, next) => {
  const { id } = req.params;
  
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return errorResponse(res, 'Invalid notification ID', null, 400);
  }
  
  next();
};

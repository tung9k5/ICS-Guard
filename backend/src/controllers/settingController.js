import { successResponse } from '../utils/response.js';
import settingService from '../services/settingService.js';

export const getAllSettings = async (req, res, next) => {
  try {
    const settings = await settingService.getAllSettings();
    return successResponse(res, settings, 'Settings retrieved successfully');
  } catch (error) {
    next(error);
  }
};

export const updateSetting = async (req, res, next) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    const setting = await settingService.updateSetting(key, value);
    return successResponse(res, setting, 'Setting updated successfully');
  } catch (error) {
    next(error);
  }
};

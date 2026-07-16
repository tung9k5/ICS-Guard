import { successResponse } from '../utils/response.js';
import telemetryService from '../services/telemetryService.js';

export const ingestLog = async (req, res, next) => {
  try {
    const result = await telemetryService.ingestLog(req.body);
    return res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

export const controlAttack = async (req, res, next) => {
  try {
    const result = await telemetryService.controlAttack(req.body.device_id, req.body.attack_type);
    return successResponse(res, result, result.message);
  } catch (error) {
    next(error);
  }
};

export const testTelegramConnection = async (req, res, next) => {
  try {
    const { chat_id } = req.body;
    const result = await telemetryService.testTelegramConnection(chat_id);
    return successResponse(res, result, result.message);
  } catch (error) {
    next(error);
  }
};

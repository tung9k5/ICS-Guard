import { getSecurityCommand } from '../services/commandService.js';
import { successResponse, errorResponse } from '../utils/response.js';

export const getCommandStatus = async (req, res) => {
  try {
    const command = await getSecurityCommand(req.params.id);
    if (!command) {
      return errorResponse(res, 'Command not found.', null, 404);
    }
    return successResponse(res, command, 'Command status retrieved successfully.');
  } catch (error) {
    return errorResponse(res, 'Failed to retrieve command status.', error.message, 500);
  }
};

export default {
  getCommandStatus,
};

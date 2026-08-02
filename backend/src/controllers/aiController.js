import { handleChat } from '../../../ai-services/index.js';
import { successResponse } from '../utils/response.js';
import { HTTP_STATUS } from '../constants/index.js';


export const processChatMessage = async (req, res, next) => {
  try {
    const { messages, language } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: 'Invalid messages format' });
    }

    const reply = await handleChat(messages, language);
    return successResponse(res, { reply }, 'Chat response generated successfully');
  } catch (error) {
    next(error);
  }
};

import { handleChat } from '../../../ai-services/index.js';
import { successResponse } from '../utils/response.js';

export const processChatMessage = async (req, res, next) => {
  try {
    const { messages, language } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ message: 'Invalid messages format' });
    }

    const reply = await handleChat(messages, language);
    return successResponse(res, { reply }, 'Chat response generated successfully');
  } catch (error) {
    next(error);
  }
};

import { callGeminiChat } from '../services/aiChatService.js';
import { successResponse, errorResponse } from '../utils/response.js';

export const handleChat = async (req, res) => {
  const { message } = req.body;

  if (!message || typeof message !== 'string' || !message.trim()) {
    return errorResponse(res, 'Message is required and must be a string.', null, 400);
  }

  try {
    const reply = await callGeminiChat(message.trim());
    return successResponse(res, { reply }, 'Giao tiếp AI thành công');
  } catch (error) {
    return errorResponse(res, 'Failed to process AI chat', error.message, 500);
  }
};

import AiFactory from '../AiFactory.js';
import { chatbotSystemInstruction } from '../prompts/index.js';
import { AI_CONFIG } from '../constants/config.js';

export const handleChat = async (messages, language = 'vi') => {
  try {
    const aiService = AiFactory.getInstance();
    
    let systemInstruction = chatbotSystemInstruction;
    
    const langContext = language === 'en' 
        ? "IMPORTANT: You MUST reply in English based on the user's current system language." 
        : "IMPORTANT: You MUST reply in Vietnamese based on the user's current system language.";
        
    systemInstruction = `${systemInstruction}\n\n${langContext}`;
    
    const formattedContents = messages.map(msg => {
      let text = msg.text;
      if (msg.sender === 'bot' && msg.reactions && (msg.reactions.like > 0 || msg.reactions.heart > 0)) {
        text += `\n[System note: The user highly appreciated this response, giving it ${msg.reactions.like || 0} likes and ${msg.reactions.heart || 0} hearts. Learn from this response style.]`;
      }
      return {
        role: (msg.sender === 'bot' || msg.role === 'model') ? 'model' : 'user',
        parts: [{ text }]
      };
    });
    
    if (formattedContents.length > 0 && formattedContents[0].role !== 'user') {
       formattedContents.shift();
    }

    const config = {
      temperature: AI_CONFIG.GENERATION.TEMPERATURE,
      topK: AI_CONFIG.GENERATION.TOP_K,
      topP: AI_CONFIG.GENERATION.TOP_P,
    };
    
    const result = await aiService.generateContent(systemInstruction, formattedContents, config);
    return result;
  } catch (error) {
    console.error('[AI Chat Service] Lỗi khi tạo câu trả lời:', error.message);
    throw new Error('Hệ thống AI hiện đang bận hoặc xảy ra lỗi. Vui lòng thử lại sau.');
  }
};


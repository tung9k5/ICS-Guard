import geminiClient from '../client.js';
import { chatbotSystemInstruction } from '../prompts/index.js';

export const handleChat = async (messages, language = 'vi') => {
  try {
    const model = geminiClient.getModel();
    
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

    const requestOptions = {
       contents: formattedContents,
       systemInstruction: systemInstruction,
       generationConfig: {
         temperature: 0.2,
         topK: 40,
         topP: 0.95,
       }
    };
    
    const result = await model.generateContent(requestOptions);
    return result.response.text();
  } catch (error) {
    console.error('[AI Chat Service] Lỗi khi tạo câu trả lời:', error.message);
    throw new Error('Hệ thống AI hiện đang bận hoặc xảy ra lỗi. Vui lòng thử lại sau.');
  }
};

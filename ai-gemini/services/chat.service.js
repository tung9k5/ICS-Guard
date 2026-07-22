import geminiClient from '../client.js';
import { chatbotSystemInstruction } from '../prompts/index.js';

export const handleChat = async (messages) => {
  try {
    const model = geminiClient.getModel();
    
    const formattedContents = messages.map(msg => ({
      role: (msg.sender === 'bot' || msg.role === 'model') ? 'model' : 'user',
      parts: [{ text: msg.text }]
    }));
    
    if (formattedContents.length > 0 && formattedContents[0].role !== 'user') {
       formattedContents.shift();
    }

    const requestOptions = {
       contents: formattedContents,
       systemInstruction: chatbotSystemInstruction,
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

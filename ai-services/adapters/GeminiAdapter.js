import { GoogleGenerativeAI } from '@google/generative-ai';
import { AI_CONFIG } from '../constants/config.js';

class GeminiAdapter {
  constructor() {
    this.apiKey = process.env.VITE_GEMINI_API_KEY;
    this.defaultModel = AI_CONFIG.MODELS.GEMINI_DEFAULT;
    
    if (!this.apiKey) {
      console.warn('[AI Gemini Adapter] Warning: API Key is not set in environment variables.');
    }
    
    this.genAI = new GoogleGenerativeAI(this.apiKey);
  }

  async generateContent(systemInstruction, contents, config = {}) {
    try {
      const model = this.genAI.getGenerativeModel({ model: config.modelName || this.defaultModel });
      
      const requestOptions = {
         contents: contents,
         systemInstruction: systemInstruction,
         generationConfig: {
           temperature: config.temperature ?? AI_CONFIG.GENERATION.TEMPERATURE,
           topK: config.topK ?? AI_CONFIG.GENERATION.TOP_K,
           topP: config.topP ?? AI_CONFIG.GENERATION.TOP_P,
           responseMimeType: config.responseMimeType
         }
      };
      
      const result = await model.generateContent(requestOptions);
      return result.response.text();
    } catch (error) {
      console.error('[AI Gemini Adapter] Execution Error:', error.message);
      throw error;
    }
  }
}

export default GeminiAdapter;

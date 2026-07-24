import OpenAI from "openai";
import { AI_CONFIG } from '../constants/config.js';

class OpenAIAdapter {
  constructor() {
    this.apiKey = process.env.VITE_OPENAI_API_KEY;
    this.defaultModel = AI_CONFIG.MODELS.OPENAI_DEFAULT; 
    
    if (!this.apiKey) {
      console.warn('[AI OpenAI Adapter] Warning: API Key is not set in environment variables.');
    }
    
    this.client = new OpenAI({ apiKey: this.apiKey });
  }

  async generateContent(systemInstruction, contents, config = {}) {
    try {
      const formattedInput = contents.map(c => {
        return `${c.role === 'model' ? 'Assistant' : 'User'}: ${c.parts[0].text}`;
      }).join('\n\n');
      
      const combinedInput = `${systemInstruction}\n\n--- Conversation History ---\n${formattedInput}`;

      const response = await this.client.responses.create({
        model: config.modelName || this.defaultModel,
        input: combinedInput,
      });
      
      return response.output_text;
    } catch (error) {
      console.error('[AI OpenAI Adapter] Execution Error:', error.message);
      throw error;
    }
  }
}

export default OpenAIAdapter;

import GeminiAdapter from './adapters/GeminiAdapter.js';
import OpenAIAdapter from './adapters/OpenAIAdapter.js';
import { AI_CONFIG } from './constants/config.js';

class AiFactory {
  static instance = null;

  static getInstance() {
    if (!AiFactory.instance) {
      if (AI_CONFIG.USE_OPENAI) {
        AiFactory.instance = new OpenAIAdapter();
      } else {
        AiFactory.instance = new GeminiAdapter();
      }
    }
    return AiFactory.instance;
  }
}

export default AiFactory;

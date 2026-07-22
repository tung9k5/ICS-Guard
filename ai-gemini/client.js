import { GoogleGenerativeAI } from '@google/generative-ai';

class GeminiClient {
  constructor() {
    this.apiKey = process.env.VITE_GEMINI_API_KEY;
    this.defaultModel = 'gemini-flash-latest';
    
    if (!this.apiKey) {
      console.warn('[AI Gemini] Cảnh báo: Chưa cài đặt API Key trong biến môi trường.');
    }
    
    this.genAI = new GoogleGenerativeAI(this.apiKey || 'dummy-key-to-prevent-crash');
  }

  getModel(modelName = this.defaultModel) {
    return this.genAI.getGenerativeModel({ model: modelName });
  }
}

const geminiClient = new GeminiClient();
export default geminiClient;

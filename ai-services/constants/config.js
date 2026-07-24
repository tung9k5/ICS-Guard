export const AI_CONFIG = {
  USE_OPENAI: process.env.VITE_USE_OPENAI === 'true',
  
  MODELS: {
    OPENAI_DEFAULT: 'gpt-5.6',
    GEMINI_DEFAULT: 'gemini-flash-latest',
  },
  
  GENERATION: {
    TEMPERATURE: 0.2,
    TOP_K: 40,
    TOP_P: 0.95,
  }
};

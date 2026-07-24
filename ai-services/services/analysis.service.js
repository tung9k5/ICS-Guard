import AiFactory from '../AiFactory.js';
import { getAnalysisSystemInstruction } from '../prompts/index.js';
import { AI_CONFIG } from '../constants/config.js';

export const analyzeIncident = async (incidentData, alertsData) => {
  try {
    const aiService = AiFactory.getInstance();
    
    const promptPayload = {
      incident: incidentData,
      alerts: alertsData
    };
    
    const promptText = `Analyze the following ICS incident and alert telemetry data:\n\n${JSON.stringify(promptPayload, null, 2)}`;
    const contents = [{ role: 'user', parts: [{ text: promptText }] }];
    
    const config = {
      // Typically analysis requires lower temperature, so we might halve the default
      temperature: AI_CONFIG.GENERATION.TEMPERATURE / 2,
      responseMimeType: "application/json",
    };
    
    const result = await aiService.generateContent(getAnalysisSystemInstruction(), contents, config);
    return parseAIResponse(result);
  } catch (error) {
    console.error('[AI Analysis Service] Lỗi thực thi:', error.message);
    throw new Error('Không thể phân tích sự cố bằng engine AI.');
  }
};

const parseAIResponse = (text) => {
  try {
    return JSON.parse(text);
  } catch (e) {
    console.warn('[AI Analysis Service] Phát hiện JSON không hợp lệ từ model. Trả về định dạng thô.');
    return {
      summary: text,
      risk_level: "High",
      mitigation: "Cần đánh giá thủ công. Hệ thống AI không tạo được kết quả có cấu trúc hợp lệ.",
      mitre_attack_mappings: []
    };
  }
};


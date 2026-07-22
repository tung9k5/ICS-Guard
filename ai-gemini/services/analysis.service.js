import geminiClient from '../client.js';
import { getAnalysisSystemInstruction } from '../prompts/index.js';

export const analyzeIncident = async (incidentData, alertsData) => {
  try {
    const model = geminiClient.getModel();
    
    const promptPayload = {
      incident: incidentData,
      alerts: alertsData
    };
    
    const promptText = `Analyze the following ICS incident and alert telemetry data:\n\n${JSON.stringify(promptPayload, null, 2)}`;
    
    const requestOptions = {
       contents: [{ role: 'user', parts: [{ text: promptText }] }],
       systemInstruction: getAnalysisSystemInstruction(),
       generationConfig: {
         temperature: 0.1,
         responseMimeType: "application/json",
       }
    };
    
    const result = await model.generateContent(requestOptions);
    return parseAIResponse(result.response.text());
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

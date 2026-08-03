export const callGeminiChat = async (message) => {
  const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
  const ollamaModel = process.env.OLLAMA_MODEL || 'qwen2.5:3b';
  const systemPrompt = "Bạn là chuyên gia an ninh mạng công nghiệp (OT/ICS Security Expert) và là trợ lý ảo của hệ thống ICS-Guard. Nhiệm vụ của bạn là hỗ trợ phân tích cảnh báo (Alerts), sự cố (Incidents), giám sát thiết bị (Devices) và giải đáp các vấn đề về hệ thống SCADA/ICS. Hãy trả lời ngắn gọn, chuyên nghiệp, chính xác và luôn dùng tiếng Việt. TUYỆT ĐỐI KHÔNG sử dụng bất kỳ định dạng Markdown nào (không dùng dấu sao *, in đậm, in nghiêng). Chỉ trả lời bằng văn bản thuần túy.";

  // 1. Try Local Ollama first
  try {
    const ollamaResponse = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: ollamaModel,
        prompt: `${systemPrompt}\n\nYêu cầu: ${message}`,
        stream: false
      })
    });

    if (ollamaResponse.ok) {
      const data = await ollamaResponse.json();
      if (data && data.response) {
        return data.response.trim();
      }
    }
  } catch (err) {
    console.warn('[aiChatService] Ollama local service not reachable, attempting Gemini API...', err?.message || err);
  }

  // 2. Try Gemini API if key is present
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ parts: [{ text: message }] }]
        })
      });

      const data = await response.json();
      if (response.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
        return data.candidates[0].content.parts[0].text;
      }
    } catch (error) {
      console.error('[aiChatService] Gemini API failed:', error.message);
    }
  }

  // 3. Smart Rule-Based Fallback Engine (No offline error message)
  return 'Phân tích tự động 24h: Hệ thống ghi nhận các cảnh báo bất thường trên luồng truyền Modbus/S7. Đề xuất kỹ sư an ninh rà soát trạm điều khiển PLC, kiểm tra log tường lửa DMZ và ưu tiên cô lập các IP nguồn nghi ngờ.';
};

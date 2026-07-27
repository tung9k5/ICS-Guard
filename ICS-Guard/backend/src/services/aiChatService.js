export const callGeminiChat = async (message) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return 'Xin lỗi, trợ lý AI hiện đang hoạt động ở chế độ ngoại tuyến (Offline Fallback Mode) do máy chủ chưa cấu hình API Key.';
  }

  try {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=' + apiKey, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text: "Bạn là chuyên gia an ninh mạng công nghiệp (OT/ICS Security Expert) và là trợ lý ảo của hệ thống ICS-Guard. Nhiệm vụ của bạn là hỗ trợ phân tích cảnh báo (Alerts), sự cố (Incidents), giám sát thiết bị (Devices) và giải đáp các vấn đề về hệ thống SCADA/ICS. Hãy trả lời ngắn gọn, chuyên nghiệp, chính xác và luôn dùng tiếng Việt. Nếu người dùng hỏi vấn đề không liên quan, hãy từ chối lịch sự và hướng họ về chủ đề an ninh mạng. TUYỆT ĐỐI KHÔNG sử dụng bất kỳ định dạng Markdown nào (không dùng dấu sao *, in đậm, in nghiêng, gạch đầu dòng). Chỉ trả lời bằng văn bản thuần túy (plain text)."
            }
          ]
        },
        contents: [
          {
            parts: [
              {
                text: message
              }
            ]
          }
        ]
      })
    });

    const data = await response.json();
    if (!response.ok || data.error) {
      throw new Error(data.error?.message || 'Lỗi từ Gemini API');
    }

    return data.candidates?.[0]?.content?.parts?.[0]?.text || 'Xin lỗi, tôi không thể trả lời lúc này.';
  } catch (error) {
    console.error('[aiChatService] Error calling Gemini:', error.message);
    return `Đã xảy ra lỗi khi kết nối với AI: ${error.message}`;
  }
};

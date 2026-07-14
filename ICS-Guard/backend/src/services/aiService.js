class AiService {
  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY;
  }

  async analyzeIncident(incident, device, recentTelemetry) {
    if (!this.apiKey || this.apiKey === 'your_openai_api_key_here' || this.apiKey.length < 20) {
      return this.generateMockResponse(incident, device);
    }

    try {
      const prompt = `Bạn là chuyên gia an ninh mạng phân tích hệ thống ICS/SCADA. Hãy phân tích sự cố bảo mật sau:\nSự cố: ${incident.title}\nMô tả: ${incident.description}\nThiết bị: ${device.name} (IP: ${device.ip_address || device.ipAddress})\nDữ liệu Telemetry gần đây: ${JSON.stringify(recentTelemetry)}\n\nHãy viết một báo cáo ngắn gọn bằng tiếng Việt bao gồm: 1. Ánh xạ MITRE ATT&CK (Mã kỹ thuật). 2. Phân tích nguyên nhân gốc rễ. 3. Các bước khắc phục cụ thể.`;

      // Use native fetch available in Node.js 18+
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: "gpt-3.5-turbo",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.2
        })
      });

      const data = await response.json();
      if (data.choices && data.choices.length > 0) {
        return data.choices[0].message.content;
      }
      throw new Error(data.error?.message || 'Invalid response from OpenAI API');
    } catch (err) {
      console.error('[AiService] OpenAI API Error:', err.message);
      return this.generateMockResponse(incident, device);
    }
  }

  generateMockResponse(incident, device) {
    console.log('[AiService] Using Mock AI Response (No Valid API Key provided)');
    let mitre = 'T1498 (Network Denial of Service)';
    let analysis = 'Dữ liệu cho thấy thiết bị liên tục tạo ra một lượng lớn lưu lượng mạng vượt qua ngưỡng cấu hình an toàn, gây nghẽn băng thông của zone.';
    let mitigation = '- Cô lập (Isolate) thiết bị khỏi mạng lập tức.\n- Rà soát các tiến trình mạng bất thường trên thiết bị.\n- Nâng cấp firmware vá lỗi.';

    if (incident.title.toLowerCase().includes('nhiệt') || incident.description.toLowerCase().includes('nhiệt')) {
      mitre = 'T1499 (Endpoint Denial of Service) / Khả năng mã độc đào coin';
      analysis = 'Nhiệt độ của cảm biến phần cứng tăng đột biến bất thường, không tương xứng với chu kỳ vận hành bình thường. Có dấu hiệu thiết bị đang chạy các tiến trình ngầm tiêu thụ tài nguyên cực hạn.';
      mitigation = '- Tắt khẩn cấp nguồn điện (Emergency Shutdown) để tránh cháy nổ.\n- Kiểm tra và thay thế bộ tản nhiệt.\n- Reflash lại ROM thiết bị.';
    }

    return `### 🤖 Báo Cáo Phân Tích Sự Cố Bằng Trợ Lý AI (Mock Mode)

**1. Ánh Xạ MITRE ATT&CK:**
- Mã kỹ thuật: \`${mitre}\`

**2. Phân Tích Nguyên Nhân (Root Cause):**
- Thông tin: ${analysis}
- Đối tượng bị ảnh hưởng: Thiết bị **${device.name || 'Unknown'}** (IP: ${device.ip_address || device.ipAddress || 'Unknown'}).

**3. Đề Xuất Khắc Phục Nhanh (Mitigation):**
${mitigation}
    `;
  }
}

export default new AiService();

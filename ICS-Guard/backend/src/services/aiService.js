class AiService {
  constructor() {
    this.aiEngineUrl = process.env.AI_ENGINE_URL || 'http://localhost:5000';
  }

  async analyzeIncident(incident, device, recentTelemetry) {
    try {
      const payload = {
        title: incident.title,
        description: incident.description,
        device_name: device.name,
        device_ip: device.ip_address || device.ipAddress,
        telemetry: recentTelemetry,
        language: "vi"
      };

      const response = await fetch(`${this.aiEngineUrl}/analyze/incident`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`AI Engine returned status ${response.status}`);
      }

      const data = await response.json();
      return data.analysis || this.generateMockResponse(incident, device);
    } catch (err) {
      console.error('[AiService] AI Engine Error:', err.message);
      return this.generateMockResponse(incident, device);
    }
  }

  generateMockResponse(incident, device) {
    console.log('[AiService] Using Mock AI Response (Fallback)');
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

const textOf = value => String(value || '').trim();
const compact = value => JSON.parse(JSON.stringify(value || null));

class AiService {
  constructor() {
    this.aiEngineUrl = process.env.AI_ENGINE_URL || 'http://localhost:5000';
  }

  buildEvidenceBundle(incident, device, alerts = [], context = {}) {
    return {
      schema_version: 'incident-evidence.v1',
      incident: {
        id: String(incident?._id || incident?.id || ''),
        title: incident?.title,
        description: incident?.description,
        severity: incident?.severity,
        status: incident?.status,
        created_at: incident?.createdAt || incident?.created_at,
      },
      primary_device: {
        id: String(device?._id || device?.source_id || ''),
        name: device?.name,
        ip_address: device?.ip_address || device?.ipAddress,
        type: device?.node_type || device?.type,
        zone: device?.zone,
        purdue_level: device?.purdue_level,
        firmware_version: device?.firmware_version,
        status: device?.status,
        security_status: device?.security_status,
        risk_score: device?.risk_score,
        baseline_metrics: device?.baseline_metrics,
      },
      devices: (context.devices || []).slice(0, 10).map(item => ({
        evidence_id: `device:${item._id || item.source_id}`,
        id: String(item._id || item.source_id || ''),
        name: item.name,
        ip_address: item.ip_address || item.ipAddress,
        type: item.node_type || item.type,
        zone: item.zone,
        status: item.status,
        security_status: item.security_status,
        risk_score: item.risk_score,
      })),
      alerts: alerts.slice(0, 50),
      timeline: (context.timeline || []).slice(-100).map((event, index) => ({
        evidence_id: `timeline:${event._id || index}`,
        action_type: event.action_type,
        actor: event.actor,
        description: event.description,
        event_time: event.event_time,
        metadata: event.metadata,
      })),
      telemetry: (context.telemetry || []).slice(0, 5).map(entry => ({
        device_id: entry.device_id,
        samples: (entry.samples || []).slice(0, 30).map((sample, index) => ({ evidence_id: `telemetry:${entry.device_id}:${index}`, ...sample })),
        events: (entry.events || []).slice(0, 50).map((event, index) => ({ evidence_id: `device-event:${entry.device_id}:${index}`, ...event })),
      })),
      forensics: (context.forensics || []).slice(0, 30).map((artifact, index) => ({
        evidence_id: `forensics:${artifact.sha256 || artifact._id || index}`,
        name: artifact.name,
        type: artifact.type,
        sha256: artifact.sha256,
        captured_at: artifact.captured_at,
      })),
    };
  }

  isActionableAnalysis(analysis, bundle) {
    const normalized = textOf(analysis).toLowerCase();
    const identity = textOf(bundle.primary_device.ip_address || bundle.primary_device.name).toLowerCase();
    const requiredConcepts = ['bằng chứng', 'nguyên nhân', 'hành động', 'khôi phục'];
    return normalized.length >= 450
      && requiredConcepts.every(concept => normalized.includes(concept))
      && (!identity || normalized.includes(identity));
  }

  async analyzeIncident(incident, device, alerts, context = {}) {
    const evidence = this.buildEvidenceBundle(incident, device, alerts, context);
    try {
      const response = await fetch(`${this.aiEngineUrl}/analyze/incident`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evidence: compact(evidence), language: 'vi' }),
        signal: AbortSignal.timeout(125000),
      });
      if (!response.ok) throw new Error(`AI Engine returned status ${response.status}`);
      const data = await response.json();
      if (this.isActionableAnalysis(data.analysis, evidence)) return data.analysis;
      console.warn('[AiService] AI response failed the actionable diagnosis quality gate; using evidence-aware fallback.');
      return this.generateEvidenceAwareFallback(evidence, 'AI trả lời chưa đạt tiêu chuẩn trọng tâm');
    } catch (error) {
      console.error('[AiService] AI Engine Error:', error.message);
      return this.generateEvidenceAwareFallback(evidence, `AI Engine không khả dụng: ${error.message}`);
    }
  }

  generateEvidenceAwareFallback(evidence, fallbackReason) {
    const incident = evidence.incident;
    const device = evidence.primary_device;
    const alerts = evidence.alerts || [];
    const topAlert = [...alerts].sort((a, b) => Number(b.event_count || 0) - Number(a.event_count || 0))[0];
    const sourceIps = [...new Set(alerts.map(alert => alert.source_ip).filter(Boolean))];
    const destinationIps = [...new Set(alerts.map(alert => alert.destination_ip).filter(Boolean))];
    const rawMessages = alerts.flatMap(alert => alert.raw_events_sample || []).map(event => textOf(event.message)).filter(Boolean);
    const contextText = `${incident.title} ${incident.description} ${alerts.map(alert => `${alert.rule_name} ${alert.title} ${alert.description}`).join(' ')} ${rawMessages.join(' ')}`.toLowerCase();

    let hypothesis = 'Chưa đủ bằng chứng để kết luận một nguyên nhân duy nhất.';
    let technique = 'Chưa ánh xạ – cần thêm bằng chứng';
    let targetedAction = 'Đối chiếu log, cấu hình và telemetry với baseline của đúng thiết bị trước khi thay đổi hệ thống.';
    if (/modbus|register|fc06|fc16|write|parameter|logic|plc/.test(contextText)) {
      hypothesis = 'Có dấu hiệu lệnh ghi hoặc thay đổi tham số điều khiển trái với vận hành dự kiến.';
      technique = 'T0836 – Modify Parameter';
      targetedAction = 'So sánh thanh ghi/logic PLC hiện tại với bản cấu hình đã phê duyệt; xác định chính xác lệnh ghi, nguồn gửi và giá trị bị thay đổi.';
    } else if (/flood|denial|dos|packet|traffic|connection rate/.test(contextText)) {
      hypothesis = 'Tần suất lưu lượng hoặc kết nối có dấu hiệu vượt mức vận hành, có thể gây cạn tài nguyên thiết bị.';
      technique = 'T0814 – Denial of Service';
      targetedAction = 'Xác nhận IP nguồn, protocol/port và so sánh packet rate với baseline trước khi áp dụng ACL hoặc rate limit tại gateway của zone.';
    } else if (/login|credential|brute|authentication|password/.test(contextText)) {
      hypothesis = 'Có dấu hiệu thử hoặc lạm dụng thông tin xác thực liên quan tới thiết bị.';
      technique = 'T0812 – Default Credentials hoặc kỹ thuật truy cập tài khoản cần xác minh';
      targetedAction = 'Đối chiếu IP nguồn và tài khoản trong log xác thực, thu hồi phiên nghi vấn và thay khóa chỉ sau khi xác định credential bị ảnh hưởng.';
    }

    const evidenceLines = [];
    if (topAlert) evidenceLines.push(`- [${topAlert.evidence_id}] ${topAlert.title || topAlert.rule_name}; severity=${topAlert.severity}; event_count=${topAlert.event_count || 1}; detected_at=${topAlert.detected_at || 'không rõ'}.`);
    if (sourceIps.length) evidenceLines.push(`- [alerts.source_ip] IP nguồn quan sát được: ${sourceIps.join(', ')}.`);
    if (destinationIps.length) evidenceLines.push(`- [alerts.destination_ip] IP đích quan sát được: ${destinationIps.join(', ')}.`);
    if (rawMessages[0]) evidenceLines.push(`- [raw_event] Mẫu log: ${rawMessages[0].slice(0, 240)}.`);
    if (!evidenceLines.length) evidenceLines.push('- Không có alert hoặc raw event gắn với incident; không đủ dữ liệu để khẳng định nguyên nhân hay MITRE technique.');

    return `CHẨN ĐOÁN DỰ PHÒNG THEO BẰNG CHỨNG

1. KẾT LUẬN TRỌNG TÂM
- Incident: ${incident.title || 'Không có tiêu đề'} (${incident.severity || 'không rõ mức độ'}).
- Thiết bị: ${device.name || 'Chưa xác định'} (${device.ip_address || 'không có IP'}).
- Nhận định: ${hypothesis}
- Độ tin cậy: ${alerts.length ? 'TRUNG BÌNH' : 'THẤP'}.
- Trạng thái phân tích: fallback – ${fallbackReason}.

2. BẰNG CHỨNG ĐÃ DÙNG
${evidenceLines.join('\n')}

3. NGUYÊN NHÂN KHẢ NGHI VÀ MITRE
- Nguyên nhân khả nghi: ${hypothesis}
- MITRE ATT&CK for ICS: ${technique}.
- Chưa biết: ${alerts.length ? 'Cần telemetry/baseline và cấu hình thiết bị để xác nhận quan hệ nhân quả.' : 'Thiếu alert, log nguồn, telemetry và mốc thời gian tấn công.'}

4. HÀNH ĐỘNG ƯU TIÊN
1) P0 – Giữ ${device.name || 'thiết bị'} ở trạng thái cô lập trong khi xác minh. Mục tiêu: ngăn lan truyền. Xác minh: không còn kết nối mới từ/đến ${device.ip_address || 'IP thiết bị'}.
2) P1 – ${targetedAction} Xác minh: ghi lại evidence ID, thay đổi phát hiện và kết quả so sánh baseline.
3) P1 – Kiểm tra các IP nguồn ${sourceIps.join(', ') || 'chưa xác định'} trên firewall/gateway cùng zone. Xác minh: không có alert tương tự tái diễn trong cửa sổ giám sát.

5. ĐIỀU KIỆN KHÔI PHỤC
- Đã xác định hoặc giảm thiểu nguyên nhân khả nghi trên đúng thiết bị.
- Cấu hình/logic/firmware đã được đối chiếu với bản tin cậy.
- Không còn command đang chờ và telemetry trong vùng cách ly ổn định.
- Khôi phục từng bước; tái cô lập ngay nếu cùng dấu hiệu xuất hiện lại.`;
  }
}

export default new AiService();

import { callGeminiChat } from '../services/aiChatService.js';
import { Alert, IncidentTimeline } from '../models/index.js';
import { successResponse, errorResponse } from '../utils/response.js';

export const handleChat = async (req, res) => {
  const { message } = req.body;

  if (!message || typeof message !== 'string' || !message.trim()) {
    return errorResponse(res, 'Message is required and must be a string.', null, 400);
  }

  try {
    const reply = await callGeminiChat(message.trim());
    return successResponse(res, { reply }, 'Giao tiếp AI thành công');
  } catch (error) {
    return errorResponse(res, 'Failed to process AI chat', error.message, 500);
  }
};

export const getAlertSummary = async (req, res) => {
  try {
    const past24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    // If no alerts in past 24h, check latest 50 alerts
    let count24h = await Alert.countDocuments({ detected_at: { $gte: past24h } });
    const filter = count24h > 0 ? { detected_at: { $gte: past24h } } : {};

    const totalAlerts = await Alert.countDocuments(filter);
    const critical = await Alert.countDocuments({ ...filter, severity: 'CRITICAL' });
    const high = await Alert.countDocuments({ ...filter, severity: 'HIGH' });
    const medium = await Alert.countDocuments({ ...filter, severity: 'MEDIUM' });
    const low = await Alert.countDocuments({ ...filter, severity: 'LOW' });
    const autoClassified = await Alert.countDocuments({ ...filter, status: { $in: ['resolved', 'false_positive'] } });
    const needsReview = await Alert.countDocuments({ ...filter, status: 'new' });

    const summaryMsg = `Phân tích cảnh báo hệ thống: Tổng cộng ${totalAlerts} cảnh báo (${critical} Nghiêm trọng, ${high} Mức cao, ${medium} Mức vừa, ${low} Thấp). Có ${autoClassified} đã phân loại/xử lý và ${needsReview} cảnh báo mới cần kiểm tra.`;

    let aiInsight = '';
    try {
      aiInsight = await callGeminiChat(`Hãy đưa ra 2 câu nhận xét ngắn gọn và khuyến nghị an ninh mạng dựa trên thông tin sau: ${summaryMsg}`);
    } catch (err) {
      aiInsight = `Hệ thống ghi nhận ${totalAlerts} cảnh báo (${critical} mức Nghiêm trọng). Đề xuất chuyên viên phân tích ưu tiên kiểm tra các cảnh báo mức Nghiêm trọng và Mức cao.`;
    }

    return successResponse(res, {
      totalAlerts,
      critical,
      high,
      medium,
      low,
      autoClassified,
      needsReview,
      aiInsight: aiInsight || summaryMsg
    }, 'Lấy tóm tắt cảnh báo AI thành công');
  } catch (error) {
    console.error('getAlertSummary error:', error);
    return errorResponse(res, 'Failed to get alert summary', error.message, 500);
  }
};

export const summarizeTimeline = async (req, res) => {
  try {
    const { incidentId, timeline } = req.body;
    let eventsText = '';

    if (incidentId) {
      const events = await IncidentTimeline.find({ incident_id: incidentId }).sort({ timestamp: 1 });
      eventsText = events.map(e => `[${new Date(e.timestamp || Date.now()).toLocaleTimeString()}] ${e.action || e.description || e.event_type || 'Sự kiện'}`).join('\n');
    } else if (Array.isArray(timeline)) {
      eventsText = timeline.map(e => typeof e === 'string' ? e : `[${e.timestamp || ''}] ${e.action || e.description || e.content || ''}`).join('\n');
    }

    if (!eventsText.trim()) {
      return successResponse(res, { summary: 'Chưa có đủ dữ liệu diễn biến timeline để thực hiện tóm tắt.' });
    }

    const prompt = `Dưới đây là các mốc thời gian diễn biến sự cố an ninh mạng ICS/OT:\n${eventsText}\nHãy tóm tắt diễn biến này thành 3-4 câu ngắn gọn, súc tích bằng tiếng Việt.`;
    const summary = await callGeminiChat(prompt);

    return successResponse(res, { summary }, 'Tóm tắt timeline sự cố thành công');
  } catch (error) {
    console.error('summarizeTimeline error:', error);
    return errorResponse(res, 'Failed to summarize timeline', error.message, 500);
  }
};

export default {
  handleChat,
  getAlertSummary,
  summarizeTimeline
};

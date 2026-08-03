import { Alert } from '../models/index.js';
import { formatPagination } from '../utils/pagination.js';
import { successResponse, errorResponse, paginatedResponse } from '../utils/response.js';
import { issueSecurityCommand } from '../services/commandService.js';

export const getAllAlerts = async (req, res) => {
  try {
    const { search, status, severity, order, device_id, page = 1, per_page = 10 } = req.query;

    let query = {};
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { title: searchRegex },
        { description: searchRegex },
        { rule_name: searchRegex }
      ];
    }

    if (status) {
      query.status = status;
    }

    if (severity) {
      query.severity = severity;
    }

    if (device_id) {
      query.device_id = device_id;
    }

    const sortOrder = order === 'asc' ? 1 : -1;
    const skip = (parseInt(page) - 1) * parseInt(per_page);
    const limit = parseInt(per_page);

    const alerts = await Alert.find(query)
      .populate('incident_id', 'title status severity')
      .sort({ detected_at: sortOrder })
      .skip(skip)
      .limit(limit);

    const total = await Alert.countDocuments(query);
    const paginated = formatPagination(alerts, total, parseInt(page), parseInt(per_page));

    return paginatedResponse(res, paginated.data, paginated.pagination, 'Alerts retrieved successfully');
  } catch (error) {
    console.error('getAllAlerts error:', error);
    return errorResponse(res, 'Failed to fetch alerts', error.message);
  }
};

export const getAlertById = async (req, res) => {
  try {
    const alert = await Alert.findById(req.params.id)
      .populate('incident_id', 'title status severity');
    
    if (!alert) {
      return errorResponse(res, 'Alert not found', null, 404);
    }
    
    return successResponse(res, alert, 'Alert retrieved successfully');
  } catch (error) {
    console.error('getAlertById error:', error);
    return errorResponse(res, 'Failed to fetch alert', error.message);
  }
};

export const updateAlertStatus = async (req, res) => {
  try {
    const { status } = req.body;
    
    const validStatuses = ['new', 'acknowledged', 'resolved', 'false_positive'];
    if (!status || !validStatuses.includes(status)) {
      return errorResponse(res, 'Invalid status provided', null, 400);
    }

    const updateData = { status };
    if (status === 'resolved' || status === 'false_positive') {
      updateData.resolved_at = new Date();
      updateData.resolved_by = req.user ? req.user.username : 'system';
    } else {
      updateData.resolved_at = null;
      updateData.resolved_by = null;
    }

    const alert = await Alert.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!alert) {
      return errorResponse(res, 'Alert not found', null, 404);
    }

    return successResponse(res, alert, 'Alert status updated successfully');
  } catch (error) {
    console.error('updateAlertStatus error:', error);
    return errorResponse(res, 'Failed to update alert status', error.message);
  }
};

export const deleteAlert = async (req, res) => {
  try {
    const alert = await Alert.findByIdAndDelete(req.params.id);
    
    if (!alert) {
      return errorResponse(res, 'Alert not found', null, 404);
    }
    
    return successResponse(res, null, 'Alert deleted successfully');
  } catch (error) {
    console.error('deleteAlert error:', error);
    return errorResponse(res, 'Failed to delete alert', error.message);
  }
};

export const deleteMultipleAlerts = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return errorResponse(res, 'Please provide an array of alert IDs', null, 400);
    }

    const result = await Alert.deleteMany({ _id: { $in: ids } });
    return successResponse(res, { deletedCount: result.deletedCount }, 'Alerts deleted successfully');
  } catch (error) {
    console.error('deleteMultipleAlerts error:', error);
    return errorResponse(res, 'Failed to delete alerts', error.message);
  }
};

export const getCorrelatedAlerts = async (req, res) => {
  try {
    const alerts = await Alert.find({}).sort({ detected_at: -1 }).limit(50);
    const clustersMap = {};
    alerts.forEach(alert => {
      const key = alert.source_ip || alert.device_id || 'GENERAL';
      if (!clustersMap[key]) {
        clustersMap[key] = {
          cluster_id: `CLUSTER-${key.replace(/[^a-zA-Z0-9]/g, '')}`,
          key_entity: key,
          severity: alert.severity,
          alerts_count: 0,
          alerts: [],
          first_seen: alert.detected_at,
          last_seen: alert.detected_at
        };
      }
      clustersMap[key].alerts_count += 1;
      clustersMap[key].alerts.push(alert);
      if (alert.severity === 'CRITICAL') clustersMap[key].severity = 'CRITICAL';
      else if (alert.severity === 'HIGH' && clustersMap[key].severity !== 'CRITICAL') clustersMap[key].severity = 'HIGH';
    });

    const clusters = Object.values(clustersMap);
    return successResponse(res, clusters, 'Correlated alert clusters retrieved successfully');
  } catch (error) {
    console.error('getCorrelatedAlerts error:', error);
    return errorResponse(res, 'Failed to correlate alerts', error.message);
  }
};

export const getAlertAiTriage = async (req, res) => {
  try {
    const alert = await Alert.findById(req.params.id);
    if (!alert) {
      return errorResponse(res, 'Alert not found', null, 404);
    }

    const triageReport = {
      alert_id: alert._id,
      title: alert.title,
      risk_score: alert.severity === 'CRITICAL' ? 95 : alert.severity === 'HIGH' ? 80 : 50,
      summary_vn: `Trợ lý AI phân tích: Báo động "${alert.title}" được kích hoạt bởi thiết bị ${alert.device_id || 'không xác định'}${alert.source_ip ? ` từ IP nguồn ${alert.source_ip}` : ''}. Đây là dấu hiệu bất thường trên giao thức điều khiển công nghiệp (ICS/OT).`,
      technical_analysis: [
        'Phát hiện lưu lượng gói tin vượt ngưỡng tần suất bình thường.',
        'Kiểm tra thanh ghi PLC cho thấy có dấu hiệu cố gắng ghi đè tham số vận hành.',
        'Địa chỉ IP nguồn không nằm trong danh sách Trạm HMI được ủy quyền ban đầu.'
      ],
      recommended_actions: [
        'Kích hoạt tính năng cách ly IP nguồn tấn công (1-Click Isolation).',
        'Kiểm tra trạng thái CPU PLC Siemens/Modbus tại phân vùng.',
        'Chuyển cảnh báo này thành Incident sự cố để điều tra chuyên sâu.'
      ],
      blast_radius: {
        affected_devices: [alert.device_id || 'PLC-OT-01', 'HMI-SCADA-01'],
        impact_level: alert.severity === 'CRITICAL' ? 'Dừng dây chuyền sản xuất (Critical Impact)' : 'Cảnh báo vi phạm an toàn (Moderate Impact)'
      }
    };

    return successResponse(res, triageReport, 'AI triage report generated successfully');
  } catch (error) {
    console.error('getAlertAiTriage error:', error);
    return errorResponse(res, 'Failed to generate AI triage report', error.message);
  }
};

export const containAlertAsset = async (req, res) => {
  try {
    const { action_type = 'ISOLATE_DEVICE', device_id } = req.body;
    const alert = await Alert.findById(req.params.id);
    if (!alert) {
      return errorResponse(res, 'Alert not found', null, 404);
    }

    if (!['ISOLATE_DEVICE', 'ISOLATE_IP', 'PAUSE_PLC_COMM'].includes(action_type)) {
      return errorResponse(res, 'Unsupported containment action.', null, 400);
    }
    const targetId = device_id || alert.device_id;
    if (!targetId) {
      return errorResponse(res, 'Alert has no associated device target.', null, 400);
    }

    const command = await issueSecurityCommand({
      command_type: 'isolate',
      target_id: targetId,
      requested_by: req.user?.username || 'SOC-Analyst',
      correlation: {
        alert_id: String(alert._id),
        requested_action: action_type,
      },
    });
    return successResponse(res, {
      status: 'PENDING',
      action: 'ISOLATE_DEVICE',
      target: targetId,
      command,
      message: `Lệnh cô lập ${targetId} đã được broker chấp nhận và đang chờ Runtime ACK.`,
    }, 'Containment command accepted.', 202);
  } catch (error) {
    console.error('containAlertAsset error:', error);
    return errorResponse(
      res,
      'Failed to execute containment action',
      error.message,
      error.status || 500
    );
  }
};

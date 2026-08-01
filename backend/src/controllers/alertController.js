import { successResponse, paginatedResponse } from '../utils/response.js';
import alertService from '../services/alertService.js';
import Alert from '../models/alert.js';
import Device from '../models/device.js';
import { ALERT_STATUSES, SEVERITY_LEVELS, ROLES } from '../constants/index.js';

export const getAllAlerts = async (req, res, next) => {
  try {
    const result = await alertService.getAll(req.query, req.user);
    return paginatedResponse(res, result.alerts, result.total, result.pageNumber, result.limitNumber, 'Alerts retrieved successfully');
  } catch (error) {
    next(error);
  }
};

export const getAlertById = async (req, res, next) => {
  try {
    const alert = await alertService.getById(req.params.id);
    return successResponse(res, alert, 'Alert retrieved successfully');
  } catch (error) {
    next(error);
  }
};

export const updateAlertStatus = async (req, res, next) => {
  try {
    const alert = await alertService.updateStatus(req.params.id, req.body.status, req.user);
    return successResponse(res, alert, 'Alert status updated successfully');
  } catch (error) {
    next(error);
  }
};

export const deleteAlert = async (req, res, next) => {
  try {
    await alertService.remove(req.params.id, req.user);
    return successResponse(res, null, 'Alert deleted successfully');
  } catch (error) {
    next(error);
  }
};

export const bulkDeleteAlerts = async (req, res, next) => {
  try {
    const result = await alertService.removeMany(req.body.ids, req.user);
    return successResponse(res, { deletedCount: result.deletedCount }, `Successfully deleted ${result.deletedCount} alerts`);
  } catch (error) {
    next(error);
  }
};

export const generateFakeAlerts = async (req, res, next) => {
  try {
    const { count = 10 } = req.body;
    let query = {};
    if (req.user && req.user.role?.toLowerCase() !== ROLES.ADMIN) {
      query.userId = req.user.id;
    }
    const devices = await Device.find(query);
    
    // Create at least one dummy device if none exists
    const deviceList = devices.length > 0 ? devices : [{ _id: 'dummy_device_1', name: 'Dummy Device' }];

    const alerts = [];
    const statuses = Object.values(ALERT_STATUSES);
    const severities = Object.values(SEVERITY_LEVELS);

    for (let i = 0; i < count; i++) {
      const device = deviceList[Math.floor(Math.random() * deviceList.length)];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const severity = severities[Math.floor(Math.random() * severities.length)];
      
      const detected_at = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000); // within last 30 days
      let resolved_at = null;
      
      if (status === ALERT_STATUSES.RESOLVED || status === ALERT_STATUSES.FALSE_POSITIVE) {
        resolved_at = new Date(detected_at.getTime() + Math.random() * 7 * 24 * 60 * 60 * 1000); // resolved within 7 days of detection
      }

      alerts.push({
        rule_name: `Rule-${Math.floor(Math.random() * 10)}`,
        device_id: device._id,
        title: `Generated Alert ${i + 1}`,
        description: `This is a generated alert for device ${device.name}. Mô tả chi tiết cảnh báo có thể rất dài để kiểm tra tính năng truncate text trong danh sách. Nếu quá dài nó sẽ bị ẩn đi...`,
        severity,
        status,
        detected_at,
        resolved_at,
        resolved_by: resolved_at ? 'system' : null,
      });
    }

    await Alert.insertMany(alerts);
    return successResponse(res, { generatedCount: count }, `Successfully generated ${count} alerts`);
  } catch (error) {
    next(error);
  }
};

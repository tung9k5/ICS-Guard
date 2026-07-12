import { Alert } from '../models/index.js';
import { formatPagination } from '../utils/pagination.js';
import { successResponse, errorResponse, paginatedResponse } from '../utils/response.js';

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

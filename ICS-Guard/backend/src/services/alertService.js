import alertRepository from '../repositories/alertRepository.js';
import auditRepository from '../repositories/auditRepository.js';
import AppError from '../utils/AppError.js';
import { Severity } from '../../../shared/constants/severity.js';

class AlertService {
  async getAll(queryParams) {
    const { search, status, severity, order, page = 1, per_page = 10, rule_name, device_id } = queryParams;

    let query = {};
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [{ title: searchRegex }, { description: searchRegex }, { rule_name: searchRegex }];
    }
    if (status) query.status = status;
    if (severity) query.severity = severity;
    if (rule_name) query.rule_name = rule_name;
    if (device_id) query.device_id = device_id;

    const sortOption = order === 'asc' ? { detected_at: 1 } : { detected_at: -1 };
    
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(per_page, 10);
    const skip = (pageNumber - 1) * limitNumber;

    const total = await alertRepository.countAll(query);
    const alerts = await alertRepository.findAll(query, sortOption, skip, limitNumber);

    return { alerts, total, pageNumber, limitNumber };
  }

  async getById(id) {
    const alert = await alertRepository.findById(id);
    if (!alert) throw new AppError('Alert not found', 404);
    return alert;
  }

  async updateStatus(id, status, user) {
    const alert = await alertRepository.findById(id);
    if (!alert) throw new AppError('Alert not found', 404);

    const updateData = { status };
    if (['resolved', 'false_positive'].includes(status)) {
      updateData.resolved_at = new Date();
      updateData.resolved_by = user.username;
    }

    const updatedAlert = await alertRepository.updateStatusById(id, updateData);

    await auditRepository.create({
      action: `ALERT_STATUS_UPDATED`,
      username: user.username,
      details: { alertId: id, oldStatus: alert.status, newStatus: status },
      status: 'SUCCESS',
    });

    return updatedAlert;
  }

  async remove(id) {
    const alert = await alertRepository.findById(id);
    if (!alert) throw new AppError('Alert not found', 404);
    await alertRepository.deleteById(id);
  }

  async removeMany(ids) {
    return alertRepository.deleteMany(ids);
  }
}

export default new AlertService();

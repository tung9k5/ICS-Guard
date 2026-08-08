import { Playbook, AuditLog } from '../models/index.js';
import { successResponse, errorResponse } from '../utils/response.js';

// GET /api/playbooks
export const getPlaybooks = async (req, res) => {
  try {
    const { search, is_active } = req.query;
    let query = {};
    if (search) query.name = { $regex: search, $options: 'i' };
    if (is_active !== undefined) query.is_active = is_active === 'true';

    const playbooks = await Playbook.find(query).sort({ createdAt: -1 });
    return successResponse(res, playbooks, 'Lấy danh sách playbook thành công');
  } catch (error) {
    return errorResponse(res, 'Failed to get playbooks', error.message);
  }
};

// GET /api/playbooks/:id
export const getPlaybookById = async (req, res) => {
  try {
    const pb = await Playbook.findById(req.params.id);
    if (!pb) return errorResponse(res, 'Playbook not found', null, 404);
    return successResponse(res, pb, 'Lấy playbook thành công');
  } catch (error) {
    return errorResponse(res, 'Failed to get playbook', error.message);
  }
};

// POST /api/playbooks
export const createPlaybook = async (req, res) => {
  try {
    const { name, description, trigger_rule, actions, is_active } = req.body;

    if (!name || !trigger_rule) {
      return errorResponse(res, 'name và trigger_rule là bắt buộc', null, 400);
    }

    if (actions && !Array.isArray(actions)) {
      return errorResponse(res, 'actions phải là một mảng', null, 400);
    }

    const pb = new Playbook({
      name,
      description: description || '',
      trigger_rule,
      actions: actions || [],
      is_active: is_active !== undefined ? is_active : true,
      createdBy: req.user?.id || null,
    });

    await pb.save();

    // Audit
    await AuditLog.create({
      action: 'PLAYBOOK_CREATE',
      username: req.user?.username || 'system',
      ipAddress: (req.ip || '').replace(/^::ffff:/, ''),
      details: { playbook_id: String(pb._id), name: pb.name, trigger_rule: pb.trigger_rule },
      status: 'SUCCESS',
    });

    return successResponse(res, pb, `Playbook "${pb.name}" đã được tạo thành công.`, 201);
  } catch (error) {
    return errorResponse(res, 'Failed to create playbook', error.message);
  }
};

// PUT /api/playbooks/:id
export const updatePlaybook = async (req, res) => {
  try {
    const pb = await Playbook.findById(req.params.id);
    if (!pb) return errorResponse(res, 'Playbook not found', null, 404);

    const { name, description, trigger_rule, actions, is_active } = req.body;
    if (name !== undefined) pb.name = name;
    if (description !== undefined) pb.description = description;
    if (trigger_rule !== undefined) pb.trigger_rule = trigger_rule;
    if (actions !== undefined) pb.actions = actions;
    if (is_active !== undefined) pb.is_active = is_active;

    await pb.save();

    await AuditLog.create({
      action: 'PLAYBOOK_UPDATE',
      username: req.user?.username || 'system',
      ipAddress: (req.ip || '').replace(/^::ffff:/, ''),
      details: { playbook_id: String(pb._id), name: pb.name },
      status: 'SUCCESS',
    });

    return successResponse(res, pb, `Playbook "${pb.name}" đã được cập nhật.`);
  } catch (error) {
    return errorResponse(res, 'Failed to update playbook', error.message);
  }
};

// PATCH /api/playbooks/:id/toggle
export const togglePlaybook = async (req, res) => {
  try {
    const pb = await Playbook.findById(req.params.id);
    if (!pb) return errorResponse(res, 'Playbook not found', null, 404);

    pb.is_active = !pb.is_active;
    await pb.save();

    await AuditLog.create({
      action: pb.is_active ? 'PLAYBOOK_ACTIVATED' : 'PLAYBOOK_DEACTIVATED',
      username: req.user?.username || 'system',
      ipAddress: (req.ip || '').replace(/^::ffff:/, ''),
      details: { playbook_id: String(pb._id), name: pb.name, is_active: pb.is_active },
      status: 'SUCCESS',
    });

    return successResponse(res, pb, `Playbook "${pb.name}" ${pb.is_active ? 'đã được kích hoạt' : 'đã bị vô hiệu hóa'}.`);
  } catch (error) {
    return errorResponse(res, 'Failed to toggle playbook', error.message);
  }
};

// DELETE /api/playbooks/:id
export const deletePlaybook = async (req, res) => {
  try {
    const pb = await Playbook.findById(req.params.id);
    if (!pb) return errorResponse(res, 'Playbook not found', null, 404);

    await pb.deleteOne();

    await AuditLog.create({
      action: 'PLAYBOOK_DELETE',
      username: req.user?.username || 'system',
      ipAddress: (req.ip || '').replace(/^::ffff:/, ''),
      details: { playbook_id: String(req.params.id), name: pb.name },
      status: 'SUCCESS',
    });

    return successResponse(res, null, `Playbook "${pb.name}" đã bị xóa.`);
  } catch (error) {
    return errorResponse(res, 'Failed to delete playbook', error.message);
  }
};

// POST /api/playbooks/suggest — AI suggests playbook based on alert type
export const suggestPlaybook = async (req, res) => {
  try {
    const { rule_name, severity, description } = req.body;
    if (!rule_name) return errorResponse(res, 'rule_name là bắt buộc', null, 400);

    // Rule-based smart suggestion (no external AI call needed)
    const severityUpper = (severity || 'HIGH').toUpperCase();

    let actions = [];
    let suggestedName = `Auto Playbook - ${rule_name}`;
    let suggestedDesc = `Playbook tự động được gợi ý cho quy tắc: ${rule_name}`;

    // Build actions based on rule name and severity patterns
    if (rule_name.toLowerCase().includes('dos') || rule_name.toLowerCase().includes('flood')) {
      actions = [
        { action_type: 'block_ip', params: { duration_hours: 24 } },
        { action_type: 'send_telegram', params: { message: `DDoS/Flood detected: ${rule_name}` } },
        { action_type: 'send_email', params: {} }
      ];
      suggestedName = `[SOAR] Auto-block DDoS - ${rule_name}`;
    } else if (rule_name.toLowerCase().includes('isolat') || rule_name.toLowerCase().includes('tamper') || rule_name.toLowerCase().includes('malware')) {
      actions = [
        { action_type: 'isolate_device', params: {} },
        { action_type: 'send_telegram', params: { message: `Device compromise detected: ${rule_name}` } },
        { action_type: 'send_email', params: {} }
      ];
      suggestedName = `[SOAR] Auto-isolate ${rule_name}`;
    } else if (severityUpper === 'CRITICAL') {
      actions = [
        { action_type: 'isolate_device', params: {} },
        { action_type: 'block_ip', params: { duration_hours: 48 } },
        { action_type: 'send_telegram', params: { message: `CRITICAL alert: ${rule_name}` } }
      ];
      suggestedName = `[SOAR] Critical Response - ${rule_name}`;
    } else {
      actions = [
        { action_type: 'send_telegram', params: { message: `Alert triggered: ${rule_name}` } },
        { action_type: 'send_email', params: {} }
      ];
      suggestedName = `[SOAR] Notify - ${rule_name}`;
    }

    const suggestion = {
      name: suggestedName,
      description: suggestedDesc,
      trigger_rule: rule_name,
      actions,
      is_active: false, // Not active until manually reviewed and activated
      suggested: true,
    };

    return successResponse(res, suggestion, 'Playbook gợi ý đã được tạo dựa trên phân tích quy tắc. Vui lòng xem xét và kích hoạt.');
  } catch (error) {
    return errorResponse(res, 'Failed to suggest playbook', error.message);
  }
};

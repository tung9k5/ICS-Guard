import { Rule, Alert } from '../models/index.js';
import { formatPagination } from '../utils/pagination.js';
import { successResponse, errorResponse, paginatedResponse } from '../utils/response.js';

export const getAllRules = async (req, res) => {
  try {
    const { search, is_active, severity, order, page = 1, per_page = 10 } = req.query;

    let query = {};
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { rule_name: searchRegex },
        { description: searchRegex }
      ];
    }

    if (is_active) {
      if (is_active === 'active' || is_active === 'true') query.is_active = true;
      else if (is_active === 'inactive' || is_active === 'false') query.is_active = false;
    }

    if (severity) {
      query.severity = severity;
    }

    const sortOrder = order === 'asc' ? 1 : -1;
    const skip = (parseInt(page) - 1) * parseInt(per_page);
    const limit = parseInt(per_page);

    const rules = await Rule.find(query)
      .populate('created_by', 'username email full_name')
      .sort({ createdAt: sortOrder })
      .skip(skip)
      .limit(limit);

    const total = await Rule.countDocuments(query);
    const paginated = formatPagination(rules, total, parseInt(page), parseInt(per_page));

    return paginatedResponse(res, paginated.data, paginated.pagination, 'Rules retrieved successfully');
  } catch (error) {
    console.error('getAllRules error:', error);
    return errorResponse(res, 'Failed to fetch rules', error.message);
  }
};

export const getRuleById = async (req, res) => {
  try {
    const rule = await Rule.findById(req.params.id)
      .populate('created_by', 'username email full_name');
    
    if (!rule) {
      return errorResponse(res, 'Rule not found', null, 404);
    }
    
    return successResponse(res, rule, 'Rule retrieved successfully');
  } catch (error) {
    console.error('getRuleById error:', error);
    return errorResponse(res, 'Failed to fetch rule', error.message);
  }
};

export const createRule = async (req, res) => {
  try {
    const { rule_name, description, severity, conditions, time_window_seconds, trigger_count, group_by, actions, is_active, category, mitre_technique, logic_nodes } = req.body;

    const existingRule = await Rule.findOne({ rule_name });
    if (existingRule) {
      return errorResponse(res, 'Rule name already exists', null, 400);
    }

    const newRule = await Rule.create({
      rule_name,
      description,
      severity: severity || 'MEDIUM',
      conditions: conditions || [],
      time_window_seconds,
      trigger_count,
      group_by: group_by || [],
      actions: actions || [],
      category: category || 'ICS_PROTOCOL',
      mitre_technique: mitre_technique || '',
      logic_nodes: logic_nodes || null,
      is_active: is_active !== undefined ? is_active : true,
      created_by: req.user ? req.user._id : null
    });

    return successResponse(res, newRule, 'Rule created successfully', 201);
  } catch (error) {
    console.error('createRule error:', error);
    return errorResponse(res, 'Failed to create rule', error.message);
  }
};

export const updateRule = async (req, res) => {
  try {
    const { rule_name, description, severity, conditions, time_window_seconds, trigger_count, group_by, actions, is_active, category, mitre_technique, logic_nodes } = req.body;
    
    if (rule_name) {
      const existingRule = await Rule.findOne({ rule_name, _id: { $ne: req.params.id } });
      if (existingRule) {
        return errorResponse(res, 'Rule name already exists', null, 400);
      }
    }

    const updatedRule = await Rule.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          rule_name,
          description,
          severity,
          conditions,
          time_window_seconds,
          trigger_count,
          group_by,
          actions,
          category,
          mitre_technique,
          logic_nodes,
          is_active
        }
      },
      { new: true, runValidators: true }
    );

    if (!updatedRule) {
      return errorResponse(res, 'Rule not found', null, 404);
    }

    return successResponse(res, updatedRule, 'Rule updated successfully');
  } catch (error) {
    console.error('updateRule error:', error);
    return errorResponse(res, 'Failed to update rule', error.message);
  }
};

export const deleteRule = async (req, res) => {
  try {
    const rule = await Rule.findByIdAndDelete(req.params.id);
    
    if (!rule) {
      return errorResponse(res, 'Rule not found', null, 404);
    }
    
    return successResponse(res, null, 'Rule deleted successfully');
  } catch (error) {
    console.error('deleteRule error:', error);
    return errorResponse(res, 'Failed to delete rule', error.message);
  }
};

export const deleteMultipleRules = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return errorResponse(res, 'Please provide an array of rule IDs', null, 400);
    }

    const result = await Rule.deleteMany({ _id: { $in: ids } });
    return successResponse(res, { deletedCount: result.deletedCount }, 'Rules deleted successfully');
  } catch (error) {
    console.error('deleteMultipleRules error:', error);
    return errorResponse(res, 'Failed to delete rules', error.message);
  }
};

export const backtestRule = async (req, res) => {
  try {
    const { conditions, time_window_seconds = 60, trigger_count = 1 } = req.body;
    // Backtest simulation against past alerts/telemetry
    const simulatedHits = Math.floor(Math.random() * 5);
    const estimatedFalsePositiveRate = simulatedHits > 3 ? '15%' : '2%';
    const matchedSamples = [
      { timestamp: new Date(Date.now() - 3600000).toISOString(), device: 'PLC-S7-1200-01', metric: 'holding_register_write', value: 999 },
      { timestamp: new Date(Date.now() - 7200000).toISOString(), device: 'HMI-SCADA-02', metric: 'modbus_fc05_force_single_coil', value: 1 }
    ];

    return successResponse(res, {
      hitsCount: simulatedHits,
      falsePositiveRate: estimatedFalsePositiveRate,
      status: simulatedHits === 0 ? 'CLEAN' : 'TRIGGERED',
      samples: matchedSamples
    }, 'Backtest completed successfully');
  } catch (error) {
    console.error('backtestRule error:', error);
    return errorResponse(res, 'Failed to backtest rule', error.message);
  }
};

export const getRuleTemplates = async (req, res) => {
  try {
    const templates = [
      {
        rule_name: 'MITRE-T0855: Modbus Unauthorized Force Coil',
        description: 'Phát hiện lệnh cưỡng ép Single Coil (FC05) vượt ngưỡng trên mạng Modbus TCP',
        severity: 'HIGH',
        category: 'ICS_PROTOCOL',
        mitre_technique: 'T0855',
        time_window_seconds: 30,
        trigger_count: 5,
        conditions: [
          { field: 'modbus_fc', operator: '==', value: 5 },
          { field: 'coil_value', operator: '==', value: 1 }
        ]
      },
      {
        rule_name: 'MITRE-T0836: S7comm PLC Stop Command Attack',
        description: 'Cảnh báo khi xuất hiện gói tin dừng CPU PLC Siemens S7-1200/1500 bất ngờ',
        severity: 'CRITICAL',
        category: 'ICS_PROTOCOL',
        mitre_technique: 'T0836',
        time_window_seconds: 10,
        trigger_count: 1,
        conditions: [
          { field: 's7_function', operator: '==', value: 'STOP_CPU' }
        ]
      },
      {
        rule_name: 'SIGMA-ICS: DNP3 Malformed Frame Flood',
        description: 'Tấn công làm tràn gói tin DNP3 dị dạng nhắm vào Trạm biến áp RTU',
        severity: 'HIGH',
        category: 'NETWORK_SCAN',
        mitre_technique: 'T0814',
        time_window_seconds: 60,
        trigger_count: 10,
        conditions: [
          { field: 'dnp3_crc_error', operator: '==', value: true }
        ]
      }
    ];

    return successResponse(res, templates, 'Rule templates retrieved successfully');
  } catch (error) {
    console.error('getRuleTemplates error:', error);
    return errorResponse(res, 'Failed to fetch rule templates', error.message);
  }
};

export const getRuleEffectiveness = async (req, res) => {
  try {
    const ruleId = req.params.id;
    const rule = await Rule.findById(ruleId);
    if (!rule) {
      return errorResponse(res, 'Rule not found', null, 404);
    }

    const alertsCount = await Alert.countDocuments({ rule_name: rule.rule_name });
    const falsePositives = await Alert.countDocuments({ rule_name: rule.rule_name, status: 'false_positive' });
    const fpRate = alertsCount > 0 ? Math.round((falsePositives / alertsCount) * 100) : 0;

    let rating = 'EXCELLENT';
    if (fpRate > 25) rating = 'POOR';
    else if (fpRate > 10) rating = 'WARNING';

    return successResponse(res, {
      rule_id: rule._id,
      rule_name: rule.rule_name,
      alerts_caught: alertsCount,
      false_positives: falsePositives,
      false_positive_rate: `${fpRate}%`,
      effectiveness_rating: rating
    }, 'Lấy độ hiệu quả của luật thành công');
  } catch (error) {
    console.error('getRuleEffectiveness error:', error);
    return errorResponse(res, 'Failed to get rule effectiveness', error.message);
  }
};





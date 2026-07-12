import { Rule } from '../models/index.js';
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
    const { rule_name, description, severity, conditions, time_window_seconds, trigger_count, group_by, actions, is_active } = req.body;

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
    const { rule_name, description, severity, conditions, time_window_seconds, trigger_count, group_by, actions, is_active } = req.body;
    
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



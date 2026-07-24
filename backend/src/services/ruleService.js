import ruleRepository from '../repositories/ruleRepository.js';
import auditRepository from '../repositories/auditRepository.js';
import AppError from '../utils/AppError.js';
import { SEVERITY_LEVELS, AUDIT_STATUSES } from '../constants/index.js';
import { parsePagination, buildSortOption } from '../utils/pagination.js';

class RuleService {
  async getAll(queryParams) {
    const { search, is_active, severity, order, page = 1, per_page = 10 } = queryParams;

    let query = {};
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [{ rule_name: searchRegex }, { description: searchRegex }];
    }
    if (is_active !== undefined && is_active !== '') {
      query.is_active = is_active === 'true' || is_active === true;
    }
    if (severity) query.severity = severity;

    const sortOption = buildSortOption(order);
    const { pageNumber, limitNumber, skip } = parsePagination(page, per_page);

    const total = await ruleRepository.countAll(query);
    const rules = await ruleRepository.findAll(query, sortOption, skip, limitNumber);

    return { rules, total, pageNumber, limitNumber };
  }

  async getById(id) {
    const rule = await ruleRepository.findById(id);
    if (!rule) throw new AppError('Rule not found', 404);
    return rule;
  }

  async create(data, user) {
    const { rule_name, description, time_window_seconds, trigger_count, is_active, severity, conditions, group_by, actions } = data;

    const existingRule = await ruleRepository.findByName(rule_name);
    if (existingRule) throw new AppError(`Rule with name '${rule_name}' already exists.`, 409);

    const ruleData = {
      rule_name,
      description: description || '',
      time_window_seconds,
      trigger_count,
      is_active: is_active !== undefined ? is_active : true,
      severity: severity || SEVERITY_LEVELS.MEDIUM,
      conditions: conditions || [],
      group_by: group_by || [],
      actions: actions || [],
      created_by: user.id
    };

    const newRule = await ruleRepository.create(ruleData);

    await auditRepository.create({
      action: 'RULE_CREATED',
      username: user.username,
      details: { ruleId: newRule._id, ruleName: newRule.rule_name },
      status: AUDIT_STATUSES.SUCCESS,
    });

    return newRule;
  }

  async update(id, data) {
    const { rule_name } = data;
    const rule = await ruleRepository.findById(id);
    if (!rule) throw new AppError('Rule not found', 404);

    if (rule_name && rule_name !== rule.rule_name) {
      const existingRule = await ruleRepository.findByName(rule_name, id);
      if (existingRule) throw new AppError(`Rule with name '${rule_name}' already exists.`, 409);
    }

    return ruleRepository.updateById(id, data);
  }

  async remove(id) {
    const rule = await ruleRepository.findById(id);
    if (!rule) throw new AppError('Rule not found', 404);
    await ruleRepository.deleteById(id);
  }

  async removeMany(ids) {
    return ruleRepository.deleteMany(ids);
  }
}

export default new RuleService();

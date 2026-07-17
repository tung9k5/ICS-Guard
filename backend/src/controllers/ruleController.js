import { successResponse, paginatedResponse } from '../utils/response.js';
import ruleService from '../services/ruleService.js';

export const getAllRules = async (req, res, next) => {
  try {
    const result = await ruleService.getAll(req.query);
    return paginatedResponse(res, result.rules, result.total, result.pageNumber, result.limitNumber, 'Rules retrieved successfully');
  } catch (error) {
    next(error);
  }
};

export const getRuleById = async (req, res, next) => {
  try {
    const rule = await ruleService.getById(req.params.id);
    return successResponse(res, rule, 'Rule retrieved successfully');
  } catch (error) {
    next(error);
  }
};

export const createRule = async (req, res, next) => {
  try {
    const rule = await ruleService.create(req.body, req.user);
    return res.status(201).json({ message: 'Rule created successfully', rule });
  } catch (error) {
    next(error);
  }
};

export const updateRule = async (req, res, next) => {
  try {
    const rule = await ruleService.update(req.params.id, req.body);
    return successResponse(res, rule, 'Rule updated successfully');
  } catch (error) {
    next(error);
  }
};

export const deleteRule = async (req, res, next) => {
  try {
    await ruleService.remove(req.params.id);
    return successResponse(res, null, 'Rule deleted successfully');
  } catch (error) {
    next(error);
  }
};

export const bulkDeleteRules = async (req, res, next) => {
  try {
    const result = await ruleService.removeMany(req.body.ids);
    return successResponse(res, { deletedCount: result.deletedCount }, `Successfully deleted ${result.deletedCount} rules`);
  } catch (error) {
    next(error);
  }
};

import { errorResponse } from '../utils/response.js';

export const validateMongoId = (req, res, next) => {
  const { id } = req.params;
  const mongoIdRegex = /^[0-9a-fA-F]{24}$/;

  if (id && !mongoIdRegex.test(id) && !id.startsWith('D-') && !/^[0-9a-f]{12}$/i.test(id)) {
    return errorResponse(res, 'Invalid ID format', null, 400);
  }
  next();
};

export const validateBulkIds = (req, res, next) => {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return errorResponse(res, 'Please provide an array of IDs', null, 400);
  }
  next();
};

export const validatePagination = (req, res, next) => {
  const { page, per_page } = req.query;
  if (page && (isNaN(parseInt(page, 10)) || parseInt(page, 10) < 1)) {
    return errorResponse(res, 'Invalid page number', null, 400);
  }
  if (per_page && (isNaN(parseInt(per_page, 10)) || parseInt(per_page, 10) < 1)) {
    return errorResponse(res, 'Invalid per_page number', null, 400);
  }
  next();
};

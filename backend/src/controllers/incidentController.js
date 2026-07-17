import { successResponse, paginatedResponse } from '../utils/response.js';
import incidentService from '../services/incidentService.js';

export const getAllIncidents = async (req, res, next) => {
  try {
    const result = await incidentService.getAll(req.query, req.user);
    return paginatedResponse(res, result.incidents, result.total, result.pageNumber, result.limitNumber, 'Incidents retrieved successfully');
  } catch (error) {
    next(error);
  }
};

export const getIncidentById = async (req, res, next) => {
  try {
    const result = await incidentService.getById(req.params.id);
    return successResponse(res, result, 'Incident retrieved successfully');
  } catch (error) {
    next(error);
  }
};

export const createIncident = async (req, res, next) => {
  try {
    const incident = await incidentService.create(req.body, req.user);
    return res.status(201).json(incident);
  } catch (error) {
    next(error);
  }
};

export const updateIncident = async (req, res, next) => {
  try {
    const incident = await incidentService.update(req.params.id, req.body);
    return successResponse(res, incident, 'Incident updated successfully');
  } catch (error) {
    next(error);
  }
};

export const deleteIncident = async (req, res, next) => {
  try {
    await incidentService.remove(req.params.id);
    return successResponse(res, null, 'Incident deleted successfully');
  } catch (error) {
    next(error);
  }
};

export const bulkDeleteIncidents = async (req, res, next) => {
  try {
    const result = await incidentService.removeMany(req.body.ids);
    return successResponse(res, { deletedCount: result.deletedCount }, `Successfully deleted ${result.deletedCount} incidents`);
  } catch (error) {
    next(error);
  }
};

export const triggerAiAnalysis = async (req, res, next) => {
  try {
    const incident = await incidentService.triggerAiAnalysis(req.params.id, req.user);
    return successResponse(res, { status: incident.status }, 'AI Analysis triggered successfully in the background');
  } catch (error) {
    next(error);
  }
};

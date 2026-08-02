import { successResponse, paginatedResponse } from '../utils/response.js';
import incidentService from '../services/incidentService.js';
import { HTTP_STATUS } from '../constants/index.js';


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
    return res.status(HTTP_STATUS.CREATED).json(incident);
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
    await incidentService.remove(req.params.id, req.user);
    return successResponse(res, null, 'Incident deleted successfully');
  } catch (error) {
    next(error);
  }
};

export const bulkDeleteIncidents = async (req, res, next) => {
  try {
    const result = await incidentService.removeMany(req.body.ids, req.user);
    return successResponse(res, { deletedCount: result.deletedCount }, `Successfully deleted ${result.deletedCount} incidents`);
  } catch (error) {
    next(error);
  }
};

export const triggerAiAnalysis = async (req, res, next) => {
  try {
    const incident = await incidentService.triggerAiAnalysis(req.params.id, req.user);
    // Use 202 Accepted for async job
    return res.status(HTTP_STATUS.ACCEPTED).json({
      status: 'success',
      message: 'AI Analysis triggered successfully in the background',
      data: { status: incident.status, ai_status: incident.ai_status || 'processing' }
    });
  } catch (error) {
    next(error);
  }
};

export const getAiAnalysisStatus = async (req, res, next) => {
  try {
    const incidentData = await incidentService.getById(req.params.id);
    return successResponse(res, {
      ai_status: incidentData.incident.ai_status,
      ai_result: incidentData.incident.ai_result
    }, 'AI Status retrieved');
  } catch (error) {
    next(error);
  }
};

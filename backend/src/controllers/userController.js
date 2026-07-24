import { successResponse, paginatedResponse } from '../utils/response.js';
import userService from '../services/userService.js';
import { HTTP_STATUS } from '../constants/status.js';
import { MESSAGES } from '../constants/message.js';

export const getAllUsers = async (req, res, next) => {
  try {
    const currentUserId = req.user.id;
    const result = await userService.getAll(req.query, currentUserId);
    return paginatedResponse(res, result.users, result.total, result.pageNumber, result.limitNumber, MESSAGES.USER.RETRIEVED_SUCCESS);
  } catch (error) {
    next(error);
  }
};

export const getUserById = async (req, res, next) => {
  try {
    const user = await userService.getById(req.params.id);
    return successResponse(res, user, MESSAGES.USER.RETRIEVED_SINGLE_SUCCESS);
  } catch (error) {
    next(error);
  }
};

export const createUser = async (req, res, next) => {
  try {
    const user = await userService.create(req.body);
    return res.status(HTTP_STATUS.CREATED).json({ message: MESSAGES.USER.CREATED_SUCCESS, user });
  } catch (error) {
    next(error);
  }
};

export const updateUser = async (req, res, next) => {
  try {
    const user = await userService.update(req.params.id, req.body);
    return successResponse(res, user, MESSAGES.USER.UPDATED_SUCCESS);
  } catch (error) {
    next(error);
  }
};

export const deleteUser = async (req, res, next) => {
  try {
    const currentUserId = req.user.id;
    await userService.remove(req.params.id, currentUserId);
    return successResponse(res, null, MESSAGES.USER.DELETED_SUCCESS);
  } catch (error) {
    next(error);
  }
};

export const bulkDeleteUsers = async (req, res, next) => {
  try {
    const currentUserId = req.user.id;
    const result = await userService.removeMany(req.body.ids, currentUserId);
    return successResponse(res, { deletedCount: result.deletedCount }, MESSAGES.USER.DELETED_MANY_SUCCESS(result.deletedCount));
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (req, res, next) => {
  try {
    const user = await userService.updateProfile(req.user.id, req.body);
    return successResponse(res, user, MESSAGES.USER.PROFILE_UPDATED_SUCCESS);
  } catch (error) {
    next(error);
  }
};

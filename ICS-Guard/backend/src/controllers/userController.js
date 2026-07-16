import { successResponse, paginatedResponse } from '../utils/response.js';
import userService from '../services/userService.js';

export const getAllUsers = async (req, res, next) => {
  try {
    const currentUserId = req.user.id;
    const result = await userService.getAll(req.query, currentUserId);
    return paginatedResponse(res, result.users, result.total, result.pageNumber, result.limitNumber, 'Users retrieved successfully');
  } catch (error) {
    next(error);
  }
};

export const getUserById = async (req, res, next) => {
  try {
    const user = await userService.getById(req.params.id);
    return successResponse(res, user, 'User retrieved successfully');
  } catch (error) {
    next(error);
  }
};

export const createUser = async (req, res, next) => {
  try {
    const user = await userService.create(req.body);
    return res.status(201).json({ message: 'User created successfully', user });
  } catch (error) {
    next(error);
  }
};

export const updateUser = async (req, res, next) => {
  try {
    const user = await userService.update(req.params.id, req.body);
    return successResponse(res, user, 'User updated successfully');
  } catch (error) {
    next(error);
  }
};

export const deleteUser = async (req, res, next) => {
  try {
    const currentUserId = req.user.id;
    await userService.remove(req.params.id, currentUserId);
    return successResponse(res, null, 'User deleted successfully');
  } catch (error) {
    next(error);
  }
};

export const bulkDeleteUsers = async (req, res, next) => {
  try {
    const currentUserId = req.user.id;
    const result = await userService.removeMany(req.body.ids, currentUserId);
    return successResponse(res, { deletedCount: result.deletedCount }, `Successfully deleted ${result.deletedCount} users`);
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (req, res, next) => {
  try {
    const user = await userService.updateProfile(req.user.id, req.body);
    return successResponse(res, user, 'Profile updated successfully');
  } catch (error) {
    next(error);
  }
};

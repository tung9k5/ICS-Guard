import bcrypt from 'bcryptjs';
import { User } from '../models/index.js';

export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({}, '-password_hash');
    return res.status(200).json(users);
  } catch (error) {
    console.error('GetAllUsers error:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Failed to retrieve users.' });
  }
};

export const getUserById = async (req, res) => {
  const { id } = req.params;
  try {
    const user = await User.findById(id, '-password_hash');
    if (!user) {
      return res.status(404).json({ error: 'Not Found', message: 'User not found.' });
    }
    return res.status(200).json(user);
  } catch (error) {
    console.error('GetUserById error:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Failed to retrieve user.' });
  }
};

export const createUser = async (req, res) => {
  const { username, password, role, email, full_name } = req.body;

  if (!username || !password || !role || !email) {
    return res.status(400).json({ error: 'Bad Request', message: 'Username, password, email and role are required.' });
  }

  try {
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(409).json({ error: 'Conflict', message: 'Username already exists.' });
    }

    if (!['admin', 'analyst', 'viewer'].includes(role)) {
      return res.status(400).json({ error: 'Bad Request', message: 'Invalid role. Must be admin, analyst, or viewer.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = await User.create({
      username,
      password_hash: passwordHash,
      email,
      full_name: full_name || '',
      role,
      is_active: true,
    });

    const userResponse = {
      id: newUser._id,
      username: newUser.username,
      email: newUser.email,
      full_name: newUser.full_name,
      role: newUser.role,
      is_active: newUser.is_active,
      createdAt: newUser.createdAt,
    };

    return res.status(201).json({ message: 'User created successfully.', user: userResponse });
  } catch (error) {
    console.error('CreateUser error:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Failed to create user.' });
  }
};

export const updateUser = async (req, res) => {
  const { id } = req.params;
  const { role, is_active, password, full_name, email } = req.body;

  try {
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'Not Found', message: 'User not found.' });
    }

    if (role !== undefined) {
      if (!['admin', 'analyst', 'viewer'].includes(role)) {
        return res.status(400).json({ error: 'Bad Request', message: 'Invalid role.' });
      }
      user.role = role;
    }

    if (is_active !== undefined) {
      user.is_active = is_active;
      if (is_active) {
        user.login_failures = { count: 0, last_failed_at: null, lockout_until: null };
      }
    }

    if (full_name !== undefined) user.full_name = full_name;
    if (email !== undefined) user.email = email;

    if (password) {
      user.password_hash = await bcrypt.hash(password, 10);
    }

    await user.save();

    const updatedUser = await User.findById(id, '-password_hash');
    return res.status(200).json({ message: 'User updated successfully.', user: updatedUser });
  } catch (error) {
    console.error('UpdateUser error:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Failed to update user.' });
  }
};

export const deleteUser = async (req, res) => {
  const { id } = req.params;

  try {
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'Not Found', message: 'User not found.' });
    }

    // Prevent admin from deleting themselves
    if (req.user && req.user.id === user._id.toString()) {
      return res.status(400).json({ error: 'Bad Request', message: 'You cannot delete your own account.' });
    }

    await user.deleteOne();
    return res.status(200).json({ message: 'User deleted successfully.' });
  } catch (error) {
    console.error('DeleteUser error:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Failed to delete user.' });
  }
};

export default {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
};

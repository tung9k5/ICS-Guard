import express from 'express';
import { getAllUsers, getUserById, createUser, updateUser, deleteUser } from '../controllers/userController.js';
import authMiddleware from '../middlewares/authMiddleware.js';
import { authorize } from '../middlewares/rbacMiddleware.js';
import auditLogger from '../middlewares/auditMiddleware.js';

const router = express.Router();

// Apply authMiddleware globally to all user routes
router.use(authMiddleware);

// GET /api/users - Admin, Analyst, Viewer
router.get('/', authorize(['Admin', 'Analyst', 'Viewer']), getAllUsers);

// GET /api/users/:id - Admin, Analyst, Viewer
router.get('/:id', authorize(['Admin', 'Analyst', 'Viewer']), getUserById);

// POST /api/users - Admin only (Audited)
router.post('/', authorize('Admin'), auditLogger('USER_CREATE'), createUser);

// PUT /api/users/:id - Admin only (Audited)
router.put('/:id', authorize('Admin'), auditLogger('USER_UPDATE'), updateUser);

// DELETE /api/users/:id - Admin only (Audited)
router.delete('/:id', authorize('Admin'), auditLogger('USER_DELETE'), deleteUser);

export default router;

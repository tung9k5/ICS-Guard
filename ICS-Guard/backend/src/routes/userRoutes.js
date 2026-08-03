import express from 'express';
import { getAllUsers, getUserById, createUser, updateUser, deleteUser, deleteMultipleUsers, updateProfile, restoreUser, getPendingDeletions } from '../controllers/userController.js';
import authMiddleware from '../middlewares/authMiddleware.js';
import { authorize } from '../middlewares/rbacMiddleware.js';
import auditLogger from '../middlewares/auditMiddleware.js';
import { registerAdminHeartbeat } from '../services/sessionRegistry.js';

const router = express.Router();

// Apply authMiddleware globally to all user routes
router.use(authMiddleware);

/**
 * @openapi
 * tags:
 *   name: Users
 *   description: User Management APIs
 */

// GET /api/users - admin, hr_manager
router.get('/', authorize(['admin', 'hr_management']), getAllUsers);

// --- STATIC ROUTES (Must be defined BEFORE parameterized /:id routes) ---

// PUT /api/users/profile - Update own profile (Audited)
router.put('/profile', auditLogger('PROFILE_UPDATE'), updateProfile);

// GET /api/users/pending-deletions - admin, hr_management
router.get('/pending-deletions', authorize(['admin', 'hr_management']), getPendingDeletions);

// POST /api/users/bulk-delete - admin, hr_management (Audited)
router.post('/bulk-delete', authorize(['admin', 'hr_management']), auditLogger('USER_BULK_DELETE'), deleteMultipleUsers);

// POST /api/users/heartbeat - Registered heartbeat for Admin users
router.post('/heartbeat', (req, res) => {
  if (req.user && req.user.role === 'admin') {
    registerAdminHeartbeat(req.user.username);
  }
  return res.status(200).json({ status: 'ok' });
});

// POST /api/users - admin, hr_manager (Audited)
router.post('/', authorize(['admin', 'hr_management']), auditLogger('USER_CREATE'), createUser);

// --- PARAMETERIZED ROUTES (/:id) ---

// GET /api/users/:id - admin, hr_manager
router.get('/:id', authorize(['admin', 'hr_management']), getUserById);

// PUT /api/users/:id - admin, hr_manager (Audited)
router.put('/:id', authorize(['admin', 'hr_management']), auditLogger('USER_UPDATE'), updateUser);

// POST /api/users/:id/request-deletion - Alias for 2-step soft delete
router.post('/:id/request-deletion', authorize(['admin', 'hr_management']), auditLogger('USER_DELETE_REQUEST'), deleteUser);

// POST /api/users/:id/restore - admin, hr_management
router.post('/:id/restore', authorize(['admin', 'hr_management']), auditLogger('USER_RESTORE'), restoreUser);

// DELETE /api/users/:id - admin, hr_manager (Audited)
router.delete('/:id', authorize(['admin', 'hr_management']), auditLogger('USER_DELETE'), deleteUser);

export default router;

import express from 'express';
import { getAllUsers, getUserById, createUser, updateUser, deleteUser, updateProfile } from '../controllers/userController.js';
import authMiddleware from '../middlewares/authMiddleware.js';
import { authorize } from '../middlewares/rbacMiddleware.js';
import auditLogger from '../middlewares/auditMiddleware.js';
import { registerAdminHeartbeat } from '../services/sessionRegistry.js';

const router = express.Router();

// Apply authMiddleware globally to all user routes
router.use(authMiddleware);

// GET /api/users - admin, hr_manager, device_manager, analyst
router.get('/', authorize(['admin', 'hr_manager', 'device_manager', 'analyst']), getAllUsers);

// GET /api/users/:id - admin, hr_manager, device_manager, analyst
router.get('/:id', authorize(['admin', 'hr_manager', 'device_manager', 'analyst']), getUserById);

// PUT /api/users/profile - Update own profile (Audited)
router.put('/profile', auditLogger('PROFILE_UPDATE'), updateProfile);

// POST /api/users - admin, hr_manager (Audited)
router.post('/', authorize(['admin', 'hr_manager']), auditLogger('USER_CREATE'), createUser);

// PUT /api/users/:id - admin, hr_manager (Audited)
router.put('/:id', authorize(['admin', 'hr_manager']), auditLogger('USER_UPDATE'), updateUser);

// DELETE /api/users/:id - admin, hr_manager (Audited)
router.delete('/:id', authorize(['admin', 'hr_manager']), auditLogger('USER_DELETE'), deleteUser);

// POST /api/users/heartbeat - Registered heartbeat for Admin users
router.post('/heartbeat', (req, res) => {
  if (req.user && req.user.role === 'admin') {
    registerAdminHeartbeat(req.user.username);
  }
  return res.status(200).json({ status: 'ok' });
});

export default router;

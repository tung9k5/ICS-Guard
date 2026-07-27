import express from 'express';
import { getAllUsers, getUserById, createUser, updateUser, deleteUser, deleteMultipleUsers, updateProfile } from '../controllers/userController.js';
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

/**
 * @openapi
 * /api/users:
 *   get:
 *     summary: Get all users
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
// GET /api/users - admin, hr_manager
router.get('/', authorize(['admin', 'hr_management']), getAllUsers);

/**
 * @openapi
 * /api/users/{id}:
 *   get:
 *     summary: Get user details by ID
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Success
 */
// GET /api/users/:id - admin, hr_manager
router.get('/:id', authorize(['admin', 'hr_management']), getUserById);

/**
 * @openapi
 * /api/users/profile:
 *   put:
 *     summary: Update own profile (Requires roles - Authenticated User)
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               full_name:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               avatar:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated successfully
 */
// PUT /api/users/profile - Update own profile (Audited)
router.put('/profile', auditLogger('PROFILE_UPDATE'), updateProfile);

/**
 * @openapi
 * /api/users:
 *   post:
 *     summary: Create a new user (Requires roles - Admin)
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *               - role
 *               - email
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [admin, hr_management, analyst, device_management]
 *               email:
 *                 type: string
 *               full_name:
 *                 type: string
 *     responses:
 *       201:
 *         description: User created successfully
 */
// POST /api/users - admin, hr_manager (Audited)
router.post('/', authorize(['admin', 'hr_management']), auditLogger('USER_CREATE'), createUser);

/**
 * @openapi
 * /api/users/{id}:
 *   put:
 *     summary: Update a user (Requires roles - Admin)
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [admin, hr_management, analyst, device_management]
 *               is_active:
 *                 type: boolean
 *               password:
 *                 type: string
 *               full_name:
 *                 type: string
 *               email:
 *                 type: string
 *               avatar:
 *                 type: string
 *     responses:
 *       200:
 *         description: User updated successfully
 *       404:
 *         description: User not found
 */
// PUT /api/users/:id - admin, hr_manager (Audited)
router.put('/:id', authorize(['admin', 'hr_management']), auditLogger('USER_UPDATE'), updateUser);

/**
 * @openapi
 * /api/users/{id}:
 *   delete:
 *     summary: Delete a user (Requires roles - Admin)
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User deleted successfully
 *       404:
 *         description: User not found
 */
// DELETE /api/users/:id - admin, hr_manager (Audited)
router.delete('/:id', authorize(['admin', 'hr_management']), auditLogger('USER_DELETE'), deleteUser);
router.post('/bulk-delete', authorize(['admin', 'hr_management']), auditLogger('USER_BULK_DELETE'), deleteMultipleUsers);

// POST /api/users/heartbeat - Registered heartbeat for Admin users
router.post('/heartbeat', (req, res) => {
  if (req.user && req.user.role === 'admin') {
    registerAdminHeartbeat(req.user.username);
  }
  return res.status(200).json({ status: 'ok' });
});

export default router;

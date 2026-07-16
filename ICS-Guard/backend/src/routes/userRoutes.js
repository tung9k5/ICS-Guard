import express from 'express';
import {
  getAllUsers,
  createUser,
  getUserById,
  updateUser,
  deleteUser,
  bulkDeleteUsers,
  updateProfile,
} from '../controllers/userController.js';
import authMiddleware from '../middlewares/authMiddleware.js';
import authorize from '../middlewares/rbacMiddleware.js';
import auditLogger from '../middlewares/auditMiddleware.js';
import {
  validateCreateUser,
  validateUpdateUser,
  validateProfile
} from '../validators/userValidator.js';
import { validateBulkIds, validateMongoId, validatePagination } from '../validators/commonValidator.js';

const router = express.Router();

router.use(authMiddleware);

router.put('/profile', validateProfile, auditLogger('PROFILE_UPDATE'), updateProfile);

router.use(authorize(['admin']));

router.get('/', validatePagination, getAllUsers);
router.post('/', validateCreateUser, auditLogger('USER_CREATE'), createUser);
router.post('/bulk-delete', validateBulkIds, auditLogger('USER_BULK_DELETE'), bulkDeleteUsers);

router.get('/:id', validateMongoId, getUserById);
router.put('/:id', validateMongoId, validateUpdateUser, auditLogger('USER_UPDATE'), updateUser);
router.delete('/:id', validateMongoId, auditLogger('USER_DELETE'), deleteUser);

export default router;

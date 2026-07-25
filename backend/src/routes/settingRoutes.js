import express from 'express';
import { getAllSettings, updateSetting } from '../controllers/settingController.js';
import authMiddleware from '../middlewares/authMiddleware.js';
import authorize from '../middlewares/rbacMiddleware.js';
import { validateSettingUpdate } from '../validators/settingValidator.js';
import auditLogger from '../middlewares/auditMiddleware.js';

const router = express.Router();

router.use(authMiddleware);
router.use(authorize(['admin'])); // Only admins can access settings by default

router.get('/', getAllSettings);
router.put('/:key', validateSettingUpdate, auditLogger('UPDATE_SETTING'), updateSetting);

export default router;

import express from 'express';
import {
  getPlaybooks,
  getPlaybookById,
  createPlaybook,
  updatePlaybook,
  togglePlaybook,
  deletePlaybook,
  suggestPlaybook,
} from '../controllers/playbookController.js';
import authMiddleware from '../middlewares/authMiddleware.js';
import { authorize } from '../middlewares/rbacMiddleware.js';
import auditLogger from '../middlewares/auditMiddleware.js';

const router = express.Router();

router.use(authMiddleware);

// GET all playbooks — Admin, Analyst, Device Management
router.get('/', authorize(['admin', 'analyst', 'device_management']), getPlaybooks);

// GET one playbook by ID
router.get('/:id', authorize(['admin', 'analyst', 'device_management']), getPlaybookById);

// POST suggest a new playbook (AI-assisted rule-based)
router.post('/suggest', authorize(['admin', 'analyst']), suggestPlaybook);

// POST create a new playbook
router.post('/', authorize(['admin', 'analyst']), auditLogger('PLAYBOOK_CREATE'), createPlaybook);

// PUT update a playbook
router.put('/:id', authorize(['admin', 'analyst']), auditLogger('PLAYBOOK_UPDATE'), updatePlaybook);

// PATCH toggle active status
router.patch('/:id/toggle', authorize(['admin', 'analyst']), auditLogger('PLAYBOOK_TOGGLE'), togglePlaybook);

// DELETE a playbook
router.delete('/:id', authorize(['admin', 'analyst']), auditLogger('PLAYBOOK_DELETE'), deletePlaybook);

export default router;

import express from 'express';
import { getPlaybooks, createPlaybook, deletePlaybook } from '../controllers/playbookController.js';
import authMiddleware from '../middlewares/authMiddleware.js';
import { authorize } from '../middlewares/rbacMiddleware.js';

const router = express.Router();

router.use(authMiddleware);
router.use(authorize(['admin', 'analyst']));

router.get('/', getPlaybooks);
router.post('/', createPlaybook);
router.delete('/:id', deletePlaybook);

export default router;

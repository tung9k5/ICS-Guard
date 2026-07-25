import express from 'express';
import { getSummaryReport } from '../controllers/reportController.js';
import authMiddleware from '../middlewares/authMiddleware.js';
import authorize from '../middlewares/rbacMiddleware.js';

const router = express.Router();

router.use(authMiddleware);
router.use(authorize(['admin', 'operator', 'viewer']));

router.get('/summary', getSummaryReport);

export default router;

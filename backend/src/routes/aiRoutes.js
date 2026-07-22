import express from 'express';
import { processChatMessage } from '../controllers/aiController.js';
import authMiddleware from '../middlewares/authMiddleware.js';

const router = express.Router();

router.use(authMiddleware);

router.post('/chat', processChatMessage);

export default router;

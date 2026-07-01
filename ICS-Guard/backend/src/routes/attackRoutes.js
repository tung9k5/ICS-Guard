import express from 'express';
import { launchAttack, getAttackDevices } from '../controllers/attackController.js';

const router = express.Router();

router.post('/launch', launchAttack);
router.get('/devices', getAttackDevices);

export default router;

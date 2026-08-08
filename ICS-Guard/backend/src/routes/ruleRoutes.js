import express from 'express';
import {
  getAllRules,
  getRuleById,
  createRule,
  updateRule,
  deleteRule,
  deleteMultipleRules,
  backtestRule,
  getRuleTemplates,
  syncRuleTemplates,
  getRuleEffectiveness
} from '../controllers/ruleController.js';
import authMiddleware from '../middlewares/authMiddleware.js';
import { authorize } from '../middlewares/rbacMiddleware.js';
import auditLogger from '../middlewares/auditMiddleware.js';

/**
 * @swagger
 * tags:
 *   name: Rules
 *   description: Detection Rule Management API
 */

const router = express.Router();

router.use(authMiddleware);

/**
 * @swagger
 * /api/rules:
 *   get:
 *     summary: Get all rules with pagination and filters
 *     tags: [Rules]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: per_page
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/', getAllRules);
router.get('/templates', getRuleTemplates);
router.post('/backtest', authorize(['admin', 'analyst']), backtestRule);
router.get('/:id/effectiveness', getRuleEffectiveness);
router.get('/:id', getRuleById);


// Admin / L2, L3 only for modifying rules
router.post('/', authorize(['admin', 'analyst']), auditLogger('RULE_CREATE'), createRule);
router.put('/:id', authorize(['admin', 'analyst']), auditLogger('RULE_UPDATE'), updateRule);
router.delete('/:id', authorize(['admin', 'analyst']), auditLogger('RULE_DELETE'), deleteRule);
router.post('/bulk-delete', authorize(['admin', 'analyst']), auditLogger('RULE_BULK_DELETE'), deleteMultipleRules);

export default router;

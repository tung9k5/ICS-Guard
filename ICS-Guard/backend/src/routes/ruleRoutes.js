import express from 'express';
import {
  getAllRules,
  createRule,
  getRuleById,
  updateRule,
  deleteRule,
  bulkDeleteRules
} from '../controllers/ruleController.js';
import authMiddleware from '../middlewares/authMiddleware.js';
import authorize from '../middlewares/rbacMiddleware.js';
import auditLogger from '../middlewares/auditMiddleware.js';
import {
  validateCreateRule,
  validateUpdateRule
} from '../validators/ruleValidator.js';
import { validateBulkIds, validateMongoId, validatePagination } from '../validators/commonValidator.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/', validatePagination, getAllRules);
router.post('/', authorize(['admin', 'l3_manager', 'l2_responder']), validateCreateRule, auditLogger('RULE_CREATE'), createRule);
router.post('/bulk-delete', authorize(['admin', 'l3_manager']), validateBulkIds, auditLogger('RULE_BULK_DELETE'), bulkDeleteRules);

router.get('/:id', validateMongoId, getRuleById);
router.put('/:id', authorize(['admin', 'l3_manager']), validateMongoId, validateUpdateRule, auditLogger('RULE_UPDATE'), updateRule);
router.delete('/:id', authorize(['admin', 'l3_manager']), validateMongoId, auditLogger('RULE_DELETE'), deleteRule);

export default router;

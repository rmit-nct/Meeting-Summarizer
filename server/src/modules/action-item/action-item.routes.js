import { Router } from 'express';
import { validate, validateParams, validateQuery } from '../../middleware/validate.js';
import { actionItemController } from './action-item.controller.js';
import * as actionItemValidator from './action-item.validator.js';

// Mounted at /api/action-items in app.js. See ENDPOINTS.md §4.
const router = Router();

router.get('/', validateQuery(actionItemValidator.listQuery), actionItemController.list);
router.post('/', validate(actionItemValidator.create), actionItemController.create);
router.patch(
  '/:id',
  validateParams(actionItemValidator.actionItemIdParam),
  validate(actionItemValidator.update),
  actionItemController.update,
);
router.delete('/:id', validateParams(actionItemValidator.actionItemIdParam), actionItemController.remove);

export default router;

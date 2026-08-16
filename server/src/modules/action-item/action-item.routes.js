import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { actionItemValidator } from './action-item.validator.js';
import { actionItemController } from './action-item.controller.js';

// Mounted at /api/action-items in app.js. See ENDPOINTS.md §4.
const router = Router();

router.get('/', actionItemController.list);
router.post('/', validate(actionItemValidator.create), actionItemController.create);
router.patch('/:id', validate(actionItemValidator.update), actionItemController.update);
router.delete('/:id', actionItemController.remove);

export default router;
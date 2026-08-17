import { Router } from 'express';
import { validate, validateParams, validateQuery } from '../../middleware/validate.js';
import { meetingController } from './meeting.controller.js';
import * as meetingValidator from './meeting.validator.js';

// Mounted at /api/meetings in app.js. See ENDPOINTS.md §2.
const router = Router();

router.post('/', validate(meetingValidator.create), meetingController.create);
router.get('/', validateQuery(meetingValidator.listQuery), meetingController.list);
router.post(
  '/:id/upload',
  validateParams(meetingValidator.meetingIdParam),
  validate(meetingValidator.upload),
  meetingController.upload,
);
router.patch(
  '/:id',
  validateParams(meetingValidator.meetingIdParam),
  validate(meetingValidator.update),
  meetingController.update,
);
router.delete('/:id', validateParams(meetingValidator.meetingIdParam), meetingController.remove);

export default router;

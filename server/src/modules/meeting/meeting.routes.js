import { Router } from 'express';
import { validate, validateParams, validateQuery } from '../../middleware/validate.js';
import { meetingController } from './meeting.controller.js';
import * as meetingValidator from './meeting.validator.js';

// Mounted at /api/meetings in app.js. See ENDPOINTS.md §2, §5.
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

// NOTE: GET /api/meetings/:id belongs to the OVERVIEW module, which composes
// meeting + transcript + summary + actionItems + speakers into one payload.
// app.js mounts overviewRoutes on the same /api/meetings prefix, after this
// router — so do not add a bare GET /:id here, or it will shadow the
// aggregator and the detail page will render an empty summary.

export default router;

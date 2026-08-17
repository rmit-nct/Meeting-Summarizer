import { Router } from 'express';
import { validate, validateParams } from '../../middleware/validate.js';
import { summaryController } from './summary.controller.js';
import * as summaryValidator from './summary.validator.js';
import { meetingIdParam } from '../meeting/meeting.validator.js';

// Mounted at /api/meetings in app.js, alongside meeting.routes.js. See ENDPOINTS.md §5.
const router = Router();

router.patch(
  '/:id/speakers',
  validateParams(meetingIdParam),
  validate(summaryValidator.renameSpeakers),
  summaryController.renameSpeakers,
);

export default router;

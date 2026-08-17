import { Router } from 'express';
import { validateParams } from '../../middleware/validate.js';
import { overviewController } from './overview.controller.js';
import { meetingIdParam } from '../meeting/meeting.validator.js';

// Mounted at /api/meetings in app.js, alongside meeting.routes.js. See ENDPOINTS.md §2.
const router = Router();

router.get('/:id', validateParams(meetingIdParam), overviewController.detail);

export default router;

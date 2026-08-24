import { Router } from 'express';
import { validateParams, validateQuery } from '../../middleware/validate.js';
import { meetingIdParam } from '../meeting/meeting.validator.js';
import { exportQuery } from './export.validator.js';
import { exportController } from './export.controller.js';

// Mounted at /api/meetings in app.js, alongside meeting.routes.js. See ENDPOINTS.md §6.
const router = Router();

router.get('/:id/export', validateParams(meetingIdParam), validateQuery(exportQuery), exportController.download);

export default router;

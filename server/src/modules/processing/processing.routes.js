import { Router } from 'express';
import { validateParams } from '../../middleware/validate.js';
import { aiPipelineRateLimit } from '../../middleware/rateLimit.js';
import { processingController } from './processing.controller.js';
import { meetingIdParam } from './processing.validator.js';

// Mounted at /api/meetings in app.js. See ENDPOINTS.md §3.
const router = Router();

router.post('/:id/process', aiPipelineRateLimit, validateParams(meetingIdParam), processingController.process);
router.post('/:id/resummarize', aiPipelineRateLimit, validateParams(meetingIdParam), processingController.resummarize);
router.get('/:id/status', validateParams(meetingIdParam), processingController.status);

export default router;
